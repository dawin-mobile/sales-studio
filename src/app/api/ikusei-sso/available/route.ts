import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getIkuseiStaffNames, resolveIkuseiName } from '@/lib/ikusei';

export const dynamic = 'force-dynamic';

// 育成アプリのボタンを出してよいかを返す。
// 査定シートに載っていない人には押しても合言葉画面しか出ないため、ボタン自体を隠す。
const STAFF_SWITCH_ROLES = ['社員', '幹部', '管理者'];

export async function GET() {
  const session = await auth();
  if (!session?.user?.name) {
    return NextResponse.json({ available: false });
  }

  try {
    // 社員以上はスタッフ選択で他スタッフを開けるので、登録済みの氏名一覧を返す。
    // 画面側は選択中の相手が一覧にあるときだけボタンを出す。
    if (STAFF_SWITCH_ROLES.includes(session.user.role ?? '')) {
      return NextResponse.json({ available: true, staffNames: await getIkuseiStaffNames() });
    }

    const sateiName = await resolveIkuseiName(session.user.name);
    return NextResponse.json({ available: sateiName !== null });
  } catch (error) {
    console.error('[ikusei-sso] 査定シートの確認に失敗しました:', error);
    return NextResponse.json({ available: false });
  }
}
