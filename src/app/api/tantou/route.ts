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

  // 知識シートから 担当姓 → アルバイト名[] のマップを構築（contacts APIと同じ）
  const mentorMap: Record<string, string[]> = {};
  for (let i = 2; i < knRows.length; i++) {
    const staffName  = String(knRows[i][0] || '').trim();
    const mentorKey  = String(knRows[i][1] || '').trim();
    if (!staffName || !mentorKey || mentorKey === 'なし' || mentorKey === '未定') continue;
    if (!mentorMap[mentorKey]) mentorMap[mentorKey] = [];
    mentorMap[mentorKey].push(staffName);
  }

  // スタッフ情報: T列(19)=名前, X列(23)=有効, AC列(28)=役職
  // アルバイト名(短い) → 役職 の部分一致マップ
  const positionMap: { name: string; position: string }[] = [];
  for (let i = 1; i < staffRows.length; i++) {
    const name     = String(staffRows[i][19] || '').trim(); // T列
    const position = String(staffRows[i][28] || '').trim(); // AC列
    if (name) positionMap.push({ name, position });
  }

  // 社員ごとに担当アルバイトリストを組み立て
  const result: TantouEntry[] = [];
  for (let i = 1; i < staffRows.length; i++) {
    const supervisorName = String(staffRows[i][19] || '').trim(); // T列
    const active         = String(staffRows[i][23] || '').trim(); // X列
    if (!supervisorName || active.toUpperCase() !== 'TRUE') continue;

    // 担当姓が名前の先頭と一致するキーを探す
    const mentees = Object.entries(mentorMap)
      .filter(([key]) => supervisorName.startsWith(key))
      .flatMap(([, names]) => names);
    if (mentees.length === 0) continue;

    for (const menteeName of mentees) {
      // アルバイト役職を部分一致で取得
      const matched = positionMap.find(p => p.name.includes(menteeName) || menteeName.includes(p.name));
      result.push({ name: menteeName, position: matched?.position ?? '', supervisor: supervisorName });
    }
  }

  return NextResponse.json({ staff: result });
}
