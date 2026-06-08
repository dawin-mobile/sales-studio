// ============================================================
//  sync-staff.gs
//  【役割】スタッフ情報を転記元スプレッドシートから自動コピーし、DBにも反映する
//
//  毎朝6時に転記元のスプレッドシートを読み込み、このスプレッドシートの
//  「スタッフ情報」シートへ上書きコピーします。
//  その際、TalknoteアドレスのURLを自動生成し、出身地域・星座も自動付与します。
//  コピー後、すぐDBへも送信してアプリに反映します。
//
//  【自動実行】毎日6時 → syncStaffInfo_New()
//  【手動実行】
//    syncStaffProfilesToDB() … シート内容をDBへ送り直すだけ（シートは変えない）
// ============================================================

// 転記元スプレッドシートから「スタッフ情報」シートへ転記し、DBにも反映する
function syncStaffInfo_New() {
  try {
    const sourceSS    = SpreadsheetApp.openById(STAFF_SYNC.sourceSpreadsheetId);
    const sourceSheet = sourceSS.getSheetByName(STAFF_SYNC.sourceSheetName);
    if (!sourceSheet) { Logger.log('転記元のシートが見つかりません'); return; }

    const lastRow = sourceSheet.getLastRow();
    if (lastRow === 0) return;

    // B列から15列分取得
    const data = sourceSheet.getRange(1, 2, lastRow, 15).getValues();

    const normName = function(s) { return String(s || '').replace(/[\s　]/g, ''); };

    const targetSS    = SpreadsheetApp.getActiveSpreadsheet();
    let   targetSheet = targetSS.getSheetByName(STAFF_SYNC.targetSheetName);
    if (!targetSheet) targetSheet = targetSS.insertSheet(STAFF_SYNC.targetSheetName);

    // ① 既存のログイン情報（T列=index19以降）をA列の名前でマップ保存
    const loginMap = {};
    let loginHeader = null;
    if (targetSheet.getLastRow() >= 2) {
      const existing = targetSheet.getDataRange().getValues();
      loginHeader = existing[0].slice(19);
      for (let i = 1; i < existing.length; i++) {
        const name = normName(existing[i][0]);
        if (name) loginMap[name] = existing[i].slice(19);
      }
    }

    targetSheet.clearContents();

    let finalData = [], isFirst = true;
    let talknoteIdIndex = 6, birthPlaceIndex = 7, birthdayIndex = 3;

    for (let row of data) {
      let newRow = [...row];
      if (isFirst) {
        newRow.push('トークノートアドレス', '出身地域', '星座');
        let i = 0;
        for (let h of row) {
          const headerName = String(h);
          if (headerName.includes('トークノート') || headerName.includes('ユーザーID') || headerName === 'ID') talknoteIdIndex = i;
          if (headerName.includes('出身'))  birthPlaceIndex = i;
          if (headerName.includes('誕生'))  birthdayIndex   = i;
          i++;
        }
      } else {
        // P列：TalknoteユーザーIDからメールアドレスを自動生成
        const talknoteId = String(row[talknoteIdIndex]).trim();
        newRow.push(talknoteId && /[0-9]/.test(talknoteId)
          ? 'u-1000035345-' + talknoteId + '@mail.talknote.com'
          : '');
        // Q列：都道府県名から地域を判定
        newRow.push(getRegionFromPrefecture_(String(row[birthPlaceIndex]).trim()));
        // R列：生年月日から星座を判定
        newRow.push(getZodiacSign_(row[birthdayIndex]));
      }
      finalData.push(newRow);
      isFirst = false;
    }

    const numRows = finalData.length;
    let numCols = 0; for (let row of finalData) { numCols = row.length; break; }
    targetSheet.getRange(1, 1, numRows, numCols).setValues(finalData);

    // ② ヘッダー行のT列以降を復元
    if (loginHeader && loginHeader.length > 0) {
      targetSheet.getRange(1, 20, 1, loginHeader.length).setValues([loginHeader]);
    }

    // ③ 名前でマッチングしてログイン情報を復元
    const sourceNames = finalData.slice(1).map(function(row) { return normName(row[0]); });
    let restored = 0, unmatched = [];
    for (let i = 0; i < sourceNames.length; i++) {
      const name = sourceNames[i];
      if (!name) continue;
      if (loginMap[name]) {
        targetSheet.getRange(i + 2, 20, 1, loginMap[name].length).setValues([loginMap[name]]);
        restored++;
      } else {
        unmatched.push(name);
      }
    }

    Logger.log('[スタッフ同期] ' + numRows + '行を同期、' + restored + '件のログイン情報を復元');
    if (unmatched.length > 0) Logger.log('[スタッフ同期] ログイン情報未設定: ' + unmatched.join(', '));

    syncStaffProfilesToDB();
  } catch (e) {
    Logger.log('[スタッフ同期] エラー: ' + e.message);
  }
}


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
