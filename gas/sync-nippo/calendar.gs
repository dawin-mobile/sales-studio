// ============================================================
//  calendar.gs
//  【役割】スタッフ個人のGoogleカレンダーにシフト予定を自動登録する
//
//  毎朝4時にシフト表を読み込み、今日から1週間分のシフトを
//  各スタッフのGoogleカレンダーに「【シフト】◯◯店」として登録します。
//  シフトがない日は既存の予定を自動削除します。
//  スタッフのGoogleアカウントはスタッフ情報シートのAA列から取得します。
//
//  【自動実行】毎日4時 → syncWeeklyStaffCalendar()
//  【手動実行】
//    testSyncSingleStaff() … 特定1名だけで動作確認（名前を書き換えて実行）
//    runSync()             … 特定月のTalknoteデータを手動でDBへ反映
// ============================================================

/**
 * 今日から1週間分のシフトを対象者全員のカレンダーに同期する（本番用）
 */
function syncWeeklyStaffCalendar() {
  const config   = DAWIN;
  const staffMap = getStaffMapWithCalendar_(config);
  const today    = new Date();

  let successCount = 0;
  let skipCount    = 0;

  for (const [staffName, calendarId] of Object.entries(staffMap)) {
    if (!calendarId) continue;
    try {
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        const shiftInfo  = getShiftDataFromSheet_(targetDate, staffName, config);
        updateCalendarEvent_(calendarId, targetDate, shiftInfo);
      }
      successCount++;
      Logger.log('✅ ' + staffName + 'さんの同期に成功しました！');
    } catch (e) {
      Logger.log('❌ ' + staffName + 'さんの同期に失敗: ' + e.message);
      skipCount++;
    }
  }
  Logger.log('【1週間分 同期完了】 成功: ' + successCount + '名 / 失敗・スキップ: ' + skipCount + '名');
}

/**
 * シフト表から特定の日の勤務情報を抽出する
 */
function getShiftDataFromSheet_(date, staffName, config) {
  let ss;
  try { ss = SpreadsheetApp.openById(config.shiftSheetId); } catch(e) { return null; }

  const targetSheetNames = config.shiftSheetNames.map(base =>
    Utilities.formatDate(date, 'Asia/Tokyo', 'yy') + '年' + Utilities.formatDate(date, 'Asia/Tokyo', 'M') + '月' + base
  );

  let shiftInfo = null;

  for (const sheetName of targetSheetNames) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const data = sheet.getDataRange().getValues();
    let activeCols = [], storeColIdx = 3, timeColIdx = 4;

    for (let rCount = 0; rCount < Math.min(10, data.length); rCount++) {
      const row = data[rCount];
      let tempCols = [], tempStoreIdx = 3, tempTimeIdx = 4;
      for (let c = 0; c < row.length; c++) {
        const cleanVal = String(row[c]).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '');
        if (config.targetHeaderNames.includes(cleanVal)) tempCols.push(c);
        if (cleanVal === '店舗') tempStoreIdx = c;
        if (cleanVal === '時間') tempTimeIdx  = c;
      }
      if (tempCols.length > 0) {
        activeCols = tempCols; storeColIdx = tempStoreIdx; timeColIdx = tempTimeIdx; break;
      }
    }
    if (activeCols.length === 0) continue;

    let currentShiftDate = null;
    for (const row of data) {
      if (Object.prototype.toString.call(row[0]) === '[object Date]') currentShiftDate = row[0];
      else if (row[0] !== '') currentShiftDate = null;

      if (!currentShiftDate || !isSameDate_(currentShiftDate, date)) continue;

      for (const colIdx of activeCols) {
        const cellName = normalizeName_(row[colIdx]);
        if (isNameMatch_(cellName, staffName)) {
          const loc      = String(row[storeColIdx]).trim();
          const timeVal  = String(row[timeColIdx]).trim();
          let startHour = 10, endHour = 18;
          if (timeVal === '11' || timeVal.startsWith('11:')) { startHour = 11; endHour = 19; }
          shiftInfo = {
            location: loc,
            start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, 0, 0),
            end:   new Date(date.getFullYear(), date.getMonth(), date.getDate(), endHour,   0, 0),
          };
          break;
        }
      }
      if (shiftInfo) break;
    }
    if (shiftInfo) break;
  }
  return shiftInfo;
}

/**
 * カレンダーの予定を上書き/削除する
 */
function updateCalendarEvent_(calendarId, date, shiftInfo) {
  const calendar = CalendarApp.getCalendarById(String(calendarId).trim());
  if (!calendar) {
    throw new Error('Action not allowed (権限がないか、アドレスが間違っています)');
  }

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(),  0,  0, 0);
  const endOfDay   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

  // 既存の「【シフト】」予定を削除してから作り直す
  calendar.getEvents(startOfDay, endOfDay).forEach(event => {
    if (event.getTitle().includes('【シフト】')) event.deleteEvent();
  });

  if (shiftInfo && shiftInfo.location) {
    calendar.createEvent('【シフト】' + shiftInfo.location, shiftInfo.start, shiftInfo.end);
  }
}

/**
 * スタッフ情報（AA列）からGoogleアカウントを取得する
 */
function getStaffMapWithCalendar_(config) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(config.idSheetName);
  if (!sheet) return {};
  const m    = {};
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const shiftName  = normalizeName_(data[i][5]);    // F列: シフト名
    const calendarId = String(data[i][26]).trim();    // AA列: カレンダーアドレス
    if (shiftName && calendarId.includes('@')) m[shiftName] = calendarId;
  }
  return m;
}


// ============================================================
//  運用サポート用（動作確認・トラブルシューティング）
// ============================================================

/**
 * 特定のスタッフ1名のみ同期テストを行う
 */
function testSyncSingleStaff() {
  const config          = DAWIN;
  const targetStaffName = '中村'; // ← テストしたい名前に書き換えて実行

  const staffMap   = getStaffMapWithCalendar_(config);
  const calendarId = staffMap[targetStaffName];

  if (!calendarId) {
    Logger.log('❌ ' + targetStaffName + 'さんのGoogleアカウント（AA列）が見つかりません。');
    return;
  }
  Logger.log('▶ ' + targetStaffName + 'さんの同期テストを開始します（送信先: ' + calendarId + '）');

  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const shiftInfo  = getShiftDataFromSheet_(targetDate, targetStaffName, config);
    try {
      updateCalendarEvent_(calendarId, targetDate, shiftInfo);
      if (shiftInfo) {
        Logger.log('  ' + Utilities.formatDate(targetDate, 'JST', 'MM/dd') + ': ' + shiftInfo.location + ' (' + shiftInfo.start.getHours() + '時開始) で更新');
      } else {
        Logger.log('  ' + Utilities.formatDate(targetDate, 'JST', 'MM/dd') + ': シフトなし（クリア）');
      }
    } catch(e) {
      Logger.log('❌ エラー: ' + e.message);
    }
  }
  Logger.log('✅ テスト完了。');
}

// 特定月のTalknoteデータを手動でDBへ反映する
function runSync() {
  syncTalknote('2026-04'); // ← 対象月を変更して実行
}
