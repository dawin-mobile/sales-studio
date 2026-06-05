import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

export const revalidate = 300;

export interface TantouEntry {
  name: string;
  position: string;
  supervisor: string;
  years: number;
  months: number;
}

function calcTenure(raw: string): { years: number; months: number } {
  if (!raw) return { years: 0, months: 0 };
  const serial = Number(raw);
  let join: Date;
  if (!isNaN(serial) && serial > 10000) {
    join = new Date((serial - 25569) * 86400 * 1000);
  } else {
    join = new Date(raw.replace(/\//g, '-'));
  }
  if (isNaN(join.getTime())) return { years: 0, months: 0 };
  const today = new Date();
  let years = today.getFullYear() - join.getFullYear();
  let months = today.getMonth() - join.getMonth();
  if (today.getDate() < join.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return { years: Math.max(0, years), months: Math.max(0, months) };
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
  const unassigned: string[] = []; // 担当なしのスタッフ
  for (let i = 2; i < knRows.length; i++) {
    const staffName = String(knRows[i][0] || '').trim();
    const mentorKey = String(knRows[i][1] || '').trim();
    if (!staffName) continue;
    if (!mentorKey || mentorKey === 'なし' || mentorKey === '未定') {
      unassigned.push(staffName);
    } else {
      if (!mentorMap[mentorKey]) mentorMap[mentorKey] = [];
      mentorMap[mentorKey].push(staffName);
    }
  }

  // スタッフ情報: T列(19)=名前, X列(23)=有効, J列(9)=入社日, AC列(28)=役職
  const positionMap: { name: string; position: string; joinDate: string }[] = [];
  for (let i = 1; i < staffRows.length; i++) {
    const name     = String(staffRows[i][19] || '').trim(); // T列
    const position = String(staffRows[i][28] || '').trim(); // AC列
    const joinDate = String(staffRows[i][9]  || '').trim(); // J列
    if (name) positionMap.push({ name, position, joinDate });
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
      const matched = positionMap.find(p => p.name.includes(menteeName) || menteeName.includes(p.name));
      const tenure = calcTenure(matched?.joinDate ?? '');
      result.push({ name: menteeName, position: matched?.position ?? '', supervisor: supervisorName, ...tenure });
    }
  }

  // 担当なしスタッフを末尾に追加
  for (const menteeName of unassigned) {
    const matched = positionMap.find(p => p.name.includes(menteeName) || menteeName.includes(p.name));
    const tenure = calcTenure(matched?.joinDate ?? '');
    result.push({ name: menteeName, position: matched?.position ?? '', supervisor: '', ...tenure });
  }

  return NextResponse.json({ staff: result });
}
