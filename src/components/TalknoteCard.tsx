'use client';

import { useState, useEffect } from 'react';

interface ShiftSite {
  location: string;
  staff: string[];
  agency: string;
  region: string;
}

interface SiteMap {
  [site: string]: {
    [staffName: string]: { postedAt: string; message: string }[];
  };
}

interface TalknoteData {
  date: string;
  siteOrder: ShiftSite[];
  siteMap: SiteMap;
}

const PILL_COLORS = [
  { bg: 'rgba(248,113,113,0.20)', text: '#f87171' },
  { bg: 'rgba(251,146,60,0.20)',  text: '#fb923c' },
  { bg: 'rgba(250,204,21,0.20)',  text: '#facc15' },
  { bg: 'rgba(163,230,53,0.20)',  text: '#a3e635' },
  { bg: 'rgba(74,222,128,0.20)',  text: '#4ade80' },
  { bg: 'rgba(45,212,191,0.20)',  text: '#2dd4bf' },
  { bg: 'rgba(34,211,238,0.20)',  text: '#22d3ee' },
  { bg: 'rgba(56,189,248,0.20)',  text: '#38bdf8' },
  { bg: 'rgba(129,140,248,0.20)', text: '#818cf8' },
  { bg: 'rgba(192,132,252,0.20)', text: '#c084fc' },
  { bg: 'rgba(244,114,182,0.20)', text: '#f472b6' },
  { bg: 'rgba(251,113,133,0.20)', text: '#fb7185' },
];

function agencyColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
  return PILL_COLORS[h % PILL_COLORS.length];
}

function normalizeSiteName(location: string): string {
  // IY → イトーヨーカドー に展開
  let name = location.replace(/^IY/, 'イトーヨーカドー');
  // スペース（半角・全角）以降を除去
  const spaceIdx = name.search(/[ 　]/);
  return spaceIdx === -1 ? name : name.slice(0, spaceIdx);
}

const WORK_KEYWORDS = [
  'MNP', '新規', 'NEW', 'new',
  'セルアップ', 'アップセル', 'cellup',
  'クレカ', 'ゴールド', '自銀', '金クレカ', '銀クレカ',
  '光', 'ひかり', '事変', '事業者変更', 'biglobe',
  'でんき', 'ガス',
  'SIM', 'sim', '端末',
  'docomo', 'ドコモ', 'UQ', '楽天', 'ワイモバイル', 'ahamo',
];

function isWorkRelated(message: string): boolean {
  return WORK_KEYWORDS.some((kw) => message.toLowerCase().includes(kw.toLowerCase()));
}

function countWorkPosts(postsByStaff: SiteMap[string]): number {
  return Object.values(postsByStaff).reduce(
    (sum, posts) => sum + posts.filter((p) => isWorkRelated(p.message)).length,
    0
  );
}

function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48))
    .replace(/[×✕✖ｘＸ]/g, 'x');
}

// 除外プレフィックス（新規の直前にあったらカウントしない）
const SHIN_EXCLUDE_PREFIX = /(?:タブ\S*|光|[Bb]iglobe\S*|ビッグローブ\S*)$/;

function countShin(msg: string): number {
  let shin = 0;
  for (const match of msg.matchAll(/新規(?:\([^)]*\))?[x×]?\s*(\d+)?/g)) {
    const before = msg.slice(0, match.index);
    // 同じ行の直前テキストだけチェック（前の行に除外ワードがあっても無視）
    const sameLine = before.split('\n').pop() ?? '';
    if (SHIN_EXCLUDE_PREFIX.test(sameLine)) continue;
    shin += match[1] ? parseInt(match[1]) : 1;
  }
  return shin;
}

function countMnpNew(postsByStaff: SiteMap[string]): { mnp: number; shin: number } {
  let mnp = 0, shin = 0;
  for (const posts of Object.values(postsByStaff)) {
    for (const post of posts) {
      const msg = normalize(post.message);

      // MNP○台: "MNP2" → 2台、"MNP" alone → 1台
      const mnpMatches = [...msg.matchAll(/MNP(\d+)/gi)];
      if (mnpMatches.length > 0) {
        mnp += mnpMatches.reduce((s, m) => s + parseInt(m[1]), 0);
      } else if (/MNP/i.test(msg)) {
        mnp += 1;
      }

      shin += countShin(msg);
    }
  }
  return { mnp, shin };
}

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildCopyText(postsByStaff: SiteMap[string]): string {
  const parts: string[] = [];
  for (const [staffName, posts] of Object.entries(postsByStaff)) {
    const workPosts = posts.filter((p) => isWorkRelated(p.message));
    if (workPosts.length === 0) continue;
    parts.push('');
    parts.push(staffName);
    parts.push(workPosts.map((p) => p.message).join('\n\n'));
  }
  return parts.join('\n');
}

