import { NextRequest, NextResponse } from 'next/server';
import { eq, sql, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { shiftRows, salesRecords } from '@/lib/schema';

export const dynamic = 'force-dynamic';

// 日報を提出しない役職者（事業部長など）はアラート対象外
const NIPPO_ALERT_EXEMPT_USER_IDS = ['hashimoto'];

const ROLE_ORDER = ['業務委託', 'アルバイト', '社員', '幹部', '管理者'];
function hasMinRole(role: string | undefined, min: string): boolean {
  return ROLE_ORDER.indexOf(role ?? '') >= ROLE_ORDER.indexOf(min);
}

/**
 * シフトに入っているのに日報が無い日（未提出日）を返す。
 *
 *   GET /api/nippo-check                        … 自分・当月（従来どおり。未提出アラートで使用）
 *   GET /api/nippo-check?staff=畠中健士郎&month=2026-09 … 指定スタッフ・指定月（社員以上のみ）
 *
 * 他人の分を見られるのは社員以上。フロントで隠すだけではURL直叩きを防げないため、
 * ここで必ずロールを確認する。
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.name) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const staffParam = searchParams.get('staff')?.trim() ?? '';
  const monthParam = searchParams.get('month')?.trim() ?? '';

  const isOther = staffParam !== '' && staffParam !== session.user.name;
  if (isOther && !hasMinRole(session.user.role, '社員')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 401 });
  }

  // 自分の当月を見るときだけ、日報を出さない役職者を対象外にする
  if (!isOther && !monthParam && NIPPO_ALERT_EXEMPT_USER_IDS.includes(session.user.id)) {
    return NextResponse.json({ missingDates: [] });
  }

  const userName = staffParam || session.user.name;
  // Vercel は UTC で動くため JST (UTC+9) に変換して使用
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const thisYear = nowJst.getUTCFullYear();
  const thisMonthNum = nowJst.getUTCMonth() + 1;
  const jstHour = nowJst.getUTCHours();

  // 指定が無ければ当月
  const mp = monthParam.match(/^(\d{4})-(\d{1,2})$/);
  const currentYear = mp ? parseInt(mp[1]) : thisYear;
  const currentMonthNum = mp ? parseInt(mp[2]) : thisMonthNum;
  const month = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  // 過去の月は月末まで対象。当月は今日まで（当日はJST19時以降）
  const isThisMonth = currentYear === thisYear && currentMonthNum === thisMonthNum;
  const lastDayOfMonth = new Date(currentYear, currentMonthNum, 0).getDate();
  const todayDay = isThisMonth ? nowJst.getUTCDate() : lastDayOfMonth;

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
      if (isThisMonth && d === todayDay && jstHour < 19) continue; // 当日JST19時前はスキップ

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
