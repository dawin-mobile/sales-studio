// ============================================================
//  talknote.gs
//  【役割】GmailからTalknoteの通知メールを取得してシートに記録し、DBに送る
//
//  Talknoteからのメールを種類別に振り分けます：
//    通常メッセージ  → 「トークノート受信録」シートに記録 → DBへ送信
//    実績報告ノート  → 「実績受信録」シートに記録（DBには送らない）
//    ☆関東社員☆ノート → 「終了報告受信録」シートに記録（DBには送らない）
//    ★勤怠報告★ノート → 「勤怠報告受信録」シートに記録（DBには送らない）
//    【戻り報告】ノート → 「戻り報告受信録」シートに記録（DBには送らない）
//
//  【自動実行】15分おき → fetchAndSyncTalknote()
//  【手動実行（過去データ取込用）】
//    fetchTalknoteEmails_PastData() … 通常メッセージの過去50件を取込
//    fetchJissekiEmails_PastData()  … 実績報告の過去200件を取込
//    fetchShuryoEmails_PastData()   … 終了報告の過去200件を取込
//    fetchKintaiEmails_PastData()   … 勤怠報告の過去200件を取込
//    fetchModoriEmails_PastData()   … 戻り報告の過去200件を取込
// ============================================================

// 重複チェック用のキーを作る。
// シートのA列（受信日時）は日付として保存されるため getValues() は Date を返す。
// 書き込み時の文字列 'yyyy/MM/dd HH:mm:ss' と形をそろえないと一致せず、
// 重複チェックがすり抜けて同じ投稿が二重に入る。
function stampKey_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  }
  return String(value).trim();
}

// 受信録シートを用意する。
// シートが無ければ作り、「あるけど空（手でタブだけ作った状態）」ならヘッダーを入れる。
// ※ ヘッダーを入れないと1行目からデータが入り、読む側が1件取りこぼす
//   （実際に「終了報告受信録」が過去にこの状態になっている）
function getReportSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(['受信日時', '送信者', 'メッセージ内容']);
  return sheet;
}

