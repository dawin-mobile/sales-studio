import { google } from 'googleapis';
import path from 'path';
import type { User, Role } from '@/types';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const USER_SHEET_NAME = 'スタッフ情報';

export async function getSheetsClient() {
  let auth;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    // Vercel: credentials from environment variable
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error('[sheets] GOOGLE_SERVICE_ACCOUNT_JSON のJSONパースに失敗しました。値が正しい形式か確認してください:', e);
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON のJSONパースに失敗しました');
    }
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH) {
    // Local: credentials from file
    const keyFilePath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_PATH);
    auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: SCOPES,
    });
  } else {
    console.error('[sheets] Google認証情報が設定されていません。Vercelでは GOOGLE_SERVICE_ACCOUNT_JSON、ローカルでは GOOGLE_SERVICE_ACCOUNT_PATH を設定してください。');
    throw new Error('Google認証情報が設定されていません (GOOGLE_SERVICE_ACCOUNT_JSON または GOOGLE_SERVICE_ACCOUNT_PATH が必要)');
  }

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

const ACCESS_LOG_SHEET = 'アクセスログ';

export async function appendAccessLog(userName: string, tabName: string): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) return;

  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${ACCESS_LOG_SHEET}'!A:C`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now, userName, tabName]] },
  });
}

export async function getSheetData(sheetName: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('[sheets] GOOGLE_SPREADSHEET_ID が設定されていません');
    throw new Error('GOOGLE_SPREADSHEET_ID が設定されていません');
  }
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });
  return (res.data.values || []) as string[][];
}

export async function getShiftSheetData(sheetName: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SHIFT_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('[sheets] SHIFT_SPREADSHEET_ID が設定されていません');
    throw new Error('SHIFT_SPREADSHEET_ID が設定されていません');
  }
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });
  return (res.data.values || []) as string[][];
}

// 稼働カード用: 月ごとの東京・福岡シフトシートをまとめて取得する。
//
// シフトスプレッドシートは1回のアクセスに約2秒かかる（行数ではなくシート自体が重い）。
// 稼働カードは /api/talknote と /api/jisseki が同時に同じシートを読むため、
// ①2シートを1リクエストにまとめる ②5分キャッシュ ③取得中は同じPromiseを共有
// の3つで Sheets API へのアクセス回数を減らしている。
const SHIFT_CACHE_TTL = 5 * 60 * 1000; // 5分

export type ShiftMonthData = { tokyo: string[][]; fukuoka: string[][] };

const shiftMonthCache = new Map<string, { data: ShiftMonthData; expires: number }>();
const shiftMonthInflight = new Map<string, Promise<ShiftMonthData>>();

// month: 'YYYY-MM' → '26年7月【東京】' のようなシート名にする
function buildShiftSheetName(month: string, region: '東京' | '福岡'): string {
  const [year, mo] = month.split('-');
  return `${year.slice(2)}年${parseInt(mo)}月【${region}】`;
}

async function fetchShiftMonth(month: string): Promise<ShiftMonthData> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SHIFT_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('[sheets] SHIFT_SPREADSHEET_ID が設定されていません');
    throw new Error('SHIFT_SPREADSHEET_ID が設定されていません');
  }

  // 実際に使う列だけに絞る（東京はT列まで、福岡はL列まで）
  const tokyoRange = `${buildShiftSheetName(month, '東京')}!A:T`;
  const fukuokaRange = `${buildShiftSheetName(month, '福岡')}!A:L`;

  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [tokyoRange, fukuokaRange],
    });
    const [tokyo, fukuoka] = res.data.valueRanges ?? [];
    return {
      tokyo: (tokyo?.values ?? []) as string[][],
      fukuoka: (fukuoka?.values ?? []) as string[][],
    };
  } catch (e) {
    // 片方のシートが存在しない月などは batchGet 全体が失敗するため、個別取得に切り替える
    console.error('[sheets] シフトシートのbatchGetに失敗。個別取得で続行します:', e);
    const [tokyo, fukuoka] = await Promise.all([
      getShiftSheetData(tokyoRange).catch(() => [] as string[][]),
      getShiftSheetData(fukuokaRange).catch(() => [] as string[][]),
    ]);
    return { tokyo, fukuoka };
  }
}

export async function getShiftMonthData(month: string): Promise<ShiftMonthData> {
  const cached = shiftMonthCache.get(month);
  if (cached && cached.expires > Date.now()) return cached.data;

  // 同時に複数のAPIから呼ばれても、取得は1回だけにする
  const inflight = shiftMonthInflight.get(month);
  if (inflight) return inflight;

  const promise = fetchShiftMonth(month)
    .then((data) => {
      shiftMonthCache.set(month, { data, expires: Date.now() + SHIFT_CACHE_TTL });
      return data;
    })
    .finally(() => {
      shiftMonthInflight.delete(month);
    });

  shiftMonthInflight.set(month, promise);
  return promise;
}

