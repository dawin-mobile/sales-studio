/**
 * send-staff-id.gs
 *
 * 関東アルバイトに社員IDをTalknoteメールで一斉送信する（一度だけ使う）
 *
 * 【手順】
 *   1. このスクリプトを スタッフ情報スプレッドシート のGASエディタに貼り付ける
 *   2. まず dryRun() を実行して送信対象を確認する
 *   3. 問題なければ sendStaffIds() を実行する
 */

// ── 設定 ──────────────────────────────────────────────────────
const STAFF_SHEET_NAME = 'スタッフ情報';

// 送信するメッセージ本文（{name} と {id} は自動置換）
const MESSAGE_TEMPLATE = `{name}さん

Sales Studio へのログインIDをお知らせします。

　社員番号：{id}

パスワードは別途お知らせします。
不明な点があればお気軽にご連絡ください！`;
// ─────────────────────────────────────────────────────────────

/**
 * 本番送信
 */
function sendStaffIds() {
  const targets = getTargets_();
  if (targets.length === 0) {
    Logger.log('送信対象が見つかりませんでした');
    return;
  }

  Logger.log('送信対象: ' + targets.length + '名');
  let successCount = 0;

  for (const t of targets) {
    const body = MESSAGE_TEMPLATE
      .replace('{name}', t.name)
      .replace('{id}', t.staffId);
    try {
      GmailApp.sendEmail(t.email, '【Sales Studio】ログインIDのお知らせ', body, { name: 'Dawin Bot' });
      Logger.log('✅ 送信: ' + t.name + ' (' + t.email + ') ID=' + t.staffId);
      successCount++;
    } catch (e) {
      Logger.log('❌ 失敗: ' + t.name + ' / ' + e.message);
    }
  }

  Logger.log('完了: ' + successCount + '/' + targets.length + '名に送信しました');
}

/**
 * 送信前確認用（メールは送らず対象者一覧をログに出力）
 */
function dryRun() {
  const targets = getTargets_();
  Logger.log('=== 送信対象（ドライラン）: ' + targets.length + '名 ===');
  for (const t of targets) {
    Logger.log(t.name + ' / ID: ' + t.staffId + ' / 送信先: ' + t.email);
  }
}

/**
 * 対象者（関東・アルバイト・在籍中）を抽出する
 */
function getTargets_() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!sheet) {
    Logger.log(STAFF_SHEET_NAME + ' シートが見つかりません');
    return [];
  }

  const data    = sheet.getDataRange().getValues();
  const targets = [];

  for (let i = 1; i < data.length; i++) {
    const row     = data[i];
    const base    = String(row[1]  ?? '').trim(); // B列: 拠点
    const staffId = String(row[3]  ?? '').trim(); // D列: 社員ID
    const email   = String(row[15] ?? '').trim(); // P列: Talknoteアドレス
    const name    = String(row[19] ?? '').trim(); // T列: 名前
    const role    = String(row[22] ?? '').trim(); // W列: ロール
    const active  = String(row[23] ?? '').trim().toUpperCase(); // X列: 在籍

    if (base !== '関東') continue;
    if (role !== 'アルバイト' && role !== '業務委託') continue;
    if (active !== 'TRUE') continue;
    if (!name || !staffId || !email || !email.includes('@')) continue;

    targets.push({ name, staffId, email });
  }

  return targets;
}