// 未読メールを取得してシートに記録し、DBへ同期する（自動実行用）
function fetchAndSyncTalknote() {
  const jstHour = new Date().getHours();
  if (jstHour >= 22 || jstHour < 9) return;
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_TALKNOTE);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TALKNOTE);
    sheet.appendRow(['受信日時', '送信者', 'メッセージ内容']);
  }

  const threads = GmailApp.search('from:no-reply@talknote.com is:unread');
  if (threads.length === 0) {
    Logger.log('[Talknote] 新着メールなし');
    return;
  }

  let count = 0;
  let jissekiCount = 0;
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      if (!message.isUnread()) continue;

      const date    = message.getDate();
      const subject = message.getSubject();
      const body    = message.getPlainBody();
      const isJisseki = subject.includes('実績報告') && subject.includes('ノートに投稿しました');
      const isShuryo  = subject.includes('☆関東社員☆') && subject.includes('ノートに投稿しました');
      // 勤怠報告（当欠・遅刻・早退）。ノート名の記号（★関東社員★）ではなく「勤怠報告」の語で判定する
      const isKintai  = subject.includes('ノートに投稿しました')
                        && KINTAI_NOTE_KEYWORDS.some(function(kw) { return subject.includes(kw); });
      // 戻り報告（別日に戻ってきた分の獲得）。勤怠と同じくノート名の語で判定する
      const isModori  = subject.includes('ノートに投稿しました')
                        && MODORI_NOTE_KEYWORDS.some(function(kw) { return subject.includes(kw); });

      if (isJisseki || isShuryo || isKintai || isModori) {
        // 実績報告 / ☆関東社員☆ / 勤怠報告 / 戻り報告 → 専用シートに追記（DBへは送らない）
        const sheetName = isJisseki ? SHEET_JISSEKI
                        : isKintai  ? SHEET_KINTAI
                        : isModori  ? SHEET_MODORI
                        : SHEET_SHURYO;
        const targetSheet = getReportSheet_(ss, sheetName);
        let senderName = '不明';
        const nameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんが[「『].*?[」』]ノートに投稿しました/);
        if (nameMatch && nameMatch[1]) senderName = nameMatch[1].trim();
        let msgContent = '（内容をうまく取得できませんでした）';
        const bodyMatch = body.match(/さんの投稿\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
        if (bodyMatch && bodyMatch[1]) msgContent = bodyMatch[1].trim();
        targetSheet.appendRow([
          Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
          senderName,
          msgContent,
        ]);
        message.markRead();
        jissekiCount++;
      } else {
        // 全社以外のノート投稿はスキップ（取りこぼし防止）
        if (subject.includes('ノートに投稿しました') && !subject.includes('「全社」')) {
          message.markRead();
          continue;
        }
        // 全社ノート投稿 or 直接メッセージ → トークノート受信録 + DB同期
        let senderName = '不明';
        const noteNameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんが[「『]全社[」』]/);
        if (noteNameMatch && noteNameMatch[1]) {
          senderName = noteNameMatch[1].trim();
        } else {
          const dmNameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんからメッセージ/);
          if (dmNameMatch && dmNameMatch[1]) senderName = dmNameMatch[1].trim();
        }
        let msgContent = '（内容をうまく取得できませんでした）';
        const noteBodyMatch = body.match(/さんの投稿\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
        if (noteBodyMatch && noteBodyMatch[1]) {
          msgContent = noteBodyMatch[1].trim();
        } else {
          const dmBodyMatch = body.match(/からのメッセージ\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
          if (dmBodyMatch && dmBodyMatch[1]) msgContent = dmBodyMatch[1].trim();
        }
        sheet.appendRow([
          Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
          senderName,
          msgContent,
        ]);
        message.markRead();
        count++;
      }
    }
  }

  Logger.log('[Talknote] トークノート: ' + count + '件、実績報告・関東社員・勤怠・戻り: ' + jissekiCount + '件をシートに記録');
  if (count > 0) syncTalknote(getCurrentMonth_());
}

// 過去の既読メールをまとめてシートに記録する（手動実行用・初回データ取込に使う）
// ※最新50スレッド分。もっと必要な場合は「50」を増やして実行してください
function fetchTalknoteEmails_PastData() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_TALKNOTE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TALKNOTE);
    sheet.appendRow(['受信日時', '送信者', 'メッセージ内容']);
  }

  const threads = GmailApp.search('from:no-reply@talknote.com', 0, 50);
  if (threads.length === 0) { Logger.log('過去のメールが見つかりませんでした'); return; }

  let count = 0;
  let jissekiCount = 0;
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      const date    = message.getDate();
      const subject = message.getSubject();
      const body    = message.getPlainBody();
      const isJisseki = subject.includes('実績報告') && subject.includes('ノートに投稿しました');

      if (isJisseki) {
        let jissekiSheet = ss.getSheetByName(SHEET_JISSEKI);
        if (!jissekiSheet) {
          jissekiSheet = ss.insertSheet(SHEET_JISSEKI);
          jissekiSheet.appendRow(['受信日時', '送信者', 'メッセージ内容']);
        }
        let senderName = '不明';
        const nameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんが[「『].*?[」』]ノートに投稿しました/);
        if (nameMatch && nameMatch[1]) senderName = nameMatch[1].trim();
        let msgContent = '（内容をうまく取得できませんでした）';
        const bodyMatch = body.match(/さんの投稿\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
        if (bodyMatch && bodyMatch[1]) msgContent = bodyMatch[1].trim();
        jissekiSheet.appendRow([
          Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
          senderName,
          msgContent,
        ]);
        jissekiCount++;
      } else {
        let senderName = '不明';
        const nameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんからメッセージ/);
        if (nameMatch && nameMatch[1]) senderName = nameMatch[1].trim();
        let msgContent = '（内容をうまく取得できませんでした）';
        const bodyMatch = body.match(/からのメッセージ\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
        if (bodyMatch && bodyMatch[1]) msgContent = bodyMatch[1].trim();
        sheet.appendRow([
          Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
          senderName,
          msgContent,
        ]);
        count++;
      }
    }
  }
  Logger.log('過去のメッセージ — トークノート: ' + count + '件、実績報告: ' + jissekiCount + '件をシートに記録しました');
}

