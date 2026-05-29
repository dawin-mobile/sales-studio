import { NextResponse } from 'next/server';
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

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await getSheetData('アクセスログ');
  const data = rows.slice(1).filter(r => r[0] && r[1] && r[2]);

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
    if (timestamp > u.lastAccess) u.lastAccess = timestamp;

    // タブ別
    tabMap.set(tabName, (tabMap.get(tabName) ?? 0) + 1);
  }

  const userStats = [...userMap.values()].sort((a, b) => b.total - a.total);
  const tabStats: TabStat[] = [...tabMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ userStats, tabStats });
}
