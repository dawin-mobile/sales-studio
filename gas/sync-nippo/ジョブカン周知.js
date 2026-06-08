/**
   * send-staff-id.gs
   */

  const JOBCAN_STAFF_SHEET_NAME = 'スタッフ情報';

  const JOBCAN_MESSAGE_TEMPLATE = `{name}さん

  お疲れ様です！
  5月1日より打刻はジョブカンになります。
  下記ログイン時の情報送ります。

  会社ID【qlshd】
  スタッフコード【{id}】
  パスワード【自分の誕生日（西暦月日）】例：19870914

  ログインURL：https://ssl.jobcan.jp/login/mb-employee/

  ※jinjerと違いアプリはありません
  ※ログイン時に【ログイン情報を保存する】にチェックを入れると2回目以降ログインが簡単になります。

〜使い方〜
  １枚目
  ログイン画面
  ↓
  ２枚目
  ログインしたら左上の打刻をタップ
  ↓
  ３枚目
  通常モードで【打刻】をタップ
  （稼働終了したら【退勤】をタップ）
  ↓
  ４枚目
  位置情報を取得をタップ
  ↓
  ５枚目
  はい

  ⭐️打刻完了⭐️

  不明な点があればお気軽にご連絡ください！`;

  function sendJobcanInfo() {
    const targets = getJobcanTargets_();
    if (targets.length === 0) {
      Logger.log('送信対象が見つかりませんでした');
      return;
    }

    Logger.log('送信対象: ' + targets.length + '名');
    let successCount = 0;

    for (const t of targets) {
      const body = JOBCAN_MESSAGE_TEMPLATE
        .replace('{name}', t.name)
        .replace('{id}', t.staffId);
      try {
        GmailApp.sendEmail(t.email, '【ジョブカン】勤怠アプリ変更のお知らせ', body, {
          name: 'Dawin Bot',
            attachments: [
              DriveApp.getFileById('1zGRRieMmXESBtoxOrOYS1KaSUD-XKcYq').getBlob(),                                                                                   
              DriveApp.getFileById('1sUFQJkYiJpy6v2i5yzyPxGFn9nr33mwq').getBlob(),
              DriveApp.getFileById('1HbBNCZWkhqvmU5rOqIz0ekemzrEvn6TJ').getBlob(),                                                                                   
              DriveApp.getFileById('1HD7_2Y0Mfu3oADlarBI5XDjyjuu4GVoT').getBlob(),                                                                                 
              DriveApp.getFileById('17FZhFJy60k-huYHYkbAYGLwxpHE0J6BY').getBlob(),                                                                                   
              DriveApp.getFileById('176xVcqzyQk_GTzcQa5yVW0NNhDvDiDf1').getBlob()                                                                                    
              ]
        });
        Logger.log('✅ 送信: ' + t.name + ' (' + t.email + ') ID=' + t.staffId);
        successCount++;
      } catch (e) {
        Logger.log('❌ 失敗: ' + t.name + ' / ' + e.message);
      }
    }

    Logger.log('完了: ' + successCount + '/' + targets.length + '名に送信しました');
  }

  function dryRunJobcan() {
    const targets = getJobcanTargets_();
    Logger.log('=== 送信対象（ドライラン）: ' + targets.length + '名 ===');
    for (const t of targets) {
      Logger.log(t.name + ' / ID: ' + t.staffId + ' / 送信先: ' + t.email);
    }
  }

  function getJobcanTargets_() {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(JOBCAN_STAFF_SHEET_NAME);
    if (!sheet) {
      Logger.log(JOBCAN_STAFF_SHEET_NAME + ' シートが見つかりません');
      return [];
    }

    const data    = sheet.getDataRange().getValues();
    const targets = [];

    for (let i = 1; i < data.length; i++) {
      const row     = data[i];
      const staffId = String(row[3]  ?? '').trim();
      const email   = String(row[15] ?? '').trim();
      const name    = String(row[19] ?? '').trim();
      const role    = String(row[22] ?? '').trim();
      const active  = String(row[23] ?? '').trim().toUpperCase();

      if (role !== 'アルバイト' && role !== '社員' && role !== '管理者') continue;
      if (active !== 'TRUE') continue;
      if (!name || !staffId || !email || !email.includes('@')) continue;

      targets.push({ name, staffId, email });
    }

    return targets;
  }