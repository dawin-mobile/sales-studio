/**
 * sync-shift.gs
 * ───────────────────────────────────────────────
 * 【使い方】
 * 1. シフトスプレッドシートを開く
 * 2. 拡張機能 → Apps Script
 * 3. このファイルの中身を全部貼り付けて保存
 * 4. setupTriggers() を一度だけ実行してトリガーを登録
 * ───────────────────────────────────────────────
 */

// ========== 設定（ここだけ変更してください） ==========
const CONFIG = {
  SYNC_URL: 'https://sales-studio-iota.vercel.app/api/sync',
  SYNC_URL_NEW: 'https://dawin-sales-studio.vercel.app/api/sync',
  SYNC_SECRET: 'my-super-secret-key-2026',
};
// ======================================================

// 東京・福岡のスタッフ列範囲
const REGION_COLS = {
  '東京': { staffStart: 7, staffEnd: 19, agencyIdx: 19 },
  '福岡': { staffStart: 7, staffEnd: 11, agencyIdx: 11 },
};

// /api/sync にPOSTする共通処理
function callSyncApi_(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.SYNC_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  let result = null;
  [CONFIG.SYNC_URL, CONFIG.SYNC_URL_NEW].forEach(function(url) {
    try {
      const res = UrlFetchApp.fetch(url, options);
      const body = res.getContentText();
      Logger.log('[sync] ' + payload.type + ' → ' + url + ' → ' + body);
      if (!result) result = JSON.parse(body);
    } catch (e) {
      Logger.log('[sync] エラー (' + url + '): ' + e.message);
    }
  });
  return result;
}

// 現在の月を 'YYYY-MM' 形式で返す
function getCurrentMonth_() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

// 'YYYY-MM' → 'YY年M月【東京】' 形式に変換
function buildSheetName_(month, region) {
  const parts = month.split('-');
  const yy = parts[0].slice(2);
  const m = String(parseInt(parts[1]));
  return yy + '年' + m + '月【' + region + '】';
}

// B列の背景色がオレンジ系かどうか（祝日判定）
// GAS の getBackgrounds() は '#rrggbb' 形式で返す
function isOrangeHex_(hex) {
  if (!hex || hex === '#ffffff' || hex === '#000000') return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return r > 0.7 && g > 0.1 && g < 0.88 && b < 0.45 && r > g + 0.08;
}

// ヘッダー行からスタッフ名を抽出（startIdx列から「クロ」の手前まで）
function extractStaffNames_(headerRow, startIdx) {
  const kuroIdx = headerRow.indexOf('クロ', startIdx);
  const endIdx = kuroIdx >= 0 ? kuroIdx : headerRow.length;
  const names = [];
  const seen = {};
  for (let i = startIdx; i < endIdx; i++) {
    const v = String(headerRow[i] || '').trim();
    if (v && v !== '-' && !seen[v]) {
      names.push(v);
      seen[v] = true;
    }
  }
  return names;
}

// シフトシートをパースして ShiftRow[] を返す
function parseShiftRows_(sheet, region) {
  const cfg = REGION_COLS[region];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // 値と背景色を取得
  const rawValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  // B列（インデックス1）の背景色を取得
  const bColBgs = sheet.getRange(1, 2, lastRow, 1).getBackgrounds();

  // 各セルを文字列に変換（日付セルは "M/D" 形式に）
  const values = rawValues.map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) return (cell.getMonth() + 1) + '/' + cell.getDate();
      return cell;
    });
  });

  // 祝日の日付セットを作成
  const holidayDates = new Set();
  for (let i = 0; i < lastRow; i++) {
    if (isOrangeHex_(bColBgs[i][0])) {
      const dateStr = String(values[i][0] || '');
      if (dateStr && /\d/.test(dateStr)) holidayDates.add(dateStr);
    }
  }

  // ヘッダー行（インデックス2 = 3行目）からスタッフ名を抽出
  const headerRow = (values[2] || []).map(String);
  const staffStartForNames = region === '東京' ? 24 : 16;
  const staffNames = extractStaffNames_(headerRow, staffStartForNames);

  // データ行をパース
  const shiftRows = [];
  for (let i = 0; i < lastRow; i++) {
    const row = values[i].map(String);
    const date = row[0] || '';
    if (!date || !/\d/.test(date)) continue; // 日付なし行をスキップ
    if (row[4] === '場所') continue;          // 副行をスキップ

    const staffNameSet = staffNames.length > 0 ? new Set(staffNames) : null;
    const staff = [];
    for (let c = cfg.staffStart; c < cfg.staffEnd; c++) {
      const v = (row[c] || '').trim();
      if (!v) continue;
      // アスクラ・saludを含む名前は常にスタッフとして認識
      const isAlwaysStaff = v.indexOf('アスクラ') !== -1 || v.indexOf('salud') !== -1;
      if (isAlwaysStaff || !staffNameSet || staffNameSet.has(v)) staff.push(v);
    }

    shiftRows.push({
      date: date,
      dayOfWeek: row[1] || '',
      location: row[3] || '',
      startTime: row[4] || '',
      order1: row[5] || '',
      order2: row[6] || '',
      staff: staff,
      finalStaff: row[21] || '',
      agency: row[cfg.agencyIdx] || '',
      isHoliday: holidayDates.has(date),
    });
  }

  return { shiftRows: shiftRows, staffNames: staffNames };
}

