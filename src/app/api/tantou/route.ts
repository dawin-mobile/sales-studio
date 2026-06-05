import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

export const revalidate = 300;

export interface TantouEntry {
  name: string;
  position: string;
  supervisor: string;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [staffRows, knRows] = await Promise.all([
    getSheetData('スタッフ情報'),
    getSheetData('知識'),
  ]);

  // スタッフ情報: A列(0)=名前, AC列(28)=役職
  // 部分一致で引けるよう全エントリを配列で保持
  const staffList: { name: string; position: string }[] = [];
  for (let i = 1; i < staffRows.length; i++) {
    const name = String(staffRows[i][0] || '').trim();
    const position = String(staffRows[i][28] || '').trim();
    if (name) staffList.push({ name, position });
  }

  // 知識シートを主軸: A列(0)=名前, B列(1)=担当上司 (row0-1はヘッダー)
  const result: TantouEntry[] = [];
  for (let i = 2; i < knRows.length; i++) {
    const knName = String(knRows[i][0] || '').trim();
    const supervisor = String(knRows[i][1] || '').trim();
    if (!knName) continue;
    // 部分一致でAC列の役職を取得（短い名前でも一致させる）
    const matched = staffList.find(s => s.name.includes(knName) || knName.includes(s.name));
    result.push({ name: knName, position: matched?.position ?? '', supervisor });
  }

  return NextResponse.json({ staff: result });
}
