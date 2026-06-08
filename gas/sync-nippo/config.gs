// ============================================================
//  config.gs
//  【役割】スプレッドシートIDや送信先URLなどの設定値をまとめたファイル
//
//  ここを変更すれば全機能に反映されます。
//  他のファイルは基本的に触らなくてOKです。
//
//  主な設定項目：
//    CONFIG     … VercelアプリのURLとAPIシークレットキー
//    DAWIN      … シフト表・日報フォーム・スタッフ情報のスプレッドシートID
//    STAFF_SYNC … スタッフ情報の転記元スプレッドシート設定
//    SHEET_*    … このスプレッドシート内の各シート名
// ============================================================

const CONFIG = {
  // Vercelアプリの URL（末尾スラッシュなし）
  SYNC_URL:    'https://sales-studio-iota.vercel.app/api/sync',
  SYNC_URL_NEW: 'https://dawin-sales-studio.vercel.app/api/sync',
  // .env.local の SYNC_SECRET と同じ値
  SYNC_SECRET: 'my-super-secret-key-2026',
};

// 各スプレッドシートのID（URLの /d/〇〇〇/ の部分）
const DAWIN = {
  shiftSheetId: '1KmmKchHMKOvCHXp8Qkki6FDa2LMxDKzE_S4zXqxJKM8', // シフト表
  idSheetId:    '1zbZFiAOCtvFfOGEO6mE1jV-Sh99SoaoxHZROzXNdsyE',   // スタッフ情報（このスプレッドシート自身）
  formSheetId1: '1gq06U0WG8ZxMLXP6Hy-hngxTW379Yz3SY2-CJt_BBCE',  // 日報フォーム①
  formSheetId2: '1s8xPwsQ2KyxcfHy9g0zFxaVRSzlK8jrNqN0DzjuaYpE',  // 日報フォーム②
  formUrl:      'https://forms.gle/c2XY1krdoSKbc9Ma8',             // 日報提出フォームURL

  // シフト表のシート名の末尾パターン（「26年4月【東京】」のような形式）
  shiftSheetNames: ['【東京】', '【福岡】'],

  // このスプレッドシート内のシート名
  reportSheetName: '合算データ',
  idSheetName:     'スタッフ情報',

  // シフト表の列番号ヘッダー（スタッフが入る列の見出し）
  targetHeaderNames: ['1','2','3','4','5','6','7','8','9','10','11','12'],

  // 催促・通知を送らない名前キーワード（スタッフ以外の記載）
  ignoreWords:      ['管理費','備品','休み','O','交通費','・','坊薗','橋本','欠員','未定','調整','超サブ','サブ','赤松','重松','犬束','お初','齋藤','印南','中嶋','なし','回答','宮崎','平野'],
  shiftIgnoreWords: ['管理費','備品','休み','O','交通費','・','欠員','未定','調整','超サブ','サブ','なし','回答'],
  ignoreRowWords:   ['管理費','備品'],

  // このプレフィックスで始まる名前は「別人」として扱う（同姓問題の回避）
  distinctPrefixes: ['FFU','salud','✖','EZ','アスクラ','HE','出来れば'],
  ignoreSuffixes:   ['ガール','バルーン'],
};

// スタッフ情報の転記元スプレッドシート設定
const STAFF_SYNC = {
  sourceSpreadsheetId: '1vtXt9UJ87EGtjNEiVYH2R4nUQQdgKmYGMsE04WU-G_A', // 転記元
  sourceSheetName:     'シート1',
  targetSheetName:     'スタッフ情報',
};

// ============================================================
//  内部シート名の定数（シート名を変更したときだけ修正）
// ============================================================

const SHEET_NIPPO    = '合算データ';
const SHEET_AGE      = 'グラフ用データ_年代';
const SHEET_TYPE     = 'グラフ用データ_家族構成';
const SHEET_TALKNOTE = 'トークノート受信録';
const SHEET_JISSEKI  = '実績受信録';
const SHEET_SHURYO   = '終了報告受信録';
const SHEET_EVAL      = '新人進捗';
const SHEET_KNOWLEDGE = '知識';

// ============================================================
//  共通関数
// ============================================================

// 現在の月を 'YYYY-MM' 形式で返す
function getCurrentMonth_() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

// Vercel API にデータを送信する共通処理
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
      const res  = UrlFetchApp.fetch(url, options);
      const body = res.getContentText();
      Logger.log('[sync] ' + payload.type + ' → ' + url + ' → ' + body);
      if (!result) result = JSON.parse(body);
    } catch (e) {
      Logger.log('[sync] エラー (' + url + '): ' + e.message);
    }
  });
  return result;
}
