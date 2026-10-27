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

// スタッフ情報 B列「拠点」→ フォームの勤務エリア。拠点が空・想定外なら関東
export function areaFromBase(base: string | undefined): string {
  return base?.trim() === '九州' ? '九州' : '関東';
}

export type NippoField = {
  key: string;
  entry: string;
  label: string;
  hint?: string;
  kind: 'number' | 'textarea';
  required?: boolean;
  // ＋ボタン1回で増える数。換算値の半分（ダブクロの折半）を1回分にする。換算の違うものが混ざる欄はボタンを分ける
  // label はどの種類のボタンかのコード上の目印（画面には出さない）
  steps?: { value: number; label?: string }[];
  copyTotal?: boolean; // 「実績と同じ」ボタン（実績の合計を入れる）を出す
};

export type NippoSection = {
  title: string;
  hint?: string;
  always?: boolean; // 0だった日・研修の日も入力するセクション
  fields: NippoField[];
};

export const NIPPO_SECTIONS: NippoSection[] = [
  {
    title: '実績',
    fields: [
      { key: 'mnpDevice', entry: '584999881', label: 'MNP（端末つき）', hint: '1件→1.2', kind: 'number', steps: [{ value: 0.6 }] },
      { key: 'mnpSim', entry: '1712098526', label: 'MNP（sim単）', hint: '1件→1', kind: 'number', steps: [{ value: 0.5 }] },
      { key: 'shin', entry: '1230700764', label: '純新規', hint: 'U18・O60 1件→0.8 / それ以外 1件→0.1（キッズケータイは対象外）', kind: 'number', steps: [{ value: 0.4, label: 'U18・O60' }, { value: 0.05, label: 'その他' }] },
      { key: 'kihen', entry: '1774034835', label: '機種変更', hint: '1件→0.1（au→UQのセルダウン含む）', kind: 'number', steps: [{ value: 0.05 }] },
      { key: 'cellUp', entry: '1091675989', label: '機種変更（セルアップ）', hint: '1件→0.6', kind: 'number', steps: [{ value: 0.3 }] },
      { key: 'hikariNew', entry: '1421244134', label: 'ひかり（新規）', hint: '光新規 1件→1 / 固定代替え 1件→0.5', kind: 'number', steps: [{ value: 0.5, label: '光新規' }, { value: 0.25, label: '固定代替え' }] },
      { key: 'hikariTenyo', entry: '1835990490', label: 'ひかり（転用・事業者変更）', hint: '1件→0.8', kind: 'number', steps: [{ value: 0.4 }] },
      { key: 'hikariCable', entry: '793928834', label: 'ひかり（ケーブル）', hint: 'ケーブルトス 1件→0.2 / ジェイコム同席で工事日がその場で決まった 1件→0.5', kind: 'number', steps: [{ value: 0.1, label: 'トス' }, { value: 0.25, label: '工事日確定' }] },
      { key: 'tablet', entry: '897029006', label: 'タブレット', hint: '1件→0.2', kind: 'number', steps: [{ value: 0.1 }] },
      { key: 'denki', entry: '1501165980', label: 'でんき・ガス', hint: '1件→0.1', kind: 'number', steps: [{ value: 0.05 }] },
      { key: 'credit', entry: '1014539532', label: 'クレカ・自銀', hint: 'ゴールド 0.3 / シルバー 0.1 / 自銀 0.1', kind: 'number', steps: [{ value: 0.15, label: 'ゴールド' }, { value: 0.05, label: 'シルバー・自銀' }] },
      { key: 'selfClose', entry: '973447314', label: '合計自己クロ', kind: 'number', copyTotal: true },
      { key: 'seated', entry: '2131159871', label: '着座数', hint: '1組1件（3人家族を着座させたら1）。実績か自己クロがあれば自動で1', kind: 'number', steps: [{ value: 1 }] },
    ],
  },
  {
    title: '所感',
    fields: [
      { key: 'winExample', entry: '2049868143', label: '獲得例', hint: '年齢や元キャリア、プランなど', kind: 'textarea' },
      { key: 'lossExample', entry: '1668466374', label: '失注例', hint: '切り返せなかった内容など。なければ知りたいことでもOK', kind: 'textarea' },
    ],
  },
  {
    title: '交通費',
    always: true,
    fields: [
      { key: 'fare', entry: '1677579059', label: '往復交通費（公共交通機関）', kind: 'number', required: true },
      { key: 'taxi', entry: '23584606', label: 'タクシー代、有料特急', hint: '事前承諾が必要。領収書は社員に渡してね', kind: 'number', required: true },
    ],
  },
];

// normal = 通常 / zero = 0だった日（業務委託で交通費だけ） / training = 研修の日（交通費だけ）
export type NippoMode = 'normal' | 'zero' | 'training';

// フォームのページ番号（0始まり）。フォームのページ移動の設定と同じ順に通る。
// 業務委託（通常・0だった日）: 1ページ目 → 実績 → 所感 → 交通費
//   イベント販売台数・分析・必殺トーク／目標振り返り／目標達成のページはフォーム側で飛ばす設定になっている
//   0だった日は実績・所感を空のまま同じ順で通る（必須項目はない）
// 研修: 1ページ目 → 交通費（フォームでも研修を選ぶと交通費へ直行する）
const PAGES_WORK = '0,1,5,7';
const PAGES_TRAINING = '0,7';

export type NippoSubmission = {
  date: string; // YYYY-MM-DD
  location: string;
  mode: NippoMode;
  values: Record<string, string>;
};

/** そのモードで入力するセクション */
export function sectionsFor(mode: NippoMode): NippoSection[] {
  return mode === 'normal' ? NIPPO_SECTIONS : NIPPO_SECTIONS.filter((s) => s.always);
}

/** 入力内容の不備を返す（問題なければ空配列） */
export function validateNippo(s: NippoSubmission): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errors.push('勤務日を入力してください');
  if (!s.location.trim()) errors.push('勤務地を入力してください');
  for (const section of sectionsFor(s.mode)) {
    for (const f of section.fields) {
      const v = (s.values[f.key] ?? '').trim();
      if (f.required && !v) errors.push(`${f.label}を入力してください`);
      if (f.kind === 'number' && v && !/^\d+(\.\d+)?$/.test(v)) errors.push(`${f.label}は数字で入力してください`);
    }
  }
  return errors;
}

/** Google フォームの formResponse に送る本文を組み立てる。名前とエリアはサーバー側で決めたものを渡す */
export function buildFormBody(s: NippoSubmission, name: string, area: string): URLSearchParams {
  const [y, m, d] = s.date.split('-');
  const body = new URLSearchParams();
  body.append(`entry.${ENTRY.date}_year`, y);
  body.append(`entry.${ENTRY.date}_month`, String(parseInt(m)));
  body.append(`entry.${ENTRY.date}_day`, String(parseInt(d)));
  body.append(`entry.${ENTRY.name}`, name);
  body.append(`entry.${ENTRY.storeType}`, s.mode === 'training' ? STORE_TYPE_TRAINING : STORE_TYPE_WORK);
  body.append(`entry.${ENTRY.area}`, area);
  body.append(`entry.${ENTRY.location}`, s.location.trim());
  for (const section of sectionsFor(s.mode)) {
    for (const f of section.fields) {
      const v = (s.values[f.key] ?? '').trim();
      if (v) body.append(`entry.${f.entry}`, v);
    }
  }
  body.append('pageHistory', s.mode === 'training' ? PAGES_TRAINING : PAGES_WORK);
  body.append('fvv', '1');
  return body;
}
