import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { talknotePosts } from '@/lib/schema';

import { getShiftMonthData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const REGION_COLS = {
  '東京': { staffEnd: 19, agencyIdx: 19 },
  '福岡': { staffEnd: 11, agencyIdx: 11 },
} as const;

function normalizeDate(raw: string): string {
  if (!raw || !/\d/.test(raw)) return raw;
  const withYear = raw.match(/^\d{4}[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (withYear) return `${parseInt(withYear[1])}/${parseInt(withYear[2])}`;
  const md = raw.match(/^(\d{1,2})[\/](\d{1,2})$/);
  if (md) return `${parseInt(md[1])}/${parseInt(md[2])}`;
  const jp = raw.match(/(\d{1,2})月(\d{1,2})日/);
  if (jp) return `${parseInt(jp[1])}/${parseInt(jp[2])}`;
  return raw;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const today = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
  const date = searchParams.get('date') || today;

  const [y, m, d] = date.split('-');
  const month = `${y}-${m}`;
  const shiftDate = `${parseInt(m)}/${parseInt(d)}`;

  const [posts, shift] = await Promise.all([
    db.select()
      .from(talknotePosts)
      .where(eq(talknotePosts.date, date))
      .orderBy(talknotePosts.postedAt)
      .catch(() => []),
    getShiftMonthData(month).catch(() => ({ tokyo: [] as string[][], fukuoka: [] as string[][] })),
  ]);

  // シフトシートから当日分のサイト順を構築
  const siteOrder: { location: string; staff: string[]; agency: string; region: string }[] = [];
  const seen = new Set<string>();

  const addSites = (rows: string[][], region: '東京' | '福岡') => {
    const { staffEnd, agencyIdx } = REGION_COLS[region];
    for (const row of rows) {
      const rowDate = normalizeDate(row[0] ?? '');
      if (rowDate !== shiftDate) continue;
      if (!row[3] || row[4] === '場所') continue;
      const location = row[3];
      if (seen.has(location)) continue;
      seen.add(location);
      const staff = row.slice(7, staffEnd).filter((s) => s && s.trim() !== '');
      siteOrder.push({ location, staff, agency: row[agencyIdx] ?? '', region });
    }
  };

  addSites(shift.tokyo, '東京');
  addSites(shift.fukuoka, '福岡');

  // site → staffName → posts[] のマップ
  const siteMap: Record<string, Record<string, { postedAt: string; message: string }[]>> = {};
  for (const post of posts) {
    const site = post.site || '店舗未確定';
    if (!siteMap[site]) siteMap[site] = {};
    if (!siteMap[site][post.staffName]) siteMap[site][post.staffName] = [];
    siteMap[site][post.staffName].push({ postedAt: post.postedAt, message: post.message });
  }

  return NextResponse.json({ date, siteOrder, siteMap });
}
