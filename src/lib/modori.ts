/**
 * 戻り報告（【戻り報告】ノートの投稿）のパーサ。
 *
 * 投稿テンプレート:
 *   戻り日：10月5日
 *
 *   勤務地：イトーヨーカドー四つ木
 *   戻り詳細（日報と同じカウントで記載）
 *   ┗MNP端末：
 *   ┗MNPsim：3
 *   ┗純新規：
 *   ┗機種変：
 *   ┗セルアップ：
 *   ┗ひかり新規：
 *   ┗ひかり転用：
 *   ┗ひかりケーブル：
 *   ┗タブ：
 *   ┗でんガス：
 *   ┗クレ自銀：
 *
 *   自己ｸﾛ：3
 *
 * 項目は日報とまったく同じなので、pt は日報と同じく「全項目の合計」で出す
 * （src/lib/aggregator.ts の rowTotal と同じ考え方）。
 */

export interface ModoriItems {
  mnpTanmatsu: number;
  mnpSim: number;
  junShinki: number;
  kishuhen: number;
  cellup: number;
  hikariShinki: number;
  hikariTenyo: number;
  hikariCable: number;
  tab: number;
  denGas: number;
  kureJigin: number;
}

export interface ParsedModori {
  month: number;
  day: number;
  site: string;
  items: ModoriItems;
  pt: number;
  selfClose: number;
}

// 全角数字・全角コロンをそろえる
function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48))
    .replace(/[：]/g, ':')
    .replace(/[．]/g, '.');
}

// 「ラベル: 数字」を拾う。値が空欄なら0
function pickNumber(text: string, label: string): number {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)?');
  const m = text.match(re);
  if (!m || !m[1]) return 0;
  const n = parseFloat(m[1]);
  return isNaN(n) ? 0 : n;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseModoriMessage(message: string): ParsedModori | null {
  const text = normalize(message);

  // 戻り日：10月5日 / 10/5 のどちらでも拾う
  let month = 0, day = 0;
  const jp = text.match(/戻り日\s*:\s*(\d{1,2})月\s*(\d{1,2})日/);
  const slash = text.match(/戻り日\s*:\s*(\d{1,2})\s*[\/／]\s*(\d{1,2})/);
  if (jp) { month = parseInt(jp[1]); day = parseInt(jp[2]); }
  else if (slash) { month = parseInt(slash[1]); day = parseInt(slash[2]); }
  // 戻り日が読めない投稿は集計できないため対象外にする
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const siteMatch = text.match(/勤務地\s*:\s*(.+)/);
  const site = siteMatch ? siteMatch[1].trim() : '';

  const items: ModoriItems = {
    mnpTanmatsu:  pickNumber(text, 'MNP端末'),
    mnpSim:       pickNumber(text, 'MNPsim'),
    junShinki:    pickNumber(text, '純新規'),
    kishuhen:     pickNumber(text, '機種変'),
    cellup:       pickNumber(text, 'セルアップ'),
    hikariShinki: pickNumber(text, 'ひかり新規'),
    hikariTenyo:  pickNumber(text, 'ひかり転用'),
    hikariCable:  pickNumber(text, 'ひかりケーブル'),
    tab:          pickNumber(text, 'タブ'),
    denGas:       pickNumber(text, 'でんガス'),
    kureJigin:    pickNumber(text, 'クレ自銀'),
  };

  const pt = round2(Object.values(items).reduce((a, b) => a + b, 0));

  // 「自己ｸﾛ」は半角カナ。全角カナ・ひらがな表記も拾えるようにする
  const selfClose = Math.max(
    pickNumber(text, '自己ｸﾛ'),
    pickNumber(text, '自己クロ'),
    pickNumber(text, '自己くろ'),
  );

  return { month, day, site, items, pt, selfClose: round2(selfClose) };
}

/**
 * 「戻り日」には年が書かれていないため、受信日時の年から補う。
 * 年またぎ（12月の戻りを1月に報告、など）を考慮して、
 * 受信月から6か月以上離れていたら前年・翌年に寄せる。
 */
export function modoriYear(receivedAt: string, month: number, day: number): number {
  const m = receivedAt.match(/^(\d{4})[\/\-](\d{1,2})/);
  if (!m) return new Date().getFullYear();
  const recvYear = parseInt(m[1]);
  const recvMonth = parseInt(m[2]);
  if (month - recvMonth > 6) return recvYear - 1;   // 1月に受信した12月の戻り
  if (recvMonth - month > 6) return recvYear + 1;   // ほぼ無いが念のため
  return recvYear;
}

/** 日報のカレンダー行（MNP / 新規 / UQ→au / NW / でんガス / クレカ）に合わせた内訳 */
export function modoriToCalendarRow(items: ModoriItems) {
  return {
    mnp:    round2(items.mnpTanmatsu + items.mnpSim),
    new:    items.junShinki,
    uq:     round2(items.kishuhen + items.cellup),
    nw:     round2(items.hikariShinki + items.hikariTenyo + items.hikariCable),
    elec:   items.denGas,
    credit: items.kureJigin,
  };
}
