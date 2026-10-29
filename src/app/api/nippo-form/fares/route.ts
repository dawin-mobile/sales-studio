import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetDataCached } from '@/lib/sheets';
import { canUseNippoForm } from '@/lib/nippoForm';

export const dynamic = 'force-dynamic';

/**
 * 過去の日報（合算データ）から、ログイン中のユーザーが勤務地ごとに入れた往復交通費を返す。
 *   GET /api/nippo-form/fares → { fares: [{ location, fare, date, order }] }（勤務地ごとに新しい順で最大5件）
 * order は合算データの行番号＝提出した順（自社フォームの行は提出順に並ぶ）。
 * 「新しい順」は勤務日ではなく提出順で決める。勤務日は打ち間違いがあり、
 * 2025/12/31 提出で勤務日が 2026/12/31 のような行が「一番新しい日報」扱いになってしまうため。
 * 0円の日（車の乗り合わせなど）は数えない。0円が入ったまま送ると交通費をもらいそびれるが、
 * 空欄なら必須チェックで止まって本人が気づける。
 * 画面側で、該当する勤務地の直近5回のうち一番多い金額を入れる。
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
  if (!canUseNippoForm(name, session.user.role)) return NextResponse.json({ fares: [] });

  try {
    const [left, fareCol] = await Promise.all([
      getSheetDataCached('合算データ!B:F'),
      getSheetDataCached('合算データ!AG:AG'),
    ]);

    type Fare = { location: string; fare: string; date: string; order: number };
    const byLocation = new Map<string, Fare[]>();
    for (let i = 1; i < left.length; i++) {
      const [date, rowName, , , location] = left[i] ?? []; // B=勤務日, C=名前, F=勤務地
      const fare = fareCol[i]?.[0]?.trim();
      if (rowName !== name || !date || !location?.trim() || !fare || !(parseFloat(fare) > 0)) continue;
      const key = location.trim();
      byLocation.set(key, [...(byLocation.get(key) ?? []), { location: key, fare, date, order: i }]);
    }

    // 表記ゆれでまとめても直近5回を出せるよう、勤務地の表記ごとに新しい順で5件ずつ返す
    const fares = [...byLocation.values()].flatMap((list) =>
      list.sort((a, b) => b.order - a.order).slice(0, 5)
    );
    return NextResponse.json({ fares });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラーが発生しました' },
      { status: 500 }
    );
  }
}
