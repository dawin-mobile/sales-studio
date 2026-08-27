import crypto from 'crypto';
import { getSheetData } from '@/lib/sheets';

// 育成アプリ（上司が運用するCloud Runアプリ）との SSO 連携。
//
// 氏名の表記が両者で異なる点に注意：
//   Sales Studio（スタッフ情報T列） : 「木下裕太」 スペースなし
//   育成アプリ（アルバイト査定シート）: 「木下 裕太」 姓名の間に半角スペース
// 育成アプリは氏名の完全一致で本人を特定するため、署名する前に必ず
// 査定シート側の表記へ変換する（resolveIkuseiName）。

export const IKUSEI_APP_ORIGIN = 'https://mobile-ikusei-887493910809.asia-northeast1.run.app';
export const IKUSEI_SSO_URL = `${IKUSEI_APP_ORIGIN}/api/sso`;
export const IKUSEI_LOGIN_URL = `${IKUSEI_APP_ORIGIN}/login`;

const SATEI_SHEET_NAME = 'アルバイト査定';
const SATEI_NAME_COL = 1; // B列: 名前
const SATEI_HEADER_ROWS = 4; // 行0〜3はタイトル・見出し。データは行4から
const SATEI_CACHE_TTL = 5 * 60 * 1000; // 5分

let sateiCache: { names: string[]; expires: number } | null = null;

// 照合用に空白（半角・全角）を除去する。査定シートは「木下 裕太」、
// スタッフ情報は「木下裕太」なので、この正規化を挟まないと一致しない。
export function normalizeName(name: string): string {
  return name.replace(/[\s　]/g, '');
}

async function getSateiNames(): Promise<string[]> {
  if (sateiCache && sateiCache.expires > Date.now()) return sateiCache.names;

  const rows = await getSheetData(SATEI_SHEET_NAME);
  const names = rows
    .slice(SATEI_HEADER_ROWS)
    .map((row) => row[SATEI_NAME_COL]?.trim() ?? '')
    .filter((name) => name.length > 0);

  sateiCache = { names, expires: Date.now() + SATEI_CACHE_TTL };
  return names;
}

// 査定シートに載っている全員の氏名を、空白を除いた形（Sales Studio と同じ表記）で返す。
// 社員がスタッフ選択したとき、その相手が育成アプリに登録済みかを画面側で判定するのに使う。
export async function getIkuseiStaffNames(): Promise<string[]> {
  const names = await getSateiNames();
  return names.map(normalizeName);
}

// Sales Studio の氏名を、査定シートに載っている表記へ変換する。
// 見つからない場合（社員・業務委託・査定シート未登録のアルバイト）は null。
export async function resolveIkuseiName(userName: string): Promise<string | null> {
  const target = normalizeName(userName);
  if (!target) return null;

  const names = await getSateiNames();
  return names.find((name) => normalizeName(name) === target) ?? null;
}

// 育成アプリ向けの署名付きURLを生成する。ts から5分間のみ有効なので、
// 事前生成してキャッシュせず、リンクが押された直後に毎回呼ぶこと。
export function buildIkuseiSsoUrl(sateiName: string, secret: string): string {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', secret).update(`${sateiName}:${ts}`).digest('hex');

  return `${IKUSEI_SSO_URL}?name=${encodeURIComponent(sateiName)}&ts=${ts}&sig=${sig}`;
}
