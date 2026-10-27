import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetDataCached } from '@/lib/sheets';
import { NIPPO_FORM_USERS } from '@/lib/nippoForm';

export const dynamic = 'force-dynamic';

/**
 * 過去の日報（合算データ）から、ログイン中のユーザーが勤務地ごとに前回入れた往復交通費を返す。
 *   GET /api/nippo-form/fares → { fares: [{ location, fare, date }] }（勤務地ごとに一番新しい日の1件）
 *
 * 合算データは約2万行あり全列を読むと遅いので、B〜F列（勤務日・名前・勤務地）と AG列（往復交通費）だけ読む。
 * 読み込み結果は全員分まとめて5分キャッシュし、ここで本人の行だけに絞る（Sheets API の読み取り上限対策）。
 * そのため出したばかりの日報の交通費は、最大5分遅れて反映される。
 * 勤務地は自由記述でシフト表の表記と揃わないため、照合は画面側で「どちらかがもう一方を含むか」で行う。
 */
export async function GET() {
  const session = await auth();
  const name = session?.user?.name;
  if (!name) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!NIPPO_FORM_USERS.includes(name)) return NextResponse.json({ fares: [] });

  try {
    const [left, fareCol] = await Promise.all([
      getSheetDataCached('合算データ!B:F'),
      getSheetDataCached('合算データ!AG:AG'),
    ]);

    const latest = new Map<string, { location: string; fare: string; date: string }>();
    for (let i = 1; i < left.length; i++) {
      const [date, rowName, , , location] = left[i] ?? []; // B=勤務日, C=名前, F=勤務地
      const fare = fareCol[i]?.[0]?.trim();
      if (rowName !== name || !date || !location?.trim() || !fare) continue;
      const key = location.trim();
      const prev = latest.get(key);
      // 同じ日なら後の行（後から出した日報）を優先する
      if (!prev || date >= prev.date) latest.set(key, { location: key, fare, date });
    }

    return NextResponse.json({ fares: [...latest.values()] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラーが発生しました' },
      { status: 500 }
    );
  }
}
