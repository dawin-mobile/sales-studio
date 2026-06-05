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

  // 知識シート: A列(0)=名前, B列(1)=担当上司 (row0-1はヘッダー)
  const supervisorMap = new Map<string, string>();
  for (let i = 2; i < knRows.length; i++) {
    const name = String(knRows[i][0] || '').trim();
    const supervisor = String(knRows[i][1] || '').trim();
    if (name) supervisorMap.set(name, supervisor);
  }

  // スタッフ情報: A列(0)=名前, W列(22)=ロール, AC列(28)=役職
  const result: TantouEntry[] = [];
  for (let i = 1; i < staffRows.length; i++) {
    const row = staffRows[i];
    const name = String(row[0] || '').trim();
    const role = String(row[22] || '').trim();
    const position = String(row[28] || '').trim();
    if (!name || role !== 'アルバイト') continue;
    result.push({
      name,
      position,
      supervisor: supervisorMap.get(name) || '',
    });
  }

  return NextResponse.json({ staff: result });
}
