import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildIkuseiSsoUrl, resolveIkuseiName, IKUSEI_LOGIN_URL } from '@/lib/ikusei';

export const dynamic = 'force-dynamic';

// 社員以上は「スタッフ切り替え」で他スタッフの育成アプリを開ける
const STAFF_SWITCH_ROLES = ['社員', '幹部', '管理者'];

// 育成アプリへのSSO入口。対象スタッフの氏名で署名付きURLを作り、そこへ飛ばす。
// 署名は5分で失効するため、リンクが押されるたびにここで作り直す（キャッシュ厳禁）。
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.name) {
    return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL ?? 'http://localhost:3000'));
  }

  // 切り替え先の氏名はクライアントから渡されるため、権限は必ずサーバー側で判定する。
  // （画面側の userRole は切り替え中だと切り替え先の役職になるので判定に使えない）
  const requestedStaff = request.nextUrl.searchParams.get('staff')?.trim();
  const canSwitch = STAFF_SWITCH_ROLES.includes(session.user.role ?? '');
  const targetName = requestedStaff && canSwitch ? requestedStaff : session.user.name;

  const secret = process.env.IKUSEI_SSO_SECRET;
  if (!secret) {
    console.error('[ikusei-sso] IKUSEI_SSO_SECRET が設定されていません');
    return redirectNoStore(IKUSEI_LOGIN_URL);
  }

  try {
    // 育成アプリは氏名の完全一致で本人を特定するので、査定シート側の表記に変換する
    const sateiName = await resolveIkuseiName(targetName);
    if (!sateiName) {
      // 査定シートに未登録（社員・業務委託・新規アルバイト）。仕様どおり合言葉画面へ
      return redirectNoStore(IKUSEI_LOGIN_URL);
    }

    return redirectNoStore(buildIkuseiSsoUrl(sateiName, secret));
  } catch (error) {
    console.error('[ikusei-sso] SSO URLの生成に失敗しました:', error);
    return redirectNoStore(IKUSEI_LOGIN_URL);
  }
}

// 署名付きURLは5分で失効するため、ブラウザ・CDNのどちらにも保存させない
function redirectNoStore(url: string): NextResponse {
  return NextResponse.redirect(url, {
    status: 307,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
