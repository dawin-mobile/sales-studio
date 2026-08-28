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

// 1つの投稿に複数人分が書かれることがあるため、「勤怠：」の行を区切りにして分割する。
// 最初のブロックだけは、その手前にある「日付：」を含めたいので先頭から取る。
//
//   日付：8月28日(金)      ┐
//   勤怠：早退             │ ブロック1（馬塲さん）
//   スタッフ：馬塲         ┘
//   勤怠：遅刻             ┐ ブロック2（西山さん）
//   スタッフ：西山         ┘
//
// 「勤怠：」がないブロック（現場移動の連絡など）は区切りにならず、
// 直前の人のブロックに含まれる＝独立した記録にはならない
function splitKintaiBlocks(body: string): string[] {
  const starts: number[] = [];
  const re = /^[ \t　]*勤怠[ \t　]*[：:]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) starts.push(m.index);
  if (starts.length === 0) return [];

  // 「日付：」は「勤怠：」より上に書かれるため、区切り位置をその分だけ手前にずらす。
  // そうしないと2人目の日付が1人目のブロックに入ってしまう
  const bounds = starts.map((start, i) => (i === 0 ? 0 : moveBoundaryBack(body, start)));

  return bounds.map((from, i) => {
    const to = i + 1 < bounds.length ? bounds[i + 1] : body.length;
    return body.slice(from, to);
  });
}

// 「勤怠：」の直前にある空行と「日付：」の行を、次のブロック側に含める
function moveBoundaryBack(body: string, start: number): number {
  let pos = start;
  while (pos > 0) {
    const prevBreak = body.lastIndexOf('\n', pos - 2);
    const lineStart = prevBreak + 1;
    const line = body.slice(lineStart, pos - 1);
    const isBlank = line.trim() === '';
    const isDate = /^[ \t　]*日付[ \t　]*[：:]/.test(line);
    if (!isBlank && !isDate) break;
    pos = lineStart;
  }
  return pos;
}

export function parseKintaiRow(row: string[]): KintaiRecord[] {
  const receivedRaw = (row[0] ?? '').trim();
  const reporter = (row[1] ?? '').trim();
  const body = row[2] ?? '';
  if (!receivedRaw && !body.trim()) return [];
  if (receivedRaw === '受信日時') return []; // ヘッダー行

  // 「勤怠：」が書かれていない投稿は勤怠報告ではないので取り込まない
  const blocks = splitKintaiBlocks(body);
  if (blocks.length === 0) return [];

  const receivedAt = parseReceivedAt(receivedRaw);
  // 日付は投稿の先頭に1回だけ書かれることが多い。2人目以降のブロックに
  // 日付がなければ、先頭ブロックの日付を引き継ぐ
  const firstDate = receivedAt ? resolveDate(extractField(blocks[0], '日付'), receivedAt) : '';

  return blocks.map((block) => {
    const ownDate = receivedAt ? resolveDate(extractField(block, '日付'), receivedAt) : '';
    return {
      date: ownDate || firstDate,
      kind: detectKind(extractField(block, '勤怠')),
      staff: extractField(block, 'スタッフ'),
      site: extractField(block, '勤務地'),
      reason: extractField(block, '理由'),
      workTime: extractField(block, '勤務時間'),
      breakTime: extractField(block, '休憩'),
      reporter,
      receivedAt: receivedRaw,
      raw: block.trim(),
    };
  });
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
      .flatMap(parseKintaiRow)
      // 日付が読めなかった投稿は受信日時で月を判定する（黙って消さない）
      .filter((r) => !month || (r.date || r.receivedAt.replace(/\//g, '-')).startsWith(month))
      .sort((a, b) => (b.date || b.receivedAt).localeCompare(a.date || a.receivedAt));

    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
