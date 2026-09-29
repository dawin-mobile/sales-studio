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
//
//  【自動実行（毎日6時）】
//    fillAnimalColumns() … 空欄の動物占い（K〜O列）だけを埋める
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


// ============================================================
//  [機能⑤-C] 動物占い（K〜O列）の自動補完
//  毎日6時にトリガーで自動実行 / 手動実行: fillAnimalColumns()
//
//  2026-09-02 に転記処理を廃止したことで、新しく入るスタッフの
//  K〜O列（動物占い）が空欄のままになるため追加した。
//
//  ⚠️ 値が1つでも入っている行はまるごとスキップする。
//     人が手で直した内容を翌朝に上書きしないため。
// ============================================================

const ANIMAL_COL_BIRTHDAY = 5;   // E列（生年月日）※1始まり
const ANIMAL_COL_START    = 11;  // K列（動物名）  ※1始まり。K〜Oの5列を扱う
const ANIMAL_COL_COUNT    = 5;   // K, L, M, N, O

function fillAnimalColumns() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('スタッフ情報');
  if (!sheet) { Logger.log('[動物占い補完] スタッフ情報シートが見つかりません'); return; }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('[動物占い補完] データなし'); return; }
  const numRows = lastRow - 1;  // ヘッダー行を除く

  // 読み取りは列single単位でまとめて行う（1行ずつ読むとシートAPIの呼び出しが増えて遅い）
  const birthdays = sheet.getRange(2, ANIMAL_COL_BIRTHDAY, numRows, 1).getValues();
  const animals   = sheet.getRange(2, ANIMAL_COL_START, numRows, ANIMAL_COL_COUNT).getValues();

  let filled = 0, skipped = 0, noBirthday = 0;

  for (let i = 0; i < numRows; i++) {
    // K〜Oのどれかに値が入っていたら、その行は触らない
    const hasValue = animals[i].some(v => String(v == null ? '' : v).trim() !== '');
    if (hasValue) { skipped++; continue; }

    const a = getAnimalByBirthday_(birthdays[i][0]);
    if (!a) { noBirthday++; continue; }

    animals[i] = [a.animal, a.chara, a.no, a.detail, a.description];
    filled++;
  }

  if (filled > 0) {
    sheet.getRange(2, ANIMAL_COL_START, numRows, ANIMAL_COL_COUNT).setValues(animals);
  }

  Logger.log('[動物占い補完] 補完 ' + filled + '件 / 記入済みでスキップ ' + skipped
             + '件 / 生年月日なし ' + noBirthday + '件');
}
