import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

export interface UserStat {
  name: string;
  total: number;
  lastAccess: string;
  tabs: Record<string, number>;
}

export interface TabStat {
  name: string;
  count: number;
}

// 記録の日時は「2026/9/9 18:25:59」のようにゼロ埋めなし。文字のまま比べると 9/9 が 10/28 より新しくなるので数値にする
function parseTimestamp(ts: string): number {
  const m = ts.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, se).getTime();
}

// 「2026/9/9 …」→「2026-09」
function monthKey(ts: string): string {
  const m = ts.match(/^(\d{4})\/(\d{1,2})\//);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
}

/**
 * ?month=YYYY-MM でその月だけ、?month=all で全期間を集計する（指定なしは全期間）。
 * months には記録のある月を新しい順に返す（画面の月の切り替えに使う）
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = request.nextUrl.searchParams.get('month') ?? 'all';
  const rows = await getSheetData('アクセスログ');
  const allData = rows.slice(1).filter(r => r[0] && r[1] && r[2]);
  const months = [...new Set(allData.map((r) => monthKey(r[0])).filter(Boolean))].sort().reverse();
  const data = month === 'all' ? allData : allData.filter((r) => monthKey(r[0]) === month);

  // ユーザー別集計
  const userMap = new Map<string, UserStat>();
  const tabMap = new Map<string, number>();

  for (const [timestamp, userName, tabName] of data) {
    // ユーザー別
    if (!userMap.has(userName)) {
      userMap.set(userName, { name: userName, total: 0, lastAccess: timestamp, tabs: {} });
    }
    const u = userMap.get(userName)!;
    u.total++;
    u.tabs[tabName] = (u.tabs[tabName] ?? 0) + 1;
    if (parseTimestamp(timestamp) > parseTimestamp(u.lastAccess)) u.lastAccess = timestamp;

    // タブ別
    tabMap.set(tabName, (tabMap.get(tabName) ?? 0) + 1);
  }

  const userStats = [...userMap.values()].sort((a, b) => b.total - a.total);
  const tabStats: TabStat[] = [...tabMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ userStats, tabStats, months });
}
