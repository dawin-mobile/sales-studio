import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { appendAccessLog } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.name) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tab } = await request.json();
  if (!tab) return NextResponse.json({ ok: false });

  try {
    await appendAccessLog(session.user.name, tab);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[track] エラー:', e);
    return NextResponse.json({ ok: false });
  }
}