// 社員シフトシートをパース
function parseEmployeeShift_(month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('【社員】');
  if (!sheet) { Logger.log('【社員】シートが見つかりません'); return null; }

  const mo = parseInt(month.split('-')[1]);
  const firstDayPattern = mo + '/1';
  const nextMo = mo === 12 ? 1 : mo + 1;
  const nextMonthPattern = nextMo + '/1';

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues().map(function(r) {
    return r.map(function(cell) {
      // 日付セルは "M/D" 形式（例: "3/1"）に変換
      if (cell instanceof Date) return (cell.getMonth() + 1) + '/' + cell.getDate();
      return String(cell);
    });
  });

  // スタッフ名行（インデックス2 = 3行目）
  const staffRow = values[2] || [];

  // 対象月の開始列を探す
  let startCol = -1;
  for (let i = 3; i < lastRow && startCol === -1; i++) {
    const row = values[i];
    for (let col = 0; col < row.length; col++) {
      if (row[col].trim() === firstDayPattern) { startCol = col; break; }
    }
  }
  if (startCol === -1) { Logger.log('対象月の開始列が見つかりません: ' + month); return null; }

  const staffColStart = startCol + 2;

  // 次の月の開始列（終了列）を探す
  let endCol = lastCol;
  outer: for (let i = 3; i < lastRow; i++) {
    const row = values[i];
    for (let col = startCol + 1; col < row.length; col++) {
      if (row[col].trim() === nextMonthPattern) { endCol = col; break outer; }
    }
  }

  // スタッフ名リスト
  const staffWithCol = [];
  for (let col = staffColStart; col < endCol; col++) {
    const name = (staffRow[col] || '').trim();
    if (name) staffWithCol.push({ name: name, col: col });
  }

  // データ行を解析
  const dates = [];
  const cells = {};

  for (let i = 3; i < lastRow; i++) {
    const row = values[i];
    const rawDate = (row[startCol] || '').trim();
    if (!rawDate) continue;

    const parts = rawDate.split('/');
    if (parts.length !== 2) continue;
    const mm = parseInt(parts[0]);
    const dd = parseInt(parts[1]);
    if (mm !== mo || isNaN(dd) || dd < 1 || dd > 31) continue;

    const dateStr = String(mm).padStart(2, '0') + '/' + String(dd).padStart(2, '0');
    const dayOfWeek = (row[startCol + 1] || '').trim();
    dates.push({ date: dateStr, dayOfWeek: dayOfWeek });
    cells[dateStr] = {};

    staffWithCol.forEach(function(s) {
      cells[dateStr][s.name] = (row[s.col] || '').trim();
    });
  }

  return {
    staff: staffWithCol.map(function(s) { return s.name; }),
    dates: dates,
    cells: cells,
  };
}

// ──────────────────────────────────────────────
// 同期処理
// ──────────────────────────────────────────────

// シフト（東京・福岡）を同期
function syncShift(month) {
  month = month || getCurrentMonth_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const tokyoName   = buildSheetName_(month, '東京');
  const fukuokaName = buildSheetName_(month, '福岡');

  const tokyoSheet   = ss.getSheetByName(tokyoName);
  const fukuokaSheet = ss.getSheetByName(fukuokaName);

  const tokyoResult   = tokyoSheet   ? parseShiftRows_(tokyoSheet,   '東京') : { shiftRows: [], staffNames: [] };
  const fukuokaResult = fukuokaSheet ? parseShiftRows_(fukuokaSheet, '福岡') : { shiftRows: [], staffNames: [] };

  callSyncApi_({
    type: 'shift',
    month: month,
    tokyoRows: tokyoResult.shiftRows,
    fukuokaRows: fukuokaResult.shiftRows,
    tokyoStaffNames: tokyoResult.staffNames,
    fukuokaStaffNames: fukuokaResult.staffNames,
  });
}

// 社員シフトを同期
function syncEmployeeShift(month) {
  month = month || getCurrentMonth_();
  const data = parseEmployeeShift_(month);
  if (!data) return;

  callSyncApi_({
    type: 'employee-shift',
    month: month,
    staff: data.staff,
    dates: data.dates,
    cells: data.cells,
  });
}

// 全シートを一括同期（当月・翌月・翌々月）
function syncAll() {
  const now = new Date();
  for (let i = 0; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    Logger.log('シフト同期開始: ' + month);
    syncShift(month);
    syncEmployeeShift(month);
    Logger.log('シフト同期完了: ' + month);
  }
}

// 過去N月分を自動同期（月をまたいでも変更不要）
function syncPastMonths() {
  const MONTHS_BACK = 6; // 何ヶ月前まで同期するか
  const now = new Date();
  for (let i = 1; i <= MONTHS_BACK; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    Logger.log('同期中: ' + month);
    syncShift(month);
    syncEmployeeShift(month);
  }
  Logger.log('過去月の同期完了');
}

// ──────────────────────────────────────────────
// 編集トリガー
// ──────────────────────────────────────────────
function onEditTrigger(e) {
  const sheetName = e.source.getActiveSheet().getName();

  // "26年5月【東京】" のようなシート名から月を逆算
  const match = sheetName.match(/^(\d{2})年(\d{1,2})月【(東京|福岡)】$/);
  if (match) {
    const month = '20' + match[1] + '-' + String(parseInt(match[2])).padStart(2, '0');
    syncShift(month);
    return;
  }

  if (sheetName === '【社員】') {
    syncEmployeeShift(getCurrentMonth_());
  }
}

// ──────────────────────────────────────────────
// トリガー設定（最初に一度だけ実行してください）
// ──────────────────────────────────────────────
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // 編集トリガー
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // 1時間ごとの定期同期（編集時はonEditTriggerで即時同期されるため保険として十分）
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('トリガーを設定しました ✅');
}

function clearTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  Logger.log('トリガーを削除しました');
}

function syncMay() {
  syncShift('2026-05');
  syncEmployeeShift('2026-05');
}
