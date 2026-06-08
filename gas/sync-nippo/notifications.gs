// ============================================================
//  notifications.gs
//  【役割】スタッフへのメール通知を送る（シフト連絡・日報催促）
//
//  2種類の通知をTalknoteアドレス宛に自動送信します：
//    ③ 翌日シフト通知 … シフト表を確認し「明日◯◯です」とメール送信
//    ④ 日報催促      … シフトに入っているのに日報未提出のスタッフへ催促
//
//  日報催促の前に mergeSheets_Complete() で日報フォーム①②を自動合算します。
//
//  【自動実行】
//    毎日18時 → mainTomorrow_ShiftNotify()（翌日シフト通知）
//    毎日21時 → mainToday_ReportReminder()（日報催促）
// ============================================================

// ============================================================
//  [補助] 日報合算
//    フォームの回答①②を合算データシートにまとめる。
//    mainToday_ReportReminder() から自動的に呼ばれる。
// ============================================================

function mergeSheets_Complete() {
  const jstHour = new Date().getHours();
  if (jstHour >= 1 && jstHour < 9) return;
  const config = DAWIN;
  try {
    const mapping = [
      {dest: 0, src: 0}, {dest: 1, src: 1}, {dest: 2, src: 3}, {dest: 5, src: 4},
      {dest: 6, src: 5, mul: 1.2}, {dest: 7, src: 6, mul: 1}, {dest: 8, src: 7, mul: 0.6},
      {dest: 9, src: 8, mul: 0.8}, {dest: 12, src: 9, mul: 1}, {dest: 13, src: 10, mul: 0.8},
      {dest: 14, src: 11, mul: 0.2}, {dest: 16, src: 12, mul: 0.1}, {dest: 17, src: 13, mul: 0.2},
      {dest: 18, src: 14}, {dest: 32, src: 15, mul: 1}, {dest: 33, src: 16, mul: 1},
    ];

    const ssA = SpreadsheetApp.openById(config.formSheetId1);
    const ssB = SpreadsheetApp.openById(config.formSheetId2);
    const ssC = SpreadsheetApp.getActiveSpreadsheet();

    const shA = ssA.getSheetByName('フォームの回答 1');
    const shB = ssB.getSheetByName('フォームの回答 1');
    let   shC = ssC.getSheetByName(config.reportSheetName);
    if (!shC) shC = ssC.insertSheet(config.reportSheetName);

    const lastRowA = shA.getLastRow();
    const lastColA = shA.getLastColumn();
    if (lastRowA < 1 || lastColA < 1) return;

    let dataA = lastRowA > 0 ? shA.getRange(1, 1, lastRowA, lastColA).getValues() : [];

    let dataB_Processed = [];
    const lastRowB = shB.getLastRow();
    if (lastRowB >= 2) {
      const dataB = shB.getRange(2, 1, lastRowB - 1, shB.getLastColumn()).getValues();
      dataB.forEach(rowB => {
        let newRow = new Array(lastColA).fill('');
        const tempRowB = [...rowB];
        tempRowB.shift(); tempRowB.shift();
        const val2 = tempRowB.shift();
        const val3 = tempRowB.shift();
        if (val2 && val3) newRow.splice(2, 1, val2 + ' ' + val3);
        else newRow.splice(2, 1, val3);

        mapping.forEach(map => {
          let val = null, counter = 0;
          for (let v of rowB) { if (counter === map.src) { val = v; break; } counter++; }
          if (map.dest !== 2 && val !== null) {
            if (map.mul !== undefined && typeof val === 'number') val *= map.mul;
            newRow.splice(map.dest, 1, val);
          }
        });
        dataB_Processed.push(newRow);
      });
    }

    let finalData = dataA.concat(dataB_Processed).filter((row, idx) => {
      if (idx === 0) return true;
      let val2 = null, c = 0;
      for (let v of row) { if (c === 2) { val2 = v; break; } c++; }
      return val2 && val2.toString().trim() !== '';
    });

    const colsDel = ['獲得例', '失注例', '必殺トーク', '目標振り返り', '目標達成'];
    let headers = finalData[0] || [];
    const keepIndices = [];
    let c = 0;
    for (let h of headers) { if (!colsDel.includes(h)) keepIndices.push(c); c++; }

    if (keepIndices.length > 0) {
      finalData = finalData.map(row => {
        let newRow = [], c = 0;
        for (let v of row) { if (keepIndices.includes(c)) newRow.push(v); c++; }
        return newRow;
      });
    }

    shC.clear();
    if (finalData.length > 0) {
      const r = finalData.length;
      let col = 0; for (let row of finalData) { col = row.length; break; }
      const cur = shC.getMaxRows(), curC = shC.getMaxColumns();
      if (r   > cur)  shC.insertRowsAfter(cur,  r   - cur);
      if (col > curC) shC.insertColumnsAfter(curC, col - curC);
      shC.getRange(1, 1, r, col).setValues(finalData);
      // B列（勤務日）の表示形式を統一してアプリ側で正しく読み込まれるようにする
      if (r > 1) shC.getRange(2, 2, r - 1, 1).setNumberFormat('yyyy/MM/dd');
    }
    Logger.log('[merge] 日報合算完了');
  } catch (e) {
    Logger.log('[merge] エラー: ' + e.message);
  }
}


