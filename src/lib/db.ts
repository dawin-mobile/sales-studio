import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzleNeon<typeof schema>>;

let _db: DrizzleDb | null = null;

export function getDb(): DrizzleDb {
  if (!_db) {
    const url = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL が設定されていません');
    }

    if (url.includes('neon.tech')) {
      // Neon: HTTPドライバーを使用（サーバーレスで高速）
      const sql = neon(url);
      _db = drizzleNeon(sql, { schema }) as unknown as DrizzleDb;
    } else {
      // Supabase等: TCPドライバー（トランザクションモードpooler）
      const poolerUrl = url.replace(/\.pooler\.supabase\.com:5432/, '.pooler.supabase.com:6543');
      const client = postgres(poolerUrl, {
        ssl: 'require',
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      });
      _db = drizzlePg(client, { schema }) as unknown as DrizzleDb;
    }
  }
  return _db;
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getDb() as any)[prop];
  },
});
