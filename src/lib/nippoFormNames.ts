import { ENTRY, NIPPO_FORM_ID } from './nippoForm';

// 日報フォームの名前欄はプルダウンなので、載っていない名前では送信できない（フォームが受け付けない）。
// フォームのページから選択肢を読み、載っていない人には日報ボタンを出さないために使う。
// スタッフの追加はたまにしかないので1時間使い回す
const CACHE_TTL = 60 * 60 * 1000;
let cache: { names: Set<string>; at: number } | null = null;
let inflight: Promise<Set<string> | null> | null = null;

async function fetchFormNames(): Promise<Set<string> | null> {
  const res = await fetch(`https://docs.google.com/forms/d/e/${NIPPO_FORM_ID}/viewform`, { cache: 'no-store' });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/FB_PUBLIC_LOAD_DATA_ = ([\s\S]*?);<\/script>/);
  if (!m) return null;
  // FB_PUBLIC_LOAD_DATA_[1][1] が質問の一覧。各質問の [4][0] が [entry番号, 選択肢一覧, ...]、選択肢は [表示名, ...]
  const items = JSON.parse(m[1])?.[1]?.[1] as unknown[][] | undefined;
  for (const item of items ?? []) {
    const q = (item?.[4] as unknown[][] | undefined)?.[0];
    if (q && String(q[0]) === ENTRY.name) {
      return new Set((q[1] as unknown[][]).map((o) => String(o[0])));
    }
  }
  return null;
}

/**
 * 名前がフォームのプルダウンに載っているか。
 * フォームが読めなかったときは判定できないので true を返す（送信時にフォーム側で弾かれれば、その旨のエラーが出る）
 */
export async function isOnFormNameList(name: string): Promise<boolean> {
  if (!cache || Date.now() - cache.at > CACHE_TTL) {
    inflight ??= fetchFormNames()
      .catch(() => null)
      .finally(() => { inflight = null; });
    const names = await inflight;
    if (names) cache = { names, at: Date.now() };
  }
  return cache ? cache.names.has(name) : true;
}
