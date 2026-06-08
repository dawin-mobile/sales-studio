// ============================================================
//  sync-db.gs
//  【役割】スプレッドシートの内容をVercelアプリのDBへ送信する
//
//  合算データ・年代・家族構成・トークノートの各シートを読み取り、
//  APIを通じてデータベースに書き込みます。
//
//  【自動実行】1時間おき → syncAll()
//  【手動実行】
//    syncAll()           … 今すぐ全シートを同期
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

// 年代シートをDBへ送る
function syncAgeSheet(month) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_AGE);
  if (!sheet) { Logger.log(SHEET_AGE + ' が見つかりません'); return; }

  const rows = sheet.getDataRange().getValues().map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) return cell.toISOString();
      return String(cell);
    });
  });
  callSyncApi_({ type: 'age', month: month || getCurrentMonth_(), rows: rows });
}

// 家族構成シートをDBへ送る
function syncTypeSheet(month) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TYPE);
  if (!sheet) { Logger.log(SHEET_TYPE + ' が見つかりません'); return; }

  const rows = sheet.getDataRange().getValues().map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) return cell.toISOString();
      return String(cell);
    });
  });
  callSyncApi_({ type: 'type', month: month || getCurrentMonth_(), rows: rows });
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

// 全シートを現在月で一括同期（10分おき自動実行 / 手動実行も可）
// ※トークノートは fetchAndSyncTalknote（5分おき）が別途同期するため除外
function syncAll() {
  const jstHour = new Date().getHours();
  if (jstHour >= 1 && jstHour < 9) return;
  const month = getCurrentMonth_();
  Logger.log('DB同期開始: ' + month);
  syncNippoSheet(month);
  syncAgeSheet(month);
  syncTypeSheet(month);
  Logger.log('DB同期完了');
}

// 特定の月のデータをDBに入れ直したい場合は month を書き換えて手動実行
function syncSpecificMonth() {
  const month = '2026-03'; // ← ここを変更して実行してください（例：'2026-05'）
  syncNippoSheet(month);
  syncAgeSheet(month);
  syncTypeSheet(month);
}
