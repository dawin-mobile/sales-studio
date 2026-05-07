import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const PREFECTURE_TO_REGION: Record<string, string> = {
  '北海道': '北海道',
  '青森': '東北', '岩手': '東北', '宮城': '東北', '秋田': '東北', '山形': '東北', '福島': '東北',
  '茨城': '関東', '栃木': '関東', '群馬': '関東', '埼玉': '関東', '千葉': '関東', '東京': '関東', '神奈川': '関東',
  '新潟': '中部', '富山': '中部', '石川': '中部', '福井': '中部', '山梨': '中部', '長野': '中部', '岐阜': '中部', '静岡': '中部', '愛知': '中部',
  '三重': '関西', '滋賀': '関西', '京都': '関西', '大阪': '関西', '兵庫': '関西', '奈良': '関西', '和歌山': '関西',
  '鳥取': '中国', '島根': '中国', '岡山': '中国', '広島': '中国', '山口': '中国',
  '徳島': '四国', '香川': '四国', '愛媛': '四国', '高知': '四国',
  '福岡': '九州・沖縄', '佐賀': '九州・沖縄', '長崎': '九州・沖縄', '熊本': '九州・沖縄',
  '大分': '九州・沖縄', '宮崎': '九州・沖縄', '鹿児島': '九州・沖縄', '沖縄': '九州・沖縄',
};

function calcAge(birthday: string): number | null {
  if (!birthday) return null;
  const serial = Number(birthday);
  let birth: Date;
  if (!isNaN(serial) && serial > 10000) {
    birth = new Date((serial - 25569) * 86400 * 1000);
  } else {
    birth = new Date(birthday.replace(/\//g, '-'));
  }
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 && age < 100 ? age : null;
}

function ageBracket(age: number): string {
  const low = Math.floor(age / 5) * 5;
  return `${low}-${low + 4}`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const regionFilter = searchParams.get('region') ?? '全国';

  try {
    // スタッフ情報シートから直接読み込み
    const rows = await getSheetData('スタッフ情報');
    const allStaff = rows.slice(1)
      .filter((row) => String(row[23] ?? '').trim().toUpperCase() === 'TRUE' && String(row[19] ?? '').trim())
      .map((row) => {
        const rawBlood = String(row[8] ?? '').trim();
        return {
          name:       String(row[19] ?? '').trim(),
          base:       String(row[1]  ?? '').trim(),
          birthday:   String(row[4]  ?? '').trim(),
          prefecture: String(row[7]  ?? '').trim().replace(/[都道府県]$/, ''),
          bloodType:  rawBlood ? (rawBlood.endsWith('型') ? rawBlood : rawBlood + '型') : '',
          animal:     String(row[10] ?? '').trim(),
          role:       String(row[22] ?? '').trim(),
          gender:     String(row[27] ?? '').trim(),
        };
      });

    const prefectures: Record<string, number> = {};
    const regions: Record<string, number> = {};
    const bloodTypes: Record<string, number> = {};
    const roleCounts: Record<string, number> = { 社員: 0, アルバイト: 0, 業務委託: 0 };
    const animalTypes: Record<string, number> = {};
    const ageBrackets: Record<string, number> = {};
    let genderMale = 0, genderFemale = 0;
    let total = 0;

    const genderStaff: { male: string[]; female: string[] } = { male: [], female: [] };
    const bloodStaff: Record<string, string[]> = {};
    const animalStaff: Record<string, string[]> = {};
    const ageBracketStaff: Record<string, string[]> = {};
    const regionStaff: Record<string, string[]> = {};
    const roleStaff: Record<string, string[]> = { 社員: [], アルバイト: [], 業務委託: [] };
    const genderMap: Record<string, 'male' | 'female'> = {};
    const prefectureStaff: Record<string, string[]> = {};

    for (const s of allStaff) {
      const name = s.name;

      // 拠点フィルター
      if (regionFilter !== '全国' && s.base !== regionFilter) continue;

      total++;

      // ロール
      const role = s.role ?? '';
      let roleKey: string;
      if (role === 'アルバイト') { roleKey = 'アルバイト'; roleCounts['アルバイト']++; }
      else if (role === '社員' || role === '管理者') { roleKey = '社員'; roleCounts['社員']++; }
      else { roleKey = '業務委託'; roleCounts['業務委託']++; }
      roleStaff[roleKey].push(name);

      // 出身地
      const prefecture = s.prefecture ?? '';
      if (prefecture) {
        prefectures[prefecture] = (prefectures[prefecture] || 0) + 1;
        const region = PREFECTURE_TO_REGION[prefecture] || '海外';
        regions[region] = (regions[region] || 0) + 1;
        if (!regionStaff[region]) regionStaff[region] = [];
        regionStaff[region].push(name);
        if (!prefectureStaff[prefecture]) prefectureStaff[prefecture] = [];
        prefectureStaff[prefecture].push(name);
      }

      // 血液型
      const bloodType = s.bloodType ?? '';
      if (bloodType) {
        bloodTypes[bloodType] = (bloodTypes[bloodType] || 0) + 1;
        if (!bloodStaff[bloodType]) bloodStaff[bloodType] = [];
        bloodStaff[bloodType].push(name);
      }

      // 動物占い
      const animal = s.animal ?? '';
      if (animal) {
        animalTypes[animal] = (animalTypes[animal] || 0) + 1;
        if (!animalStaff[animal]) animalStaff[animal] = [];
        animalStaff[animal].push(name);
      }

      // 年齢
      const age = calcAge(s.birthday ?? '');
      if (age !== null) {
        const bracket = ageBracket(age);
        ageBrackets[bracket] = (ageBrackets[bracket] || 0) + 1;
        if (!ageBracketStaff[bracket]) ageBracketStaff[bracket] = [];
        ageBracketStaff[bracket].push(name);
      }

      // 性別
      const gender = s.gender ?? '';
      if (gender === '男') { genderMale++; genderStaff.male.push(name); genderMap[name] = 'male'; }
      else if (gender === '女') { genderFemale++; genderStaff.female.push(name); genderMap[name] = 'female'; }
    }

    return NextResponse.json({
      prefectures, regions, bloodTypes, total, roleCounts,
      animalTypes, ageBrackets,
      genders: { male: genderMale, female: genderFemale },
      genderStaff, bloodStaff, animalStaff, ageBracketStaff, regionStaff, roleStaff, genderMap, prefectureStaff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
