import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SHIRYO, canViewShiryo } from '@/lib/shiryo';

export const dynamic = 'force-dynamic';

// 「資料」画面の一覧。見られるロールは src/lib/shiryo.ts の SHIRYO_ALLOWED_ROLES
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canViewShiryo(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const items = [...SHIRYO].sort((a, b) => b.updated.localeCompare(a.updated));
  return NextResponse.json({ items });
}
