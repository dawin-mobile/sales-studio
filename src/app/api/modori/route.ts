import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';
import { parseModoriMessage, modoriYear } from '@/lib/modori';

export const dynamic = 'force-dynamic';

/**
 * 戻り報告（別日に戻ってきた分の獲得）を返す。
 *
 * 当日の獲得は日報に入るが、自分がその現場にいない日に客が戻って契約した分は
 * Talknoteの【戻り報告】ノートに投稿され、GASが「戻り報告受信録」シートに貯めている。
 * ここではそれをパースして、月単位でまとめて返す。
 *
 *   GET /api/modori?month=YYYY-MM
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? '';
  const [y, m] = month.split('-').map((v) => parseInt(v));
  if (!y || !m) return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 });

  const rows = await getSheetData('戻り報告受信録').catch(() => [] as string[][]);

  const entries = [];
  for (const row of rows.slice(1)) {
    const receivedAt = String(row[0] ?? '').trim();
    const sender = String(row[1] ?? '').trim();
    const message = String(row[2] ?? '');
    if (!sender || !message) continue;

    const parsed = parseModoriMessage(message);
    if (!parsed) continue;

    // 「戻り日：10月5日」には年が書かれていないため、受信日時の年から補う
    const year = modoriYear(receivedAt, parsed.month, parsed.day);
    if (year !== y || parsed.month !== m) continue;

    entries.push({
      date: `${year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`,
      day: parsed.day,
      staff: sender,
      site: parsed.site,
      pt: parsed.pt,
      selfClose: parsed.selfClose,
      items: parsed.items,
      receivedAt,
    });
  }

  return NextResponse.json({ month, entries });
}
