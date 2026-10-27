/**
 * 日報フォーム「日報（2022年12月～）」をアプリから代理送信するための定義。
 *
 * 送信先は今までと同じ Google フォームなので、元スプレッド → 合算 → アプリの流れは変わらない。
 * entry ID はフォームの各質問の内部ID（フォームの HTML の FB_PUBLIC_LOAD_DATA_ から取得）。
 * フォームの質問を追加・削除・作り直したら、ここも合わせて直すこと。
 */

export const NIPPO_FORM_ID = '1FAIpQLSes2Ux9bbQ0DffeEcbCuMUo6IXemj5r1gExdm8s9G48FIv-bw';

// 試験運用中はこの人だけに表示・送信を許可する（フォームの名前プルダウンと同じ表記）
export const NIPPO_FORM_USERS = ['中村翔'];

export const ENTRY = {
  date: '1433109843',
  name: '1797495087',
  storeType: '969123927',
  area: '682911630',
  location: '890086368',
} as const;

// 自社ブースは無くなったので、送るのは「業務委託」か「研修」のどちらか
export const STORE_TYPE_WORK = '業務委託（ブース稼働・店内稼働）';
export const STORE_TYPE_TRAINING = '研修';

export const AREAS = ['関東', '九州', '北海道・東北・北陸・中部'];

export const GOAL_CHOICES = ['◎', '×', '書き忘れ！次回忘れずに！'];

export type NippoField = {
  key: string;
  entry: string;
  label: string;
  hint?: string;
  kind: 'number' | 'text' | 'textarea' | 'goal';
  required?: boolean;
};

export type NippoSection = {
  title: string;
  hint?: string;
  training?: boolean; // 研修の日も入力するセクション
  fields: NippoField[];
};

export const NIPPO_SECTIONS: NippoSection[] = [
  {
    title: '実績',
    hint: '換算後のカウントを入力（フォームと同じ）',
    fields: [
      { key: 'mnpDevice', entry: '584999881', label: 'MNP（端末つき）', hint: '1件→1.2', kind: 'number' },
      { key: 'mnpSim', entry: '1712098526', label: 'MNP（sim単）', hint: '1件→1', kind: 'number' },
      { key: 'shin', entry: '1230700764', label: '純新規', hint: 'U18・O60 1件→0.8 / それ以外 1件→0.1（キッズケータイは対象外）', kind: 'number' },
      { key: 'kihen', entry: '1774034835', label: '機種変更', hint: '1件→0.1（au→UQのセルダウン含む）', kind: 'number' },
      { key: 'cellUp', entry: '1091675989', label: '機種変更（セルアップ）', hint: '1件→0.6', kind: 'number' },
      { key: 'hikariNew', entry: '1421244134', label: 'ひかり（新規）', hint: '光新規 1件→1 / 固定代替え 1件→0.5', kind: 'number' },
      { key: 'hikariTenyo', entry: '1835990490', label: 'ひかり（転用・事業者変更）', hint: '1件→0.8', kind: 'number' },
      { key: 'hikariCable', entry: '793928834', label: 'ひかり（ケーブル）', hint: 'ケーブルトス 1件→0.2 / ジェイコム同席で工事日がその場で決まった 1件→0.5', kind: 'number' },
      { key: 'tablet', entry: '897029006', label: 'タブレット', hint: '1件→0.2', kind: 'number' },
      { key: 'denki', entry: '1501165980', label: 'でんき・ガス', hint: '1件→0.1', kind: 'number' },
      { key: 'credit', entry: '1014539532', label: 'クレカ・自銀', hint: 'ゴールド 0.3 / シルバー 0.1 / 自銀 0.1', kind: 'number' },
      { key: 'selfClose', entry: '973447314', label: '合計自己クロ', kind: 'number' },
      { key: 'seated', entry: '2131159871', label: '着座数', hint: '1組1件（3人家族を着座させたら1）', kind: 'number' },
      { key: 'eventMnp', entry: '1267263058', label: 'イベント販売台数（MNP）', kind: 'number' },
    ],
  },
  {
    title: '分析',
    hint: '獲得組数で記載（ダブクロの場合は折半）',
    fields: [
      { key: 'groups', entry: '1996799932', label: '総獲得組数', hint: 'MNPの獲得組数', kind: 'number' },
      { key: 'age2030', entry: '1841191394', label: '年齢 20代〜30代', kind: 'number' },
      { key: 'age4060', entry: '1507869127', label: '年齢 40代〜60代', kind: 'number' },
      { key: 'age60', entry: '1447520377', label: '年齢 60代〜', kind: 'number' },
      { key: 'single', entry: '1642062889', label: '構成 シングル', kind: 'number' },
      { key: 'pair', entry: '1307559664', label: '構成 2名', hint: '夫婦・親子など、子どもがいても回線数が2ならこちら', kind: 'number' },
      { key: 'family', entry: '1166243301', label: '構成 家族（3名以上）', kind: 'number' },
    ],
  },
  {
    title: '所感',
    fields: [
      { key: 'winExample', entry: '2049868143', label: '獲得例', hint: '年齢や元キャリア、プランなど', kind: 'textarea' },
      { key: 'lossExample', entry: '1668466374', label: '失注例', hint: '切り返せなかった内容など。なければ知りたいことでもOK', kind: 'textarea' },
      { key: 'killerTalk', entry: '1190453645', label: '必殺トーク', hint: '即決・クロージング・着座のときに効いた一言', kind: 'textarea' },
      { key: 'goalReview', entry: '352046655', label: '目標振り返り', hint: 'WPで記入した目標（例：着座5件、MNP3件）', kind: 'text', required: true },
      { key: 'goalResult', entry: '1225387012', label: '目標達成', kind: 'goal', required: true },
    ],
  },
  {
    title: '交通費',
    training: true,
    fields: [
      { key: 'fare', entry: '1677579059', label: '往復交通費（公共交通機関）', kind: 'number', required: true },
      { key: 'taxi', entry: '23584606', label: 'タクシー代、有料特急', hint: '事前承諾が必要。領収書は社員に渡してね', kind: 'number', required: true },
    ],
  },
];

