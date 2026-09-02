// ============================================================
//  triggers.gs
//  【役割】GASの自動実行スケジュール（トリガー）を管理するファイル
//
//  ⚠️ アカウントによって実行する関数が異なります
//
//  【dawinmobilebot@gmail.com で実行】
//    setupTriggers_Bot() … Talknote取得・DB同期・通知メール
//
//  【shohei.hashimoto@m.dawin.co.jp で実行】
//    setupTriggers_Calendar() … カレンダー同期のみ
//
//  【トリガーを削除したいとき】
//    clearTriggers() … 実行したアカウントのトリガーだけ削除されます
//    ※ 別アカウントのトリガーは削除されないので、両方のアカウントで実行が必要
// ============================================================


/**
 * setupTriggers_Bot()
 * ▶ dawinmobilebot@gmail.com でログインした状態で実行してください
 *
 *   ① Talknoteメール取得   15分おき → fetchAndSyncTalknote
 *   ② DB同期              1時間おき → syncAll
 *   ③ 明日のシフト通知     毎日18時  → mainTomorrow_ShiftNotify
 *   ④ 日報催促            毎日21時  → mainToday_ReportReminder
 *   ⑤ シート編集時の即時同期 編集のたびに → onEditTrigger
 */
function setupTriggers_Bot() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('onEditTrigger').forSpreadsheet(ss).onEdit().create();                    // ⑤ 編集時
  ScriptApp.newTrigger('fetchAndSyncTalknote').timeBased().everyMinutes(15).create();            // ① 15分おき
  ScriptApp.newTrigger('syncAll').timeBased().everyHours(1).create();                           // ② 1時間おき
  ScriptApp.newTrigger('mainTomorrow_ShiftNotify').timeBased().atHour(18).everyDays(1).create(); // ③ 18時
  ScriptApp.newTrigger('mainToday_ReportReminder').timeBased().atHour(21).everyDays(1).create(); // ④ 21時

  Logger.log('Bot用トリガーを設定しました ✅（dawinmobilebot@gmail.com）');
}


/**
 * setupTriggers_Calendar()
 * ▶ shohei.hashimoto@m.dawin.co.jp でログインした状態で実行してください
 *
 *   ⑦ カレンダー同期 毎日4時 → syncWeeklyStaffCalendar
 */
function setupTriggers_Calendar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncWeeklyStaffCalendar').timeBased().atHour(4).everyDays(1).create();   // ⑦ 4時

  Logger.log('カレンダー用トリガーを設定しました ✅（shohei.hashimoto@m.dawin.co.jp）');
}


/**
 * clearTriggers()
 * 実行したアカウントのトリガーだけを削除します。
 * 両アカウントのトリガーを全削除したい場合は、それぞれのアカウントで実行してください。
 */
function clearTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('トリガーを削除しました');
}
