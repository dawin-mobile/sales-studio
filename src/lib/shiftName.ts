import { getSheetDataCached } from '@/lib/sheets';

/**
 * シフト表の名前と、ログイン名（スタッフ情報の T列）を照らし合わせる。
 *
 * シフト表には「大野」（大野雅也）と「大野賀」（大野賀世）のように、同じ姓の人が
 * 短い名前で並ぶ。ログイン名がシフト表の名前で始まるかどうかで判定すると、
 * 大野賀世に大野雅也のシフトが混ざる（2026-11 時点で 大野賀世・高橋史弥・阿部遙人・森山翼 の4人）。
 * そのため、スタッフ情報の F列「シフト名」と完全に一致する名前だけを本人のシフトとして数える。
 */

// GAS の normalizeName_ と同じ（空白を除き、髙→高）
function normalize(name: string | null | undefined): string {
  return (name ?? '').replace(/[\s　]/g, '').replace(/髙/g, '高');
}

/**
 * スタッフ情報（T列=名前・F列=シフト名）の対応表。キーは空白を除いた名前。
 * Talknote の名前は「大野 賀世」のように空白が入ることがあるので、空白を除いて引く
 */
export async function getShiftNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const rows = await getSheetDataCached('スタッフ情報');
    for (const r of rows) {
      const name = normalize(r[19]);
      const shiftName = normalize(r[5]);
      if (name && shiftName) map.set(name, shiftName);
    }
  } catch {
    // 読めなければ全員シフト名なし（以前の前方一致）で判定する
  }
  return map;
}

/** 対応表から、その人のシフト表での名前を返す。登録がなければ空文字 */
export function lookupShiftName(map: Map<string, string>, name: string): string {
  return map.get(normalize(name)) ?? '';
}

/** その人のシフト表での名前を返す。登録がなければ空文字 */
export async function getShiftName(name: string): Promise<string> {
  return lookupShiftName(await getShiftNameMap(), name);
}

/** シフト表の名前がその人のものか。シフト名が分かれば完全一致、分からなければ前方一致（以前と同じ判定） */
export function isOwnShiftName(cell: string | null | undefined, name: string, shiftName: string): boolean {
  const sn = normalize(cell);
  if (!sn) return false;
  if (shiftName) return sn === shiftName;
  const n = normalize(name);
  return n.startsWith(sn) || sn.startsWith(n);
}