// B列の背景色がオレンジ系かどうか（祝日判定）
function isOrangeBackground(color: { red?: number | null; green?: number | null; blue?: number | null } | null | undefined): boolean {
  if (!color) return false;
  const r = color.red ?? 0;
  const g = color.green ?? 0;
  const b = color.blue ?? 0;
  // オレンジ系: 赤が強く・緑が中程度・青が少ない。白(1,1,1)・黄(1,1,0)と区別する
  return r > 0.7 && g > 0.1 && g < 0.88 && b < 0.45 && r > g + 0.08;
}

// セル値と祝日日付セットを取得する。
// 値取得（values.get）が主系で、書式取得（spreadsheets.get）はベストエフォート。
// 書式取得に失敗しても値は必ず返す。
export async function getShiftSheetDataWithHolidays(
  sheetName: string
): Promise<{ values: string[][]; holidayDates: Set<string> }> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SHIFT_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('[sheets] SHIFT_SPREADSHEET_ID が設定されていません');
    throw new Error('SHIFT_SPREADSHEET_ID が設定されていません');
  }

  // ① 値取得（従来と同じ方法。シートがなければ空配列）
  const valRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });
  const values = (valRes.data.values || []) as string[][];

  // ② B列の背景色取得（失敗時は祝日なしで続行）
  const holidayDates = new Set<string>();
  try {
    const fmtPromise = sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId!,
      ranges: [`${sheetName}!B:B`],
      includeGridData: true,
    }).then((r) => r.data);

    // 書式取得は最大5秒。超えたら祝日なしで続行
    const fmtData = await Promise.race([
      fmtPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (fmtData) {
      const rowData = fmtData.sheets?.[0]?.data?.[0]?.rowData ?? [];
      for (let i = 0; i < rowData.length; i++) {
        const colBBg = rowData[i]?.values?.[0]?.effectiveFormat?.backgroundColor;
        if (isOrangeBackground(colBBg)) {
          const rawDate = values[i]?.[0] ?? '';
          const ymd = rawDate.match(/^(?:\d{2,4}[\/\-])(\d{1,2})[\/\-](\d{1,2})$/);
          const jp = !ymd ? rawDate.match(/(?:\d+年)?(\d{1,2})月(\d{1,2})日/) : null;
          const dateStr = ymd
            ? `${parseInt(ymd[1])}/${parseInt(ymd[2])}`
            : jp
            ? `${parseInt(jp[1])}/${parseInt(jp[2])}`
            : rawDate;
          if (dateStr && /\d/.test(dateStr)) {
            holidayDates.add(dateStr);
          }
        }
      }
    }
  } catch {
    // 書式取得失敗は無視（祝日色分けなしで表示）
  }

  return { values, holidayDates };
}

export async function getUserById(userId: string): Promise<(User & { passwordHash: string; rowIndex: number }) | null> {
  const rows = await getSheetData(USER_SHEET_NAME);
  // Skip header row
  // プロフィールシート: T列(19)=名前, U列(20)=ユーザーID, V列(21)=パスワード, W列(22)=ロール, X列(23)=有効
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = row[20];
    const name = row[19];
    const passwordHash = row[21];
    const role = row[22];
    const active = row[23];
    if (id === userId) {
      if (active?.toUpperCase() !== 'TRUE') return null;
      return {
        id,
        name,
        passwordHash,
        role: role as Role,
        active: true,
        rowIndex: i + 1, // 1-based for Sheets API
      };
    }
  }
  return null;
}

export async function getAllUsers(): Promise<{ name: string; role: Role }[]> {
  const rows = await getSheetData(USER_SHEET_NAME);
  const users: { name: string; role: Role }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[19];
    const role = row[22] as Role;
    const active = row[23];
    if (name && active?.toUpperCase() === 'TRUE') {
      users.push({ name, role });
    }
  }
  return users;
}

export type Gender = 'male' | 'female' | 'unknown';

/** スタッフ情報シートのT列背景色から性別を判定して返す（行インデックス対応） */
export async function getStaffGenders(): Promise<Gender[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) return [];
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: ['スタッフ情報!T:T'],
      includeGridData: true,
    });
    const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    return rowData.map((row) => {
      const bg = row?.values?.[0]?.effectiveFormat?.backgroundColor;
      if (!bg) return 'unknown' as Gender;
      const r = bg.red ?? 1, g = bg.green ?? 1, b = bg.blue ?? 1;
      if (b - r > 0.05) return 'male' as Gender;      // 水色
      if (r - b > 0.05 && g < 0.95) return 'female' as Gender; // ピンク
      return 'unknown' as Gender;
    });
  } catch {
    return [];
  }
}

export async function updateLastLogin(rowIndex: number): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId!,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `${USER_SHEET_NAME}!Y${rowIndex}`, values: [[now]] }, // 最終ログイン（共通）
        { range: `${USER_SHEET_NAME}!AD${rowIndex}`, values: [[now]] }, // 新アプリログイン記録
      ],
    },
  });
}
