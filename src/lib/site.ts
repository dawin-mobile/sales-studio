/**
 * シフト表の現場欄から現場名だけを取り出す。
 * 現場欄には「アリオ北砂　平日アクア　土日アあかちゃん前＋ユニクロ」のようにメモが続くことがあるので、
 * 最初のスペース（半角・全角）より前だけを使い、IY はイトーヨーカドーに直す。
 * 稼働カードの現場名と、日報の勤務地の自動入力で同じ名前になるよう共通にしている
 */
export function normalizeSiteName(location: string): string {
  const name = location.trim().replace(/^IY/, 'イトーヨーカドー');
  const spaceIdx = name.search(/[ 　]/);
  return spaceIdx === -1 ? name : name.slice(0, spaceIdx);
}

const CARRIER_PREFIX = /^(auショップ|au|uq|sbショップ|sb|ソフトバンク)/;

/**
 * 同じ現場かどうかを比べるための形。書き方の細かい違いを消す:
 * 全角半角・大文字小文字・空白、キャリア名（au・SB）、かっこ書き、末尾の「店前」「入口」など、IY・テラモの略し方
 */
export function siteKey(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[(（][^)）]*[)）]/g, '')
    .replace(/^iy/, 'イトーヨーカドー')
    .replace('テラモ', 'テラスモール')
    .replace('溝の口', '溝ノ口')
    .replace(/ヶ/g, 'ケ')
    .replace(CARRIER_PREFIX, '')
    .replace(/(店前|店頭|入口|店)$/, '');
}

function isSoftBank(name: string): boolean {
  return /^(sbショップ|sb|ソフトバンク)/.test(name.normalize('NFKC').toLowerCase());
}

/**
 * シフト表の現場名を、日報でいちばん多く使われている書き方に直す。
 * 勤務地の書き方は人によってばらばら（au長坂／長坂、テラスモール店前／テラスモール松戸 など）なので、
 * 正式名の一覧を持つ代わりに、直近の日報での多数派に合わせる。
 * @param shiftName normalizeSiteName 済みのシフト表の現場名
 * @param carrier   シフト表C列のキャリア（au / SB など）。同じ建物に au と SB のブースがある現場で、キャリアの合う書き方を選ぶ
 * @param counts    直近の日報の勤務地ごとの件数
 * 当てはまる書き方がなければ shiftName をそのまま返す
 */
export function pickCommonSiteName(shiftName: string, carrier: string, counts: Map<string, number>): string {
  const key = siteKey(shiftName);
  if (key.length < 2) return shiftName;

  // 「島忠府中→イオン天王町」のように複数の現場が書かれたものは使わない
  const usable = [...counts].filter(([name]) => !/[→\n/]/.test(name));
  const allKeys = [...new Set(usable.map(([name]) => siteKey(name)).filter(Boolean))];
  // 「イトーヨーカドー」「テラスモール」だけのように、ほかの2つ以上の書き方に含まれる短い書き方は、どの現場か決められない
  const isGeneric = (k: string) => allKeys.filter((other) => other !== k && other.includes(k)).length >= 2;

  let candidates: [string, number][] = [];
  for (const [name, count] of usable) {
    const k = siteKey(name);
    if (!k || isGeneric(k)) continue;
    // 一方がもう一方を含む場合は、短いほうが3文字以上のときだけ同じ現場とみなす
    const same = k === key || (Math.min(k.length, key.length) >= 3 && (k.includes(key) || key.includes(k)));
    if (same) candidates.push([name, count]);
  }
  if (candidates.length === 0) return shiftName;

  // キャリアが SB なら SB の書き方、au なら SB 以外の書き方を優先する（合うものがなければ全部から選ぶ）
  const c = carrier.trim().toLowerCase();
  const preferred = c === 'sb' ? candidates.filter(([n]) => isSoftBank(n))
    : c === 'au' ? candidates.filter(([n]) => !isSoftBank(n))
    : candidates;
  if (preferred.length > 0) candidates = preferred;

  candidates.sort((a, b) => b[1] - a[1]);
  // シフト表の名前そのものが短い書き方（例「テラスモール」）のときは、いくつもの現場に当てはまりうる。
  // 1つの書き方が7割以上を占めるときだけ、それをその現場とみなす
  if (isGeneric(key)) {
    const total = candidates.reduce((sum, [, n]) => sum + n, 0);
    if (candidates[0][1] < total * 0.7) return shiftName;
  }
  return candidates[0][0];
}
