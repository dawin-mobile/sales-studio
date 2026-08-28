import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// 裏メニューの機能なので社員以上のみ
const ALLOWED_ROLES = ['社員', '幹部', '管理者'];

const KINTAI_SHEET = '勤怠報告受信録';

export type KintaiKind = '当欠' | '遅刻' | '早退' | 'その他';

export interface KintaiRecord {
  date: string;        // 'YYYY-MM-DD'。日付が読めなかった場合は ''
  kind: KintaiKind;
  staff: string;
  site: string;
  reason: string;
  workTime: string;
  breakTime: string;
  reporter: string;    // 投稿した社員（欠勤した本人ではない）
  receivedAt: string;
  raw: string;
}

// 「日付：」「勤怠 :」など全角・半角のコロンと前後の空白を許容して1項目を取り出す。
// 値は同じ行のみ（次の行は別項目なので拾わない）
function extractField(text: string, label: string): string {
  const re = new RegExp(`^[ \\t　]*${label}[ \\t　]*[：:][ \\t　]*(.*)$`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

function detectKind(value: string): KintaiKind {
  if (value.includes('当欠')) return '当欠';
  if (value.includes('遅刻')) return '遅刻';
  if (value.includes('早退')) return '早退';
  return 'その他';
}

// 投稿の日付は「8月27日(木)」のように年がない。受信日時の年を使うが、
// 年末年始をまたぐ投稿（12月末の遅刻を1月に報告など）で1年ずれないよう補正する
function resolveDate(raw: string, receivedAt: Date): string {
  const m = raw.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!m) return '';
  const month = parseInt(m[1]);
  const day = parseInt(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';

  let year = receivedAt.getFullYear();
  const monthDiff = month - (receivedAt.getMonth() + 1);
  if (monthDiff >= 6) year -= 1;       // 受信1月・投稿12月 → 前年
  else if (monthDiff <= -6) year += 1; // 受信12月・投稿1月 → 翌年

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseReceivedAt(raw: string): Date | null {
  // GASが 'yyyy/MM/dd HH:mm:ss' で書き込んでいる
  const m = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(
    parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
    m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0
  );
}

export function parseKintaiRow(row: string[]): KintaiRecord | null {
  const receivedRaw = (row[0] ?? '').trim();
  const reporter = (row[1] ?? '').trim();
  const body = row[2] ?? '';
  if (!receivedRaw && !body.trim()) return null;
  if (receivedRaw === '受信日時') return null; // ヘッダー行

  // 「勤怠：」が書かれていない投稿は勤怠報告ではないので取り込まない。
  // 1つの投稿に「※〇〇くん」と別スタッフの補足が続くことがあるが、
  // そのブロックには勤怠区分が書かれておらず遅刻か早退か判断できないため、
  // 独立した記録としては扱わない（投稿全文は raw に残る）
  const kindField = extractField(body, '勤怠');
  if (!kindField) return null;

  const receivedAt = parseReceivedAt(receivedRaw);
  const dateField = extractField(body, '日付');

  return {
    date: receivedAt ? resolveDate(dateField, receivedAt) : '',
    kind: detectKind(kindField),
    staff: extractField(body, 'スタッフ'),
    site: extractField(body, '勤務地'),
    reason: extractField(body, '理由'),
    workTime: extractField(body, '勤務時間'),
    breakTime: extractField(body, '休憩'),
    reporter,
    receivedAt: receivedRaw,
    raw: body.trim(),
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const month = new URL(request.url).searchParams.get('month') ?? '';

  try {
    const rows = await getSheetData(KINTAI_SHEET).catch(() => [] as string[][]);

    const records = rows
      .map(parseKintaiRow)
      .filter((r): r is KintaiRecord => r !== null)
      // 日付が読めなかった投稿は受信日時で月を判定する（黙って消さない）
      .filter((r) => !month || (r.date || r.receivedAt.replace(/\//g, '-')).startsWith(month))
      .sort((a, b) => (b.date || b.receivedAt).localeCompare(a.date || a.receivedAt));

    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