// フォームのページ番号（0始まり）。業務委託は全ページ、研修は1ページ目から交通費へ直行する
const PAGES_WORK = '0,1,2,3,4,5,6,7';
const PAGES_TRAINING = '0,7';

export type NippoSubmission = {
  date: string; // YYYY-MM-DD
  area: string;
  location: string;
  training: boolean;
  values: Record<string, string>;
};

/** 入力内容の不備を返す（問題なければ空配列） */
export function validateNippo(s: NippoSubmission): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errors.push('勤務日を入力してください');
  if (!AREAS.includes(s.area)) errors.push('勤務エリアを選んでください');
  if (!s.location.trim()) errors.push('勤務地を入力してください');
  for (const section of NIPPO_SECTIONS) {
    if (s.training && !section.training) continue;
    for (const f of section.fields) {
      const v = (s.values[f.key] ?? '').trim();
      if (f.required && !v) errors.push(`${f.label}を入力してください`);
      if (f.kind === 'number' && v && !/^\d+(\.\d+)?$/.test(v)) errors.push(`${f.label}は数字で入力してください`);
      if (f.kind === 'goal' && v && !GOAL_CHOICES.includes(v)) errors.push(`${f.label}を選んでください`);
    }
  }
  return errors;
}

/** Google フォームの formResponse に送る本文を組み立てる */
export function buildFormBody(s: NippoSubmission, name: string): URLSearchParams {
  const [y, m, d] = s.date.split('-');
  const body = new URLSearchParams();
  body.append(`entry.${ENTRY.date}_year`, y);
  body.append(`entry.${ENTRY.date}_month`, String(parseInt(m)));
  body.append(`entry.${ENTRY.date}_day`, String(parseInt(d)));
  body.append(`entry.${ENTRY.name}`, name);
  body.append(`entry.${ENTRY.storeType}`, s.training ? STORE_TYPE_TRAINING : STORE_TYPE_WORK);
  body.append(`entry.${ENTRY.area}`, s.area);
  body.append(`entry.${ENTRY.location}`, s.location.trim());
  for (const section of NIPPO_SECTIONS) {
    if (s.training && !section.training) continue;
    for (const f of section.fields) {
      const v = (s.values[f.key] ?? '').trim();
      if (v) body.append(`entry.${f.entry}`, v);
    }
  }
  body.append('pageHistory', s.training ? PAGES_TRAINING : PAGES_WORK);
  body.append('fvv', '1');
  return body;
}