// ============================================================
//  [機能④] 日報未提出者への催促メール（毎日21時自動実行）
// ============================================================

function mainToday_ReportReminder() {
  mergeSheets_Complete();
  const targetDate = new Date();
  const staffMap   = getStaffMap_(DAWIN);
  const submitted  = getSubmittedNames_(targetDate, DAWIN);
  const remindList = getUnsubmittedNames_(targetDate, submitted, DAWIN);

  remindList.forEach(shiftName => {
    const email = staffMap[shiftName];
    if (!email) return;
    sendEmailToTalknote_(
      email,
      '【日報提出】',
      shiftName + 'さん\n\n本日中に提出をお願いします！\n\n▼提出フォーム\n' + DAWIN.formUrl
    );
    Logger.log('[催促] ' + shiftName + ' / ' + email);
  });
}


// ============================================================
//  [機能③] 明日のシフト通知メール（毎日18時自動実行）
// ============================================================

function mainTomorrow_ShiftNotify() {
  const staffMap = getStaffMap_(DAWIN);
  if (Object.keys(staffMap).length === 0) return;

  let ss;
  try { ss = SpreadsheetApp.openById(DAWIN.shiftSheetId); } catch(e) { return; }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 当月・前月のシートを両方チェック（月またぎ対応）
  const targetSheetNames = [];
  DAWIN.shiftSheetNames.forEach(base => {
    targetSheetNames.push(Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'yy') + '年' + Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'M') + '月' + base);
    const prev = new Date(tomorrow.getFullYear(), tomorrow.getMonth() - 1, 1);
    targetSheetNames.push(Utilities.formatDate(prev, 'Asia/Tokyo', 'yy') + '年' + Utilities.formatDate(prev, 'Asia/Tokyo', 'M') + '月' + base);
  });

  const userLocations = {};
  for (const name of Object.keys(staffMap)) userLocations[name] = [];

  targetSheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    let activeCols = [], storeColIdx = 3, headerRow = null;

    let rCount = 0;
    for (let row of data) {
      if (rCount >= 10) break;
      let tempCols = [], tempStoreIdx = 3, idx = 0;
      for (let val of row) {
        const cleanVal = String(val).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '');
        if (DAWIN.targetHeaderNames.includes(cleanVal)) tempCols.push(idx);
        if (cleanVal === '店舗') tempStoreIdx = idx;
        idx++;
      }
      if (tempCols.length >= 1) { activeCols = tempCols; storeColIdx = tempStoreIdx; headerRow = row; break; }
      rCount++;
    }
    if (activeCols.length === 0) return;

    let currentShiftDate = null;
    for (let row of data) {
      let cellA = null; let c = 0;
      for (let v of row) { if (c === 0) { cellA = v; break; } c++; }
      if (Object.prototype.toString.call(cellA) === '[object Date]') currentShiftDate = cellA;
      else if (cellA !== '') currentShiftDate = null;

      if (currentShiftDate && isSameDate_(currentShiftDate, tomorrow)) {
        activeCols.forEach(colIdx => {
          let cellName = null, storeName = null, hName = null, c = 0;
          for (let v of row) {
            if (c === colIdx)      cellName  = normalizeName_(v);
            if (c === storeColIdx) storeName = String(v).trim();
            c++;
          }
          if (headerRow) { c = 0; for (let v of headerRow) { if (c === colIdx) hName = v; c++; } }

          if (!/^[0-9０-９\.]+$/.test(cellName) && cellName && cellName.length > 1 && !DAWIN.shiftIgnoreWords.some(w => cellName.includes(w))) {
            const locName = storeName || '勤務地(' + hName + ')';
            for (const userName of Object.keys(staffMap)) {
              if (isNameMatch_(cellName, userName)) userLocations[userName].push(locName);
            }
          }
        });
      }
    }
  });

  // 同じメールアドレスへの重複送信を防ぐ
  const sentEmails = [];
  for (const [shiftName, locations] of Object.entries(userLocations)) {
    const email = staffMap[shiftName];
    if (!email || locations.length === 0 || sentEmails.includes(email)) continue;
    const uniqueLocations = [...new Set(locations)];
    sendEmailToTalknote_(
      email,
      '【明日のシフト連絡】',
      shiftName + 'さん、明日のシフトは「 ' + uniqueLocations.join(' / ') + ' 」です。\n\n※シフト表と相違がある場合は担当まで連絡ください！'
    );
    Logger.log('[シフト通知] ' + shiftName + ' / ' + email);
    sentEmails.push(email);
  }
}
