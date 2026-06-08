// ============================================================
//  sync-eval.gs
//  【役割】育成管理データ（スキル評価＋知識チェック）をDBに送る
//
//  「新人進捗」シート（スキルスコア）と「知識」シート（商品知識の○×）を
//  スタッフ名でひも付けてまとめ、DBへ送信します。
//  アプリの「育成管理」タブに表示されるデータがここから更新されます。
//
//  【手動実行】syncEvaluation()
//    ※シートを更新したあと手動で実行してDBに反映してください
// ============================================================

function syncEvaluation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 1. スキル評価シートを読む（新人進捗） ──────────────────────
  const evalSheet = ss.getSheetByName(SHEET_EVAL);
  if (!evalSheet) { Logger.log(SHEET_EVAL + ' シートが見つかりません'); return; }

  // シートは「横持ち」: 行=カテゴリ、列=スタッフ
  // Row1: 合計点, Row2: 名前, Row3: ポテンシャル, Row4: 出勤, Row5: 属性
  // Row6: 順位, Row7以降: スキルスコア / D列(index3)以降がスタッフデータ
  const evalData = evalSheet.getDataRange().getValues();
  if (evalData.length < 7) { Logger.log(SHEET_EVAL + ' データが不足しています'); return; }

  const META_ROWS      = 6; // 1〜6行目はメタ情報
  const STAFF_START_COL = 3; // D列 = index 3

  // B列(index1)グループ名 + C列(index2)サブ名でスキルキーを決定
  const skillKeys = [];
  let currentGroup = '';
  for (let r = META_ROWS; r < evalData.length; r++) {
    const groupLabel = String(evalData[r][1] || '').trim();
    const subLabel   = String(evalData[r][2] || '').trim();
    if (groupLabel) currentGroup = groupLabel;
    if (!subLabel) continue;

    let key = subLabel;
    if (currentGroup.includes('高齢'))                          key = 'クローズ高齢_' + subLabel;
    else if (currentGroup.includes('若年') || currentGroup.includes('中年')) key = 'クローズ若年_' + subLabel;
    else if (currentGroup.includes('特別'))                     key = 'クローズ特別_' + subLabel;
    else if (currentGroup.includes('メンバー'))                 key = 'メンバー_' + subLabel;
    skillKeys.push({ row: r, key: key });
  }

  const numStaff = evalData[1].length - STAFF_START_COL;
  const staffMap = {};
  for (let c = 0; c < numStaff; c++) {
    const colIdx = STAFF_START_COL + c;
    const name = String(evalData[1][colIdx] || '').trim();
    if (!name) continue;

    const scores = {};
    for (let sk of skillKeys) {
      scores[sk.key] = Number(evalData[sk.row][colIdx]) || 0;
    }

    staffMap[name] = {
      name:       name,
      totalScore: Number(evalData[0][colIdx]) || 0,
      rank:       Number(evalData[5][colIdx]) || 0,
      potential:  String(evalData[2][colIdx] || '').trim(),
      attendance: String(evalData[3][colIdx] || '').trim(),
      attribute:  String(evalData[4][colIdx] || '').trim(),
      supervisor: '',
      scores:     scores,
      knowledge:  {},
      knowledgeItems: [],
    };
  }

  // ── 2. 知識シートを読む ──────────────────────────────────────
  const knSheet = ss.getSheetByName(SHEET_KNOWLEDGE);
  if (!knSheet) {
    Logger.log(SHEET_KNOWLEDGE + ' シートが見つかりません。スキル評価のみ送信します。');
  } else {
    const knData = knSheet.getDataRange().getValues();
    if (knData.length >= 3) {
      // Row1(index0)・Row2(index1): ヘッダー（商品名はRow2を優先）
      // Col A(index0): スタッフ名, Col B(index1): 担当, Col C+(index2+): ○/×
      const productNames = [];
      for (let c = 2; c < knData[1].length; c++) {
        const h2 = String(knData[1][c] || '').trim();
        const h1 = String(knData[0][c] || '').trim();
        productNames.push(h2 || h1);
      }
      const validProducts = productNames.map(function(n, i) { return { idx: i, name: n }; })
                                        .filter(function(p) { return p.name; });

      for (let r = 2; r < knData.length; r++) {
        const staffName  = String(knData[r][0] || '').trim();
        const supervisor = String(knData[r][1] || '').trim();
        if (!staffName) continue;

        const knowledge = {};
        for (let p of validProducts) {
          const val = String(knData[r][2 + p.idx] || '').trim();
          knowledge[p.name] = (val === '○' || val === 'O' || val === '〇');
        }

        if (staffMap[staffName]) {
          staffMap[staffName].supervisor     = supervisor;
          staffMap[staffName].knowledge      = knowledge;
          staffMap[staffName].knowledgeItems = validProducts.map(function(p) { return p.name; });
        } else {
          staffMap[staffName] = {
            name: staffName, totalScore: 0, rank: 999,
            potential: '', attendance: '', attribute: '',
            supervisor: supervisor, scores: {},
            knowledge: knowledge,
            knowledgeItems: validProducts.map(function(p) { return p.name; }),
          };
        }
      }
    }
  }

  // ── 3. APIへ送信 ────────────────────────────────────────────
  const staffList = Object.values(staffMap);
  if (staffList.length === 0) { Logger.log('[育成同期] スタッフデータが0件です'); return; }

  callSyncApi_({
    type:  'evaluation',
    month: getCurrentMonth_(),
    staff: staffList,
  });
  Logger.log('[育成同期] ' + staffList.length + '名のデータを送信しました');
}
