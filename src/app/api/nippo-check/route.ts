import { NextResponse } from 'next/server';
import { eq, sql, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { shiftRows, salesRecords } from '@/lib/schema';

export const dynamic = 'force-dynamic';

// 日報を提出しない役職者（事業部長など）はアラート対象外
const NIPPO_ALERT_EXEMPT_USER_IDS = ['hashimoto'];

export async function GET() {
  const session = await auth();
  if (!session?.user?.name) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (NIPPO_ALERT_EXEMPT_USER_IDS.includes(session.user.id)) {
    return NextResponse.json({ missingDates: [] });
  }

  const userName = session.user.name;
  // Vercel は UTC で動くため JST (UTC+9) に変換して使用
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYear = nowJst.getUTCFullYear();
  const currentMonthNum = nowJst.getUTCMonth() + 1;
  const todayDay = nowJst.getUTCDate();
  const jstHour = nowJst.getUTCHours();
  const month = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  try {
    // 当月のシフトデータを全取得
    const shifts = await db
      .select({ date: shiftRows.date, staff: shiftRows.staff })
      .from(shiftRows)
      .where(eq(shiftRows.month, month));

    // 自分が入っているシフト日付を抽出（今日以前のみ）
    const shiftDates = new Set<string>();
    for (const row of shifts) {
      const staffArray = (row.staff as string[]) ?? [];
      if (!staffArray.some((s) => {
        const sn = s?.trim();
        if (!sn) return false;
        return userName.startsWith(sn) || sn.startsWith(userName);
      })) continue;

      // date は "M/D" 形式
      const parts = row.date.split('/');
      if (parts.length !== 2) continue;
      const m = parseInt(parts[0]);
      const d = parseInt(parts[1]);
      if (isNaN(m) || isNaN(d) || m !== currentMonthNum) continue;
      if (d > todayDay) continue; // 未来はスキップ
      if (d === todayDay && jstHour < 19) continue; // 当日JST19時前はスキップ

      const dateKey = `${currentYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      shiftDates.add(dateKey);
    }

    if (shiftDates.size === 0) {
      return NextResponse.json({ missingDates: [] });
    }

    // 当月の自分の日報提出済み日付を取得
    const sales = await db
      .select({ date: salesRecords.date })
      .from(salesRecords)
      .where(
        and(
          sql`LEFT(${salesRecords.date}, 7) = ${month}`,
          eq(salesRecords.staffName, userName)
        )
      );

    const submittedDates = new Set(sales.map((s) => s.date));

    // シフトあり & 日報なし = 未提出
    const missingDates = [...shiftDates]
      .filter((d) => !submittedDates.has(d))
      .sort();

    return NextResponse.json({ missingDates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラーが発生しました' },
      { status: 500 }
    );
  }
}