function SiteCard({ site, staffList, agency, siteMap }: {
  site: string;
  staffList: string[];
  agency: string;
  siteMap: SiteMap;
}) {
  const postsByStaff = siteMap[site] ?? {};
  const workCount = countWorkPosts(postsByStaff);
  const hasReport = workCount > 0;
  const { mnp, shin } = countMnpNew(postsByStaff);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(buildCopyText(postsByStaff)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: '9px 12px',
        background: 'rgba(255,255,255,0.025)',
        borderBottom: hasReport ? '1px solid var(--border-color)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        {/* 1行目: 現場名・代理店・MNP/新規 */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', flexShrink: 0 }}>
            {normalizeSiteName(site)}
          </span>

          {agency && (() => { const c = agencyColor(agency); return (
            <span style={{
              fontSize: 10,
              color: c.text,
              background: c.bg,
              border: `1px solid ${c.text}44`,
              borderRadius: 4,
              padding: '1px 6px',
              flexShrink: 0,
            }}>
              {agency}
            </span>
          ); })()}

          {hasReport && (mnp > 0 || shin > 0) && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
          {mnp > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: '#60a5fa',
              background: 'rgba(96,165,250,0.12)',
              border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: 20, padding: '2px 9px',
            }}>
              MNP {mnp}台
            </span>
          )}
          {shin > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: '#4ade80',
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.25)',
              borderRadius: 20, padding: '2px 9px',
            }}>
              新規 {shin}台
            </span>
          )}
            </div>
          )}
        </div>

        {/* 2行目: スタッフバッジ + コピーボタン */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {staffList.map((name) => (
            <span key={name} style={{
              fontSize: 10,
              color: '#aaa',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              padding: '1px 6px',
              whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
          ))}
          {hasReport && (
            <button
              onClick={handleCopy}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                background: copied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${copied ? '#4ade80' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 6, padding: '3px 9px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.2s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={copied ? '#4ade80' : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {copied
                  ? <polyline points="20 6 9 17 4 12" />
                  : <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>
                }
              </svg>
              <span style={{ fontSize: 10, color: copied ? '#4ade80' : '#bbb', whiteSpace: 'nowrap' }}>
                {copied ? 'コピー済み' : 'コピー'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* コンテンツ */}
      {hasReport ? (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(postsByStaff).map(([staffName, posts]) => {
            const workPosts = posts.filter((p) => isWorkRelated(p.message));
            if (workPosts.length === 0) return null;
            return (
              <div key={staffName}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-sub)',
                  marginBottom: 4,
                  letterSpacing: '0.02em',
                }}>
                  {staffName}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.65,
                  opacity: 0.85,
                  paddingLeft: 8,
                }}>
                  {workPosts.map((p) => p.message).join('\n\n')}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: '7px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          報告なし
        </div>
      )}


    </div>
  );
}

type Region = '関東' | '九州';

export default function TalknoteCard() {
  const [date, setDate] = useState(todayString());
  const [data, setData] = useState<TalknoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState<Region>('関東');

  // ログインユーザーの拠点に基づいてデフォルト地域を設定
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.base === '九州') setRegion('九州');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/talknote?date=${date}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [date]);

  // 関東→東京、九州→福岡 に変換してフィルター
  const regionKey = region === '関東' ? '東京' : '福岡';
  const orderedSites = data
    ? data.siteOrder.filter((s) => s.staff.length > 0 && (s.region === regionKey || s.region === ''))
    : [];

  const totalReports = orderedSites.reduce((sum, s) => {
    return sum + countWorkPosts(data?.siteMap[s.location] ?? {});
  }, 0);

  return (
    <div className="chart-card" style={{ marginTop: 16, marginBottom: 20, minHeight: 'unset' }}>
      {/* カードヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-main)' }}>
            稼働
          </h3>
          {/* 関東/九州トグル */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2, gap: 2 }}>
            {(['関東', '九州'] as Region[]).map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  background: region === r ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: region === r ? 'var(--text-main)' : 'var(--text-muted)',
                  transition: 'background 0.15s',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            color: 'var(--text-main)',
            fontSize: 12,
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        />
      </div>

      {loading && (
        <div style={{ color: 'var(--text-sub)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          読み込み中...
        </div>
      )}

      {!loading && orderedSites.length === 0 && (
        <div style={{ color: 'var(--text-sub)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          この日のシフトデータはありません
        </div>
      )}

      {!loading && data && orderedSites.map((s) => (
        <SiteCard
          key={s.location}
          site={s.location}
          staffList={s.staff}
          agency={s.agency}
          siteMap={data.siteMap}
        />
      ))}
    </div>
  );
}
