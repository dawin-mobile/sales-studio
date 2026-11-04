// ============================================================
//  sync-db.gs
//  【役割】スプレッドシートの内容をVercelアプリのDBへ送信する
//
//  合算データ・トークノートの各シートを読み取り、
//  APIを通じてデータベースに書き込みます。
//  年代・家族構成はアプリがシートを直接読むので DB には送らない（2026-11-04 にやめた）
//
//  【自動実行】合算データは日報合算（mergeSheets_Complete）の直後 → syncNippoAfterMerge_()
//  【手動実行】
//    syncAll()           … 今すぐ合算データの今月分を同期（合算データを手で直したとき）
//    syncSpecificMonth() … 特定の月のデータを入れ直す（月を書き換えて実行）
// ============================================================

// 合算データシートをDBへ送る（当月分のみ送信）
function syncNippoSheet(month) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NIPPO);
  if (!sheet) { Logger.log(SHEET_NIPPO + ' が見つかりません'); return; }

  const targetMonth = month || getCurrentMonth_();
  const allRows = sheet.getDataRange().getValues();

  const rows = allRows.filter(function(row, idx) {
    if (idx === 0) return true;
    const cell = row[1]; // B列: 日付
    if (!cell) return false;
    const d = cell instanceof Date ? cell : new Date(cell);
    if (isNaN(d.getTime())) return false;
    const rowMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return rowMonth === targetMonth;
  }).map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) {
        const y = cell.getFullYear();
        const m = String(cell.getMonth() + 1).padStart(2, '0');
        const d = String(cell.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
      }
      return String(cell);
    });
  });

  Logger.log('syncNippoSheet: ' + (rows.length - 1) + '行送信（当月: ' + targetMonth + '）');
  callSyncApi_({ type: 'sales', month: targetMonth, rows: rows });
}

// 日報合算の直後に呼ぶ。合算データが変わるのは合算のときだけなので、DB へはこのときだけ送る。
// 月初の 0時の合算には前の月の最後の日報が入るので、1日は前の月も送り直す
function syncNippoAfterMerge_() {
  const now = new Date();
  syncNippoSheet(getCurrentMonth_());
  if (now.getDate() === 1) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    syncNippoSheet(prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0'));
  }
}

// トークノート受信録シートをDBへ送る
function syncTalknote(month) {
  month = month || getCurrentMonth_();
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TALKNOTE);
  if (!sheet) { Logger.log(SHEET_TALKNOTE + ' が見つかりません'); return; }

  const data   = sheet.getDataRange().getValues();
  const [y, m] = month.split('-').map(Number);
  const rows   = [];

  for (var i = 1; i < data.length; i++) {
    var raw = data[i];
    var ts  = raw[0]; // A列：日時
    if (!ts) continue;

    var date;
    if (ts instanceof Date) {
      date = ts;
    } else {
      // 'yyyy/MM/dd HH:mm:ss' → ISO形式に変換してパース
      var str = String(ts).replace(/\//g, '-').replace(' ', 'T');
      date = new Date(str);
    }
    if (isNaN(date.getTime())) continue;
    if (date.getFullYear() !== y || date.getMonth() + 1 !== m) continue;

    var staffName = String(raw[1] || '').trim();
    var message   = String(raw[2] || '').trim();
    if (!staffName || !message) continue;

    var pad      = function(n) { return String(n).padStart(2, '0'); };
    var dateStr  = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    var postedAt = dateStr + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
    rows.push({ postedAt: postedAt, staffName: staffName, message: message });
  }

  if (rows.length === 0) { Logger.log('対象月のTalknoteデータがありません: ' + month); return; }
  callSyncApi_({ type: 'talknote', month: month, rows: rows });
}

// 合算データの今月分を今すぐ同期（手動実行用。自動では合算の直後に syncNippoAfterMerge_ が送る）
// ※トークノートは fetchAndSyncTalknote（15分おき）が新しい投稿のあるときだけ同期する
function syncAll() {
  const month = getCurrentMonth_();
  Logger.log('DB同期開始: ' + month);
  syncNippoSheet(month);
  Logger.log('DB同期完了');
}

// 特定の月のデータをDBに入れ直したい場合は month を書き換えて手動実行
function syncSpecificMonth() {
  const month = '2026-03'; // ← ここを変更して実行してください（例：'2026-05'）
  syncNippoSheet(month);
}
