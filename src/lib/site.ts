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
