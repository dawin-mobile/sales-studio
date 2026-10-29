import { canUseNippoForm, NIPPO_FORM_POSITIONS } from './nippoForm';
import { getSheetDataCached } from './sheets';

/**
 * アプリから日報を書けるか（サーバー側で判定する）。
 * ロール・名前で決まる人に加えて、スタッフ情報の AC列（役職）が準ディレクターの人も使える。
 * スタッフ情報は5分使い回すので、役職を変えたら最大5分で反映される
 */
export async function canUseNippo(name: string, role: string | undefined): Promise<boolean> {
  if (canUseNippoForm(name, role)) return true;
  const rows = await getSheetDataCached('スタッフ情報');
  const position = rows.find((r) => r[19] === name)?.[28]?.trim();
  return !!position && NIPPO_FORM_POSITIONS.includes(position);
}
