// ============================================================
//  sync-staff.gs
//  【役割】「スタッフ情報」シートの内容をDBへ反映する
//
//  2026-09-02 まではここで転記元スプレッドシートから自動コピーしていたが、
//  経理側が「スタッフ情報」シートを直接管理する運用に変わったため、
//  転記処理（syncStaffInfo_New）は廃止した。
//  シートは人が編集し、DBへの反映は下記を手動実行する。
//
//  【手動実行】
//    syncStaffProfilesToDB() … シート内容をDBへ送る（シートは変更しない）
// ============================================================

// ============================================================
//  [機能⑤-B] スタッフプロフィール → DB同期
//  手動実行: syncStaffProfilesToDB()
// ============================================================

function syncStaffProfilesToDB() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('スタッフ情報');
    if (!sheet) { Logger.log('[スタッフDB同期] スタッフ情報シートが見つかりません'); return; }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) { Logger.log('[スタッフDB同期] データなし'); return; }

    const rows = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    const payload = JSON.stringify({ rows: rows });
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + CONFIG.SYNC_SECRET },
      payload: payload,
      muteHttpExceptions: true,
    };

    [CONFIG.SYNC_URL, CONFIG.SYNC_URL_NEW].forEach(function(syncUrl) {
      try {
        const url = syncUrl.replace('/api/sync', '/api/sync/staff');
        const res = UrlFetchApp.fetch(url, options);
        Logger.log('[スタッフDB同期] ' + syncUrl + ' → ' + res.getResponseCode());
      } catch (e) {
        Logger.log('[スタッフDB同期] エラー (' + syncUrl + '): ' + e.message);
      }
    });
  } catch (e) {
    Logger.log('[スタッフDB同期] エラー: ' + e.message);
  }
}
