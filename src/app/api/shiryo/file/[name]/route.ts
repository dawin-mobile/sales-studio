import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { auth } from '@/lib/auth';
import { shiryoFileNames, canViewShiryo } from '@/lib/shiryo';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

// 資料のファイル（画像・PDF）をログインした人にだけ返す。
// 出せるのは src/lib/shiryo.ts の一覧に書かれたファイル名だけ（それ以外のパスは読まない）
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canViewShiryo(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 日本語のファイル名は %E3%81… の形のまま届くことがあるので、元に戻してから照合する
  let { name } = await params;
  try {
    name = decodeURIComponent(name);
  } catch {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  const type = CONTENT_TYPES[path.extname(name).toLowerCase()];
  if (!shiryoFileNames().has(name) || !type) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const body = await readFile(path.join(process.cwd(), 'content', 'shiryo', 'files', name));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': type,
        // 端末にだけ1時間キャッシュ（共有キャッシュには置かない）
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
}
