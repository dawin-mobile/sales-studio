// ============================================================
//  triggers.gs
//  【役割】GASの自動実行スケジュール（トリガー）を管理するファイル
//
//  各機能をいつ自動実行するかをここで設定します。
//  間隔を変えたいときはこのファイルの setupTriggers() を修正して再実行します。
//
//  【初回セットアップ・設定変更時】setupTriggers() を実行
//    → 既存トリガーをすべて削除してから正しい内容で再登録されます
//  【トリガーを全削除したいとき】clearTriggers() を実行
// ============================================================

/**
 * setupTriggers() — 全トリガーを設定する
 *
 * 実行すると以下が自動登録されます：
 *   ① Talknoteメール取得         15分おき  → fetchAndSyncTalknote
 *   ② スプレッドシート→DB同期    1時間おき → syncAll
 *   ③ 明日のシフト通知           毎日18時   → mainTomorrow_ShiftNotify
 *   ④ 日報未提出催促             毎日21時   → mainToday_ReportReminder
 *   ⑤ スタッフ情報同期           毎日 6時   → syncStaffInfo_New
 *   ⑥ カレンダー更新             毎日 4時   → syncWeeklyStaffCalendar
 *   ⑦ シート編集時の即時同期     編集のたびに → onEditTrigger
 *
 * ※既存のトリガーはすべて削除してから再設定します
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('onEditTrigger').forSpreadsheet(ss).onEdit().create();                        // ⑦ 編集時
  ScriptApp.newTrigger('fetchAndSyncTalknote').timeBased().everyMinutes(15).create();                // ① 15分おき
  ScriptApp.newTrigger('syncAll').timeBased().everyHours(1).create();                               // ② 1時間おき
  ScriptApp.newTrigger('mainTomorrow_ShiftNotify').timeBased().atHour(18).everyDays(1).create();     // ③ 18時
  ScriptApp.newTrigger('mainToday_ReportReminder').timeBased().atHour(21).everyDays(1).create();     // ④ 21時
  ScriptApp.newTrigger('syncStaffInfo_New').timeBased().atHour(6).everyDays(1).create();             // ⑤ 6時
  ScriptApp.newTrigger('syncWeeklyStaffCalendar').timeBased().atHour(4).everyDays(1).create();       // ⑥ 4時

  Logger.log('トリガーを設定しました ✅');
}

// トリガーをすべて削除したい場合に実行
function clearTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('トリガーを削除しました');
}
