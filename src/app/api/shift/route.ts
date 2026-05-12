import { NextRequest, NextResponse } from 'next/server';
import { eq, and, ne } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { shiftRows, shiftStaffNames } from '@/lib/schema';

export const revalidate = 300; // 5分キャッシュ

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month =
    searchParams.get('month') ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [rawRows, tokyoNames, fukuokaNames] = await Promise.all([
    db.select().from(shiftRows).where(
      and(eq(shiftRows.month, month), ne(shiftRows.location, ''))
    ),
    db.select().from(shiftStaffNames).where(
      and(eq(shiftStaffNames.month, month), eq(shiftStaffNames.sheetRegion, '東京'))
    ).limit(1),
    db.select().from(shiftStaffNames).where(
      and(eq(shiftStaffNames.month, month), eq(shiftStaffNames.sheetRegion, '福岡'))
    ).limit(1),
  ]);

  // 重複除去（同時sync競合による重複を防ぐ）
  const seen = new Set<string>();
  const rows = rawRows.filter((r) => {
    const key = `${r.date}|${r.location}|${r.startTime}|${r.sheetRegion}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({
    rows,
    tokyoStaffNames: tokyoNames[0]?.names ?? [],
    fukuokaStaffNames: fukuokaNames[0]?.names ?? [],
  });
}
