// 「資料」画面に出す営業資料・トークの一覧（2026-11-20 追加、decisions.md 参照）
// 中身を直すのは翔だけ。直したら push すると約2分で反映される。
// ファイル（画像・PDF）は content/shiryo/files/ に置き、image / pdf にファイル名だけ書く。
// ここはサーバー側（/api/shiryo）だけが読む。画面のコードから直接 import しないこと
// （import するとアプリの JS に入り、ログインしていない人にも読めてしまう）。

export interface ShiryoTalkSection {
  heading: string;
  body: string; // 改行はそのまま表示される
}

export interface Shiryo {
  id: string;
  category: string;     // 見出しのまとまり（例: 'UQ 親子割'）
  title: string;
  updated: string;      // YYYY-MM-DD。一覧の並び（新しい順）と「更新」表示に使う
  note?: string;        // 一言の説明
  image?: string;       // content/shiryo/files/ 内の画像ファイル名
  pdf?: string;         // content/shiryo/files/ 内の PDF ファイル名（PC で開く用）
  talk?: ShiryoTalkSection[];
}

export const SHIRYO: Shiryo[] = [
  {
    id: 'uq-oyakowari-2026',
    category: 'UQ 親子割',
    title: 'UQ親子割2026',
    updated: '2026-11-19',
    note: 'UQ親子応援割でワイモバ親子割に勝つ。相見積もりのときの値段の出し方・パターン別の勝ち筋。スタッフ用（お客さまに見せない）',
    // 元ファイル: UQ学割_勝ち方シート_2026-27_第2版.pdf。画像は PDF を横2600pxで書き出したもの
    image: 'UQ親子割2026.png',
    pdf: 'UQ親子割2026.pdf',
    talk: [],
  },
];

// 資料を見られるロール。2026-11-20 は試しに管理者だけに公開している。
// 全員に公開するときは null にする（ログインしていれば誰でも見られる）。
// 見られない人には API が 403 を返し、ホームの入口カードも出なくなる
export const SHIRYO_ALLOWED_ROLES: string[] | null = ['管理者'];

export function canViewShiryo(role: string | undefined): boolean {
  return SHIRYO_ALLOWED_ROLES === null || SHIRYO_ALLOWED_ROLES.includes(role ?? '');
}

// /api/shiryo/file/[name] で出してよいファイル名（一覧に書かれているものだけ）
export function shiryoFileNames(): Set<string> {
  const names = new Set<string>();
  for (const s of SHIRYO) {
    if (s.image) names.add(s.image);
    if (s.pdf) names.add(s.pdf);
  }
  return names;
}
