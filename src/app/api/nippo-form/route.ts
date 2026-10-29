import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { shiftRows } from '@/lib/schema';
import { getSheetDataCached } from '@/lib/sheets';
import { isOnFormNameList } from '@/lib/nippoFormNames';
import {
  NIPPO_FORM_ID,
  canUseNippoForm,
  areaFromBase,
  buildFormBody,
  validateNippo,
  type NippoMode,
  type NippoSubmission,
} from '@/lib/nippoForm';

export const dynamic = 'force-dynamic';

const MODES: NippoMode[] = ['normal', 'zero', 'training'];

// 勤務エリアはスタッフ情報 B列「拠点」（関東在籍は関東、九州在籍は九州）。T列=名前
// 送信が21時前後に集中するため5分キャッシュを使う（拠点はめったに変わらない）
async function getArea(name: string): Promise<string> {
  const rows = await getSheetDataCached('スタッフ情報');
  return areaFromBase(rows.find((r) => r[19] === name)?.[1]);
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * アプリから日報を書くための API。
 *
 *   GET  /api/nippo-form?date=YYYY-MM-DD … 使えるか＋その日のシフトから勤務地の候補を返す
 *   POST /api/nippo-form                 … 日報フォームへ代理送信する
 *
 * 名前は必ずログイン中のユーザーを使う（画面から名前は受け取らない＝他人の名前で出せない）。
 * 勤務エリアも画面からは受け取らず、送信時にスタッフ情報の拠点から決める。
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const name = session?.user?.name;
  if (!name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canUseNippoForm(name, session.user.role)) return NextResponse.json({ available: false });
  // フォームの名前プルダウンにない人は送信できないので、ボタンを出さない
  if (!(await isOnFormNameList(name))) return NextResponse.json({ available: false });

  const dateParam = new URL(request.url).searchParams.get('date') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayJst();
  const [y, m, d] = date.split('-').map(Number);

  try {
    const rows = await db
      .select({
        date: shiftRows.date,
        location: shiftRows.location,
        staff: shiftRows.staff,
        carrier: shiftRows.carrier,
        startTime: shiftRows.startTime,
        agency: shiftRows.agency,
      })
      .from(shiftRows)
      .where(and(eq(shiftRows.month, `${y}-${String(m).padStart(2, '0')}`), eq(shiftRows.date, `${m}/${d}`)));

    const locations: string[] = [];
    for (const row of rows) {
      // 稼働ではない行（健康診断など）は除く。/api/nippo-check と同じ判定
      if (!row.carrier?.trim() && !row.startTime?.trim() && !row.agency?.trim()) continue;
      const staff = (row.staff as string[]) ?? [];
      const isMine = staff.some((s) => {
        const sn = s?.trim();
        return !!sn && (name.startsWith(sn) || sn.startsWith(name));
      });
      const location = row.location?.trim();
      if (!isMine || !location || locations.includes(location)) continue;
      locations.push(location);
    }

    return NextResponse.json({ available: true, name, date, locations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const name = session?.user?.name;
  if (!name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canUseNippoForm(name, session.user.role)) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  let submission: NippoSubmission;
  try {
    const body = await request.json();
    submission = {
      date: String(body.date ?? ''),
      location: String(body.location ?? ''),
      mode: MODES.includes(body.mode) ? body.mode : 'normal',
      values: typeof body.values === 'object' && body.values ? body.values : {},
    };
  } catch {
    return NextResponse.json({ error: '送信内容を読み取れませんでした' }, { status: 400 });
  }

  const errors = validateNippo(submission);
  if (errors.length > 0) return NextResponse.json({ error: errors.join('\n') }, { status: 400 });

  try {
    const area = await getArea(name);
    const res = await fetch(`https://docs.google.com/forms/d/e/${NIPPO_FORM_ID}/formResponse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildFormBody(submission, name, area).toString(),
    });
    // 受け付けると 200（完了画面「回答を記録しました」）、必須の欠けなど入力エラーのときは 400 とフォーム画面が返る（記録はされない）。
    // 完了画面にもフォームの定義データは含まれるので、HTML の中身ではなくステータスで判定する
    if (!res.ok) {
      console.error('[nippo-form] フォームが受け付けなかった', res.status);
      return NextResponse.json(
        { error: 'フォームに受け付けられませんでした。時間をおいて再度送るか、Googleフォームから提出してください' },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[nippo-form] 送信エラー', error);
    return NextResponse.json(
      { error: 'フォームへの送信に失敗しました。Googleフォームから提出してください' },
      { status: 502 }
    );
  }
}
