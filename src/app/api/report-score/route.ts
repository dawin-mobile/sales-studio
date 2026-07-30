import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { auth } from '@/lib/auth';
import { ReportScoreData, ReportScoreItem, ReportScoreMissing, ReportScoreGrade } from '@/types';

export const dynamic = 'force-dynamic';

// 採点結果タブ列(22, A〜V): 0日付 1現場 2キャリア 3終担 4種別 5提出 6投稿日時 7状態
//   8育成確定 9育成点 10育成コメント 11現指確定 12現指点 13現指コメント
//   14育成G 15育成C 16現指G 17現指C 18育成対象 19本文抜粋 20採点日時 21報告者
// Report Studio（上司運用のCloud Run）が夜間バッチで書き込む。ここは読むだけ
const RESULT_SHEET = '採点結果';
const STAFF_SHEET = 'スタッフ情報';

const ROLE_ORDER = ['業務委託', 'アルバイト', '社員', '幹部', '管理者'];
function hasMinRole(role: string | undefined, min: string): boolean {
  return ROLE_ORDER.indexOf(role ?? '') >= ROLE_ORDER.indexOf(min);
}

// Report Studio側の名寄せ・字体ゆれ吸収ルールをそのまま踏襲（育成対象の表示に使用）
const HON = /(さん|くん|君|ちゃん|様|さま|氏)$/;
const KANJI: Record<string, string> = { '髙': '高', '塲': '場', '﨑': '崎', '桒': '桑' };
function nkanji(s: string): string {
  return [...s].map((c) => KANJI[c] ?? c).join('');
}
const ALIAS: Record<string, string> = {
  'すぎ': '杉原', 'くにごう': '救仁郷', 'リアム': '救仁郷', 'りあむ': '救仁郷',
  '大野かよ': '大野賀', '岡田兄': '岡田和', '岡田ともき': '岡田和', 'ともき': '岡田和',
  '岡田さとし': '岡田怜', 'さとし': '岡田怜', '岡田弟': '岡田怜', 'こうじ': '鈴木幸',
  '阿部ゆ': '阿部', 'あべゆず': '阿部', '森山翼': '森山', '馬場光優': '馬場',
  '真里亜': '黒川', 'まりあ': '黒川', 'ゆい': '村山', 'すぎも': '杉本',
};

// 育成対象は自社スタッフ（業務委託を除く）だけに絞る
async function selfStaffSet(): Promise<Set<string>> {
  const set = new Set(Object.values(ALIAS));
  try {
    const rows = await getSheetData(STAFF_SHEET);
    for (const row of rows.slice(1)) {
      if ((row[22] ?? '').trim() === '業務委託') continue;
      const raw = (row[19] ?? '').split(/\s+/)[0]?.trim();
      if (!raw) continue;
      const nm = ALIAS[nkanji(raw)] ?? nkanji(raw);
      set.add(nm);
    }
  } catch {
    // スタッフ情報が読めなくてもALIAS由来の名前だけで続行
  }
  return set;
}

function cleanTargets(raw: string, selfSet: Set<string>): string {
  const out: string[] = [];
  for (const part of (raw || '').split(/[・、,／/\s]+/)) {
    const p = ALIAS[nkanji(part.trim()).replace(HON, '').trim()] ?? nkanji(part.trim()).replace(HON, '').trim();
    if (p && selfSet.has(p) && !out.includes(p)) out.push(p);
  }
  return out.join('・');
}

const WD = ['月', '火', '水', '木', '金', '土', '日'];
function youbiOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=日〜6=土
  return WD[(jsDay + 6) % 7];
}

function cell(row: string[], i: number): string {
  const v = row[i];
  return v !== undefined && v !== null ? String(v).trim() : '';
}

function venueDisplay(carrier: string, venue: string): string {
  return (carrier ? carrier + ' ' : '') + venue;
}

export async function GET() {
  const session = await auth();
  if (!session || !hasMinRole(session.user?.role, '社員')) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const [rawRows, selfSet] = await Promise.all([
      getSheetData(RESULT_SHEET),
      selfStaffSet(),
    ]);
    const rows = rawRows.slice(1); // ヘッダー行を除く

    const reports: ReportScoreItem[] = [];
    const missing1: ReportScoreMissing[] = [];
    const missing2: ReportScoreMissing[] = [];
    let idc = 0;

    for (const row of rows) {
      const date = cell(row, 0);
      if (!date) continue;
      const carrier = cell(row, 2);
      const shu = cell(row, 3);
      const typ = cell(row, 4);
      const sub = cell(row, 5);
      const vdisp = venueDisplay(carrier, cell(row, 1));
      const writer = cell(row, 21) || shu;

      if (sub === '未提出') {
        const item: ReportScoreMissing = { date, venue: vdisp, sur: shu.split(/\s+/)[0] || '', reporter: shu };
        (typ === '現場' ? missing1 : missing2).push(item);
        continue;
      }
      if (sub !== '提出') continue;

      const status = cell(row, 7);
      const ikuF = cell(row, 8);
      const genF = cell(row, 11);
      const pending = status === '査定待ち' && !(ikuF && genF);
      const show = (final: string): ReportScoreGrade => (final ? (final as ReportScoreGrade) : pending ? '待' : '');

      idc++;
      reports.push({
        id: idc,
        date,
        youbi: youbiOf(date),
        venue: vdisp,
        reporter: writer,
        shu,
        target: cleanTargets(cell(row, 18), selfSet) || '—',
        iku: show(ikuF),
        gen: show(genF),
        ikuC: cell(row, 10),
        genC: cell(row, 13),
        body: cell(row, 19),
        pending,
        aiIkuG: cell(row, 14),
        aiIkuC: cell(row, 15),
        aiGenG: cell(row, 16),
        aiGenC: cell(row, 17),
      });
    }

    const data: ReportScoreData = { reports, missing1, missing2 };
    return NextResponse.json(data);
  } catch (e) {
    console.error('[report-score] エラー:', e);
    return NextResponse.json({ reports: [], missing1: [], missing2: [] } as ReportScoreData);
  }
}
