import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { aggregateMainSheet, aggregateAgeSheet, aggregateTypeSheet } from '@/lib/aggregator';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SHEET_NAME_MAIN = '合算データ';
const SHEET_NAME_AGE = 'グラフ用データ_年代';
const SHEET_NAME_TYPE = 'グラフ用データ_家族構成';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    let targetYear: number;
    let targetMonthIdx: number;

    if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number);
      targetYear = y;
      targetMonthIdx = m - 1;
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonthIdx = now.getMonth();
    }

    const [mainRows, ageRows, typeRows, staffRows] = await Promise.all([
      getSheetData(SHEET_NAME_MAIN),
      getSheetData(SHEET_NAME_AGE).catch(() => []),
      getSheetData(SHEET_NAME_TYPE).catch(() => []),
      getSheetData('スタッフ情報').catch(() => []),
    ]);

    const data = aggregateMainSheet(mainRows, targetYear, targetMonthIdx);

    // スタッフ情報シートから役職・シート順・全アクティブスタッフを取得
    // T列=index19:名前, X列=index23:有効, AC列=index28:役職
    const staffOrder: { name: string; position?: string; role?: string }[] = [];
    if (staffRows.length > 1) {
      const positionMap = new Map<string, string>();

      staffRows.slice(1).forEach((row) => {
        const name = row[19]?.trim();
        if (!name) return;
        const pos = row[28]?.trim();
        if (pos) positionMap.set(name, pos);
        if (row[23]?.trim().toUpperCase() === 'TRUE') {
          staffOrder.push({ name, position: pos || undefined, role: row[22]?.trim() || undefined });
        }
      });

      // rankingに役職を付与（rankingの順序はtotal降順のまま維持）
      data.ranking.forEach((s) => {
        const pos = positionMap.get(s.name);
        if (pos) s.position = pos;
      });
    }
    data.staffOrder = staffOrder;

    const staffMap: Record<string, typeof data.ranking[0]> = {};
    data.ranking.forEach((s) => { staffMap[s.name] = s; });

    if (ageRows.length > 0) {
      aggregateAgeSheet(ageRows, staffMap, targetYear, targetMonthIdx);
    }
    if (typeRows.length > 0) {
      aggregateTypeSheet(typeRows, staffMap, targetYear, targetMonthIdx);
    }

    data.ranking.forEach((p) => {
      Object.entries(p.ages).forEach(([k, v]) => {
        data.globalStats.ages[k] = (data.globalStats.ages[k] || 0) + v;
      });
      Object.entries(p.types).forEach(([k, v]) => {
        data.globalStats.types[k] = (data.globalStats.types[k] || 0) + v;
      });
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
