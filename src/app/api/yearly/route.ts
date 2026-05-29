import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

const COL = { DATE: 1, NAME: 2, MNP_H: 6, MNP_S: 7, NEW: 8, CHANGE: 9, CELLUP: 10,
  HIKARI_N: 11, HIKARI_T: 12, HIKARI_C: 13, TABLET: 14, LIFE: 15, CREDIT: 16 };

function n(row: string[], i: number) {
  const v = Number(row[i]); return isNaN(v) ? 0 : v;
}
function add(a: number, b: number) { return Math.round((a + b) * 100) / 100; }

function calcPt(row: string[]) {
  return add(add(add(
    add(n(row, COL.MNP_H), n(row, COL.MNP_S)),
    add(n(row, COL.NEW), add(n(row, COL.CHANGE), n(row, COL.CELLUP)))),
    add(add(n(row, COL.HIKARI_N), n(row, COL.HIKARI_T)), n(row, COL.HIKARI_C))),
    add(n(row, COL.TABLET), add(n(row, COL.LIFE), n(row, COL.CREDIT))));
}

export interface MonthData {
  month: string;
  label: string;
  total: number;
  workDays: number;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const staffName = new URL(request.url).searchParams.get('staff') ?? session.user?.name ?? '';

  const rows = await getSheetData('合算データ');
  const now = new Date();

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthSet = new Set(months);

  // 個人集計
  const map = new Map<string, { total: number; dates: Set<string> }>();
  // 全体集計: month → { staffPt: Map<staffName, total> }
  const avgMap = new Map<string, Map<string, number>>();
  months.forEach(m => {
    map.set(m, { total: 0, dates: new Set() });
    avgMap.set(m, new Map());
  });

  for (const row of rows.slice(1)) {
    const name = row[COL.NAME];
    if (!name) continue;
    const d = new Date(row[COL.DATE]);
    if (isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthSet.has(ym)) continue;

    const pt = calcPt(row);

    // 全体平均用
    const staffMap = avgMap.get(ym)!;
    staffMap.set(name, add(staffMap.get(name) ?? 0, pt));

    // 個人用
    if (name === staffName) {
      const entry = map.get(ym)!;
      entry.total = add(entry.total, pt);
      entry.dates.add(row[COL.DATE]);
    }
  }

  const makeLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${String(y).slice(2)}/${parseInt(m)}`;
  };

  const data: MonthData[] = months.map(ym => {
    const entry = map.get(ym)!;
    return { month: ym, label: makeLabel(ym), total: entry.total, workDays: entry.dates.size };
  });

  const avgData: MonthData[] = months.map(ym => {
    const staffMap = avgMap.get(ym)!;
    const staffCount = staffMap.size;
    const totalPt = [...staffMap.values()].reduce((s, v) => add(s, v), 0);
    const avg = staffCount > 0 ? Math.round((totalPt / staffCount) * 10) / 10 : 0;
    return { month: ym, label: makeLabel(ym), total: avg, workDays: staffCount };
  });

  return NextResponse.json({ data, avgData, staffName });
}
