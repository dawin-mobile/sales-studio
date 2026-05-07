import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  if ((session.user?.role as string) !== '管理者') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  try {
    const staffRows = await getSheetData('スタッフ情報');

    const result: { name: string; loginInfo: string }[] = [];
    for (let i = 1; i < staffRows.length; i++) {
      const row       = staffRows[i];
      const name      = row[19]?.trim(); // T列: 名前
      const active    = row[23]?.trim(); // X列: 有効
      const loginInfo = row[29]?.trim(); // AD列: 新アプリログイン情報

      if (!name || active?.toUpperCase() !== 'TRUE') continue;

      result.push({ name, loginInfo: loginInfo ?? '' });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
