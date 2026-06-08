function checkEditorAndColor(e) {
  // --- 設定エリア ---
  const targetSheetName =  "26年5月【東京】"; // ★ここに限定したいシート名を正確に入力してください
  const targetUser = "izumi.kohori@approg.com"; // 検知したいユーザーのメールアドレス
  const targetColumns = [6, 7, 86]; // F列(6), G列(7), CH列(86) の列番号
  const colorCode = "#00ffff"; // CL列に付ける色（水色）
  const clColumn = 90; // CL列の列番号 (A=1... CL=90)
  // ------------------

  // 編集されたシートを取得
  const sheet = e.source.getActiveSheet();
  const currentSheetName = sheet.getName();

  // まず、編集されたシート名が指定のものでなければ処理を終了する
  if (currentSheetName !== targetSheetName) {
    return;
  }

  // 編集された範囲、列、行を取得
  const range = e.range;
  const col = range.getColumn();
  const row = range.getRow();

  // 対象の列が編集されたかチェック
  if (targetColumns.includes(col)) {
    // 編集したユーザーのメールアドレスを取得
    const userEmail = e.user.getEmail();

    // 特定のユーザーが変更した場合のみ実行
    if (userEmail === targetUser) {
      // 編集された行のCL列のセルに色を付ける
      sheet.getRange(row, clColumn).setBackground(colorCode);
    }
  }
}