import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData, getShiftMonthData } from '@/lib/sheets';

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

// 送信者名とシフトスタッフ名を照合する（スペース除去して前方一致）
function matchStaff(sender: string, staffName: string): boolean {
  const s = sender.replace(/\s/g, '');
  const n = staffName.replace(/\s/g, '');
  if (!s || !n) return false;
  return s === n || s.startsWith(n) || n.startsWith(s);
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
  const targetM = parseInt(m);
  const targetD = parseInt(d);

  const [jissekiRows, shift] = await Promise.all([
    getSheetData('実績受信録').catch(() => [] as string[][]),
    getShiftMonthData(month).catch(() => ({ tokyo: [] as string[][], fukuoka: [] as string[][] })),
  ]);

  // シフトシートから現場→スタッフのマッピングを構築
  const siteOrder: { location: string; staff: string[]; agency: string; region: string; carrier: string }[] = [];
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
      // C列＝キャリア（au / SB / 増強 等）。実績報告のテンプレート判定に使う
      siteOrder.push({ location, staff, agency: row[agencyIdx] ?? '', region, carrier: row[2] ?? '' });
    }
  };

  addSites(shift.tokyo, '東京');
  addSites(shift.fukuoka, '福岡');

  // スタッフ名 → 現場名の逆引きマップを作成
  const staffToSite = new Map<string, string>();
  for (const site of siteOrder) {
    for (const staffName of site.staff) {
      staffToSite.set(staffName, site.location);
    }
  }

  // 実績受信録から当日分を取得してsiteMapに整理
  const siteMap: Record<string, Record<string, { postedAt: string; message: string }[]>> = {};

  for (const row of jissekiRows) {
    const receivedAt = row[0] ?? '';
    const sender = row[1]?.trim() ?? '';
    const message = row[2]?.trim() ?? '';
    if (!sender || !message) continue;

    // メッセージ本文の「M月D日」を優先してフィルタリング。
    // 実績報告はGASの処理タイミング次第で翌日以降に受信される場合があるため、
    // 受信日付ではなく報告内容の営業日で照合する。
    const dateMatch = message.match(/(\d{1,2})月(\d{1,2})日/);
    if (dateMatch) {
      if (parseInt(dateMatch[1]) !== targetM || parseInt(dateMatch[2]) !== targetD) continue;
    } else {
      // 日付記載がない場合は受信日付（当日）でフォールバック
      const jissekiDatePrefix = `${y}/${m}/${d}`;
      if (!receivedAt.startsWith(jissekiDatePrefix)) continue;
    }

    // 送信者名から現場を特定
    let site = 'その他';
    for (const [staffName, siteName] of staffToSite) {
      if (matchStaff(sender, staffName)) {
        site = siteName;
        break;
      }
    }

    if (!siteMap[site]) siteMap[site] = {};
    if (!siteMap[site][sender]) siteMap[site][sender] = [];
    siteMap[site][sender].push({ postedAt: receivedAt, message });
  }

  return NextResponse.json({ date, siteOrder, siteMap });
}