// 過去の実績報告メールだけを実績受信録に取り込む（手動実行用）
// ※最新200件。もっと必要な場合は「200」を増やして実行
function fetchJissekiEmails_PastData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let jissekiSheet = ss.getSheetByName(SHEET_JISSEKI);
  if (!jissekiSheet) {
    jissekiSheet = ss.insertSheet(SHEET_JISSEKI);
    jissekiSheet.appendRow(['受信日時', '送信者', 'メッセージ内容']);
  }

  const threads = GmailApp.search('from:no-reply@talknote.com 実績報告 ノートに投稿しました', 0, 200);
  if (threads.length === 0) { Logger.log('[実績報告] 対象メールが見つかりませんでした'); return; }

  let count = 0;
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      const date    = message.getDate();
      const subject = message.getSubject();
      const body    = message.getPlainBody();

      if (!subject.includes('実績報告') || !subject.includes('ノートに投稿しました')) continue;

      let senderName = '不明';
      const nameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんが[「『].*?[」』]ノートに投稿しました/);
      if (nameMatch && nameMatch[1]) senderName = nameMatch[1].trim();

      let msgContent = '（内容をうまく取得できませんでした）';
      const bodyMatch = body.match(/さんの投稿\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
      if (bodyMatch && bodyMatch[1]) msgContent = bodyMatch[1].trim();

      jissekiSheet.appendRow([
        Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
        senderName,
        msgContent,
      ]);
      count++;
    }
  }
  Logger.log('[実績報告] ' + count + '件を実績受信録に記録しました');
}

// 過去の☆関東社員☆ノート投稿メールを終了報告受信録に取り込む（手動実行用）
// ※最新200件。もっと必要な場合は「200」を増やして実行
function fetchShuryoEmails_PastData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let shuryoSheet = ss.getSheetByName(SHEET_SHURYO);
  if (!shuryoSheet) {
    shuryoSheet = ss.insertSheet(SHEET_SHURYO);
    shuryoSheet.appendRow(['受信日時', '送信者', 'メッセージ内容']);
  }

  const threads = GmailApp.search('from:no-reply@talknote.com ☆関東社員☆ ノートに投稿しました', 0, 200);
  if (threads.length === 0) { Logger.log('[終了報告] 対象メールが見つかりませんでした'); return; }

  let count = 0;
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      const date    = message.getDate();
      const subject = message.getSubject();
      const body    = message.getPlainBody();

      if (!subject.includes('☆関東社員☆') || !subject.includes('ノートに投稿しました')) continue;

      let senderName = '不明';
      const nameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんが[「『].*?[」』]ノートに投稿しました/);
      if (nameMatch && nameMatch[1]) senderName = nameMatch[1].trim();

      let msgContent = '（内容をうまく取得できませんでした）';
      const bodyMatch = body.match(/さんの投稿\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
      if (bodyMatch && bodyMatch[1]) msgContent = bodyMatch[1].trim();

      shuryoSheet.appendRow([
        Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
        senderName,
        msgContent,
      ]);
      count++;
    }
  }
  Logger.log('[終了報告] ' + count + '件を終了報告受信録に記録しました');
}


