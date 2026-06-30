import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const [staffRows, knowledgeRows] = await Promise.all([
      getSheetData('スタッフ情報'),
      getSheetData('知識'),
    ]);

    // 知識シートから担当マッピングを構築
    // Row 0,1 はヘッダー。Row 2+ が実データ
    // Col A (index 0): アルバイト名, Col B (index 1): 担当（メンター姓）
    const mentorMap: Record<string, string[]> = {}; // 担当姓 → アルバイト名[]
    for (let i = 2; i < knowledgeRows.length; i++) {
      const staffName  = knowledgeRows[i][0]?.trim();
      const mentorName = knowledgeRows[i][1]?.trim();
      if (!staffName || !mentorName || mentorName === 'なし' || mentorName === '未定') continue;
      if (!mentorMap[mentorName]) mentorMap[mentorName] = [];
      mentorMap[mentorName].push(staffName);
    }

    // 社員連絡先を構築
    // 担当姓マッチ: 社員フルネームが mentorMap のキーで始まるか確認
    const contacts: { name: string; contact: string; mentees: string[] }[] = [];

    for (let i = 1; i < staffRows.length; i++) {
      const row     = staffRows[i];
      const name    = row[19]?.trim(); // T列: 名前
      const role    = row[22]?.trim(); // W列: ロール
      const active  = row[23]?.trim(); // X列: 有効
      const contact = row[25]?.trim(); // Z列: 連絡先

      if (!name || active?.toUpperCase() !== 'TRUE') continue;
      if (role !== '社員' && role !== '管理者') continue;
      if (!contact) continue;

      // 担当姓が名前の先頭に一致するものを探す
      const mentees = Object.entries(mentorMap)
        .filter(([mentorKey]) => name.startsWith(mentorKey))
        .flatMap(([, names]) => names);

      contacts.push({ name, contact, mentees });
    }

    return NextResponse.json(contacts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
