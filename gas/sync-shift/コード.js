/**
 * 【メイン機能】指定したシートの「プラワン」セルの色を基準に範囲内をカウントする
 */
function getCountByPlatinumColor(sheetName, rangeStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  // 1. シート全体から「プラワン」という文字のセルを探す
  var data = sheet.getDataRange().getValues();
  var targetColor = null;

  for (var r = 0; r < data.length; r++) {
    for (var c = 0; c < data[r].length; c++) {
      if (data[r][c] === "プラワン") {
        // 見つかったセルの背景色を取得
        targetColor = sheet.getRange(r + 1, c + 1).getBackground();
        break;
      }
    }
    if (targetColor) break;
  }

  // 「プラワン」がない、または色が塗られていない(白)場合は0を返す
  if (!targetColor || targetColor === "#ffffff") return 0;

  // 2. 指定範囲(H4:S448)の色をカウント
  var range = sheet.getRange(rangeStr);
  var backgrounds = range.getBackgrounds();
  var count = 0;

  for (var i = 0; i < backgrounds.length; i++) {
    for (var j = 0; j < backgrounds[i].length; j++) {
      if (backgrounds[i][j] === targetColor) {
        count++;
      }
    }
  }
  return count;
}

/**
 * 【トリガー用】毎日自動で実行して、集計シートに結果を書き込む
 */
function dailyUpdateAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- 設定エリア ---
  var summarySheetName = "集計"; // 結果を書き込むシート名
  var rangeToCount = "H4:S448"; // カウントする範囲
  // -----------------

  var summarySheet = ss.getSheetByName(summarySheetName);
  if (!summarySheet) {
    // 集計シートがなければ作成
    summarySheet = ss.insertSheet(summarySheetName);
  }

  // シート一覧を取得し、名前に「【東京】」が含まれるシートをループ
  var sheets = ss.getSheets();
  var results = [["シート名", "カウント結果", "更新日時"]];

  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName();
    
    // 「【東京】」という文字が含まれるシートだけを集計対象にする
    if (sName.indexOf("【東京】") > -1) {
      var count = getCountByPlatinumColor(sName, rangeToCount);
      results.push([sName, count, new Date()]);
    }
  }

  // 集計シートのA1セルから結果を書き出す
  summarySheet.getRange(1, 1, results.length, results[0].length).setValues(results);
}