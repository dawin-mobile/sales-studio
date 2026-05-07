import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { StaffEvaluation } from '@/types';

export const maxDuration = 10;

const META_ROWS = 6;
const STAFF_START_COL = 3;

export async function GET() {
  try {
    const [evalRows, knRows] = await Promise.all([
      getSheetData('新人進捗').catch(() => [] as string[][]),
      getSheetData('知識').catch(() => [] as string[][]),
    ]);

    if (evalRows.length < META_ROWS + 1) return NextResponse.json([]);

    // スキルキーを抽出（7行目以降のC列=index2）
    const skillKeys: { row: number; key: string }[] = [];
    let currentGroup = '';
    for (let r = META_ROWS; r < evalRows.length; r++) {
      const groupLabel = String(evalRows[r][1] ?? '').trim();
      const subLabel   = String(evalRows[r][2] ?? '').trim();
      if (groupLabel) currentGroup = groupLabel;
      if (!subLabel) continue;
      let key = subLabel;
      if (currentGroup.includes('高齢')) key = 'クローズ高齢_' + subLabel;
      else if (currentGroup.includes('若年') || currentGroup.includes('中年')) key = 'クローズ若年_' + subLabel;
      else if (currentGroup.includes('特別')) key = 'クローズ特別_' + subLabel;
      else if (currentGroup.includes('メンバー')) key = 'メンバー_' + subLabel;
      skillKeys.push({ row: r, key });
    }

    const numStaff = (evalRows[1]?.length ?? 0) - STAFF_START_COL;
    const staffMap: Record<string, StaffEvaluation> = {};

    for (let c = 0; c < numStaff; c++) {
      const colIdx = STAFF_START_COL + c;
      const name = String(evalRows[1]?.[colIdx] ?? '').trim();
      if (!name) continue;

      const scores: Record<string, number> = {};
      for (const sk of skillKeys) {
        scores[sk.key] = Number(evalRows[sk.row]?.[colIdx]) || 0;
      }

      staffMap[name] = {
        staffName:   name,
        totalScore:  Number(evalRows[0]?.[colIdx]) || 0,
        rank:        Number(evalRows[5]?.[colIdx]) || 999,
        potential:   String(evalRows[2]?.[colIdx] ?? '').trim(),
        attendance:  String(evalRows[3]?.[colIdx] ?? '').trim(),
        attribute:   String(evalRows[4]?.[colIdx] ?? '').trim(),
        supervisor:  '',
        scores,
        knowledge:   {},
        knowledgeItems: [],
      };
    }

    // 知識シートをマージ
    if (knRows.length >= 3) {
      const productNames = (knRows[1] ?? []).slice(2).map((h, i) => ({
        idx: i,
        name: String(h || knRows[0]?.[2 + i] || '').trim(),
      })).filter((p) => p.name);

      for (let r = 2; r < knRows.length; r++) {
        const staffName  = String(knRows[r][0] ?? '').trim();
        const supervisor = String(knRows[r][1] ?? '').trim();
        if (!staffName) continue;
        const knowledge: Record<string, boolean> = {};
        for (const p of productNames) {
          const val = String(knRows[r][2 + p.idx] ?? '').trim();
          knowledge[p.name] = val === '○' || val === 'O' || val === '〇';
        }
        if (staffMap[staffName]) {
          staffMap[staffName].supervisor    = supervisor;
          staffMap[staffName].knowledge     = knowledge;
          staffMap[staffName].knowledgeItems = productNames.map((p) => p.name);
        }
      }
    }

    const data = Object.values(staffMap).sort((a, b) => a.rank - b.rank);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