// 過去の勤怠報告メールだけを勤怠報告受信録に取り込む（手動実行用）
// ※最新200件。ノートを作った直後の取りこぼしを拾うのに使う
function fetchKintaiEmails_PastData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let kintaiSheet = ss.getSheetByName(SHEET_KINTAI);
  if (!kintaiSheet) {
    kintaiSheet = ss.insertSheet(SHEET_KINTAI);
    kintaiSheet.appendRow(['受信日時', '送信者', 'メッセージ内容']);
  }

  // すでに取り込んだ投稿を二重に記録しないよう、受信日時＋送信者で照合する
  const existing = {};
  const lastRow = kintaiSheet.getLastRow();
  if (lastRow > 1) {
    const rows = kintaiSheet.getRange(1, 1, lastRow, 2).getValues();
    for (const r of rows) existing[stampKey_(r[0]) + '|' + String(r[1]).trim()] = true;
  }

  const threads = GmailApp.search('from:no-reply@talknote.com 勤怠報告 ノートに投稿しました', 0, 200);
  if (threads.length === 0) { Logger.log('[勤怠報告] 対象メールが見つかりませんでした'); return; }

  let count = 0;
  let skipped = 0;
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      const date    = message.getDate();
      const subject = message.getSubject();
      const body    = message.getPlainBody();

      if (!subject.includes('ノートに投稿しました')) continue;
      if (!KINTAI_NOTE_KEYWORDS.some(function(kw) { return subject.includes(kw); })) continue;

      let senderName = '不明';
      const nameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんが[「『].*?[」』]ノートに投稿しました/);
      if (nameMatch && nameMatch[1]) senderName = nameMatch[1].trim();

      let msgContent = '（内容をうまく取得できませんでした）';
      const bodyMatch = body.match(/さんの投稿\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
      if (bodyMatch && bodyMatch[1]) msgContent = bodyMatch[1].trim();

      const stamp = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
      if (existing[stamp + '|' + senderName.trim()]) { skipped++; continue; }

      kintaiSheet.appendRow([stamp, senderName, msgContent]);
      existing[stamp + '|' + senderName.trim()] = true;
      count++;
    }
  }
  Logger.log('[勤怠報告] ' + count + '件を勤怠報告受信録に記録しました（重複スキップ ' + skipped + '件）');
}


// ============================================================
//  戻り報告の過去メールを「戻り報告受信録」に取り込む（手動実行用）
//  受信日時＋送信者で重複チェックするので、何度実行しても二重にならない
// ============================================================
function fetchModoriEmails_PastData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const modoriSheet = getReportSheet_(ss, SHEET_MODORI);

  // すでに取り込んだ投稿を二重に記録しないよう、受信日時＋送信者で照合する
  const existing = {};
  const lastRow = modoriSheet.getLastRow();
  if (lastRow > 1) {
    const rows = modoriSheet.getRange(1, 1, lastRow, 2).getValues();
    for (const r of rows) existing[stampKey_(r[0]) + '|' + String(r[1]).trim()] = true;
  }

  const threads = GmailApp.search('from:no-reply@talknote.com 戻り報告 ノートに投稿しました', 0, 200);
  if (threads.length === 0) { Logger.log('[戻り報告] 対象メールが見つかりませんでした'); return; }

  let count = 0;
  let skipped = 0;
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      const date    = message.getDate();
      const subject = message.getSubject();
      const body    = message.getPlainBody();

      if (!subject.includes('ノートに投稿しました')) continue;
      if (!MODORI_NOTE_KEYWORDS.some(function(kw) { return subject.includes(kw); })) continue;

      let senderName = '不明';
      const nameMatch = subject.match(/Talknote\s*[：:]\s*(.+?)さんが[「『].*?[」』]ノートに投稿しました/);
      if (nameMatch && nameMatch[1]) senderName = nameMatch[1].trim();

      let msgContent = '（内容をうまく取得できませんでした）';
      const bodyMatch = body.match(/さんの投稿\s*[：:]\s*([\s\S]*?)(?=\n+返信はこちらから)/);
      if (bodyMatch && bodyMatch[1]) msgContent = bodyMatch[1].trim();

      const stamp = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
      if (existing[stamp + '|' + senderName.trim()]) { skipped++; continue; }

      modoriSheet.appendRow([stamp, senderName, msgContent]);
      existing[stamp + '|' + senderName.trim()] = true;
      count++;
    }
  }
  Logger.log('[戻り報告] ' + count + '件を戻り報告受信録に記録しました（重複スキップ ' + skipped + '件）');
}
