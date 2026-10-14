import { pgTable, serial, text, numeric, boolean, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * 合算データシート
 * COL: DATE=1, NAME=2, SITE=5, MNP_H=6, MNP_S=7, NEW=8, CHANGE=9,
 *      CELLUP=10, HIKARI_N=11, HIKARI_T=12, HIKARI_C=13,
 *      TABLET=14, LIFE=15, CREDIT=16, SELF_CLOSE=17
 */
export const salesRecords = pgTable('sales_records', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),           // 'YYYY-MM-DD'
  staffName: text('staff_name').notNull(),
  site: text('site').default(''),
  mnpH: numeric('mnp_h').default('0'),
  mnpS: numeric('mnp_s').default('0'),
  newCount: numeric('new_count').default('0'),
  changeCount: numeric('change_count').default('0'),
  cellup: numeric('cellup').default('0'),
  hikariN: numeric('hikari_n').default('0'),
  hikariT: numeric('hikari_t').default('0'),
  hikariC: numeric('hikari_c').default('0'),
  tablet: numeric('tablet').default('0'),
  life: numeric('life').default('0'),
  credit: numeric('credit').default('0'),
  selfClose: numeric('self_close').default('0'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * グラフ用データ_年代シート
 * [タイムスタンプ, 名前, 年代, 件数]
 */
export const ageRecords = pgTable('age_records', {
  id: serial('id').primaryKey(),
  recordedAt: text('recorded_at').notNull(), // ISO string from GAS timestamp
  staffName: text('staff_name').notNull(),
  ageGroup: text('age_group').notNull(),
  count: numeric('count').default('1'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * グラフ用データ_家族構成シート
 * [タイムスタンプ, 名前, 組数, 件数]
 */
export const typeRecords = pgTable('type_records', {
  id: serial('id').primaryKey(),
  recordedAt: text('recorded_at').notNull(),
  staffName: text('staff_name').notNull(),
  typeGroup: text('type_group').notNull(),
  count: numeric('count').default('1'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * シフトデータ（東京・福岡）
 * GASから送られるパース済みの ShiftRow 配列を格納
 */
export const shiftRows = pgTable('shift_rows', {
  id: serial('id').primaryKey(),
  month: text('month').notNull(),         // 'YYYY-MM'
  date: text('date').notNull(),
  dayOfWeek: text('day_of_week').default(''),
  carrier: text('carrier').default(''),   // シフト表C列（au / SB / 増強）
  location: text('location').default(''),
  startTime: text('start_time').default(''),
  order1: text('order1').default(''),
  order2: text('order2').default(''),
  staff: jsonb('staff').$type<string[]>().default([]),
  finalStaff: text('final_staff').default(''),
  agency: text('agency').default(''),
  sheetRegion: text('sheet_region').notNull(), // '東京' | '福岡'
  isHoliday: boolean('is_holiday').default(false),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * 社員シフトグリッド
 * {date, dayOfWeek, staffName, value} を月×スタッフ数分格納
 */
export const employeeShifts = pgTable('employee_shifts', {
  id: serial('id').primaryKey(),
  month: text('month').notNull(),         // 'YYYY-MM'
  date: text('date').notNull(),           // 'MM/DD'
  dayOfWeek: text('day_of_week').default(''),
  staffName: text('staff_name').notNull(),
  value: text('value').default(''),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * シフトシートのスタッフ名リスト（ヘッダー行から抽出）
 */
export const shiftStaffNames = pgTable('shift_staff_names', {
  id: serial('id').primaryKey(),
  month: text('month').notNull(),
  sheetRegion: text('sheet_region').notNull(), // '東京' | '福岡'
  names: jsonb('names').$type<string[]>().notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * スタッフ育成データ（評価＋知識を統合）
 * 常に最新1件のみ保持（月次なし）
 */
export const staffEvaluations = pgTable('staff_evaluations', {
  id: serial('id').primaryKey(),
  staffName: text('staff_name').notNull(),
  totalScore: numeric('total_score').default('0'),
  rank: numeric('rank').default('0'),
  potential: text('potential').default(''),       // 高/中/低
  attendance: text('attendance').default(''),     // 高/中/低
  attribute: text('attribute').default(''),       // フリーター/学生
  supervisor: text('supervisor').default(''),     // 担当者名
  scores: jsonb('scores').$type<Record<string, number>>().default({}),
  knowledge: jsonb('knowledge').$type<Record<string, boolean>>().default({}),
  knowledgeItems: jsonb('knowledge_items').$type<string[]>().default([]),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * スタッフプロフィール
 * スタッフ情報シートから毎日同期（全件洗い替え）
 */
export const staffProfiles = pgTable('staff_profiles', {
  id:          serial('id').primaryKey(),
  name:        text('name').notNull(),
  base:        text('base').default(''),        // B列: 拠点（関東/九州）
  birthday:    text('birthday').default(''),    // E列: 生年月日
  prefecture:  text('prefecture').default(''),  // H列: 出身都道府県
  bloodType:   text('blood_type').default(''),  // I列: 血液型
  animal:      text('animal').default(''),      // K列: 動物占い
  role:        text('role').default(''),        // W列: ロール
  gender:      text('gender').default(''),      // AB列: 性別
  syncedAt:    timestamp('synced_at', { withTimezone: true }).defaultNow(),
});

/**
 * トークノート投稿ログ
 * Talknoteから受信した投稿をそのまま保存。店舗はシフトDBから補完。
 */
export const talknotePosts = pgTable('talknote_posts', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),          // 'YYYY-MM-DD'
  postedAt: text('posted_at').notNull(), // '2026-03-31 10:14:00'
  staffName: text('staff_name').notNull(),
  site: text('site').default(''),
  message: text('message').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex('talknote_posts_posted_at_staff_name_key').on(t.postedAt, t.staffName),
]);
