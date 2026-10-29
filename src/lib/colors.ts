// テーマ（黒基調／白基調）で読みやすさが変わる色のための道具

/**
 * 明るい色（黄色・黄緑・水色など）の文字を、白基調のときだけ黒を混ぜて濃くする。
 * 黒基調ではそのままの色。濃さは globals.css の --shade（黒基調 0%、白基調 40%）
 */
export function readable(color: string): string {
  return `color-mix(in srgb, ${color}, black var(--shade))`;
}
