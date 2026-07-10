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
const SHIN_EXCLUDE_PREFIX = /(?:タブ\S*|光|ひかり|\S*[ろロ]\S*|[Bb]iglobe\S*|ビッグローブ\S*)$/;
// 除外キーワード（新規と同じ行・次の行に含まれていたらカウントしない）
const SHIN_EXCLUDE_LINE = /予定|明日|明後日|来週|翌日|[0-9０-９]{1,2}[\/／][0-9０-９]{1,2}|[0-9０-９]{1,2}月[0-9０-９]{1,2}日/;

function countShin(msg: string): number {
  let shin = 0;
  for (const match of msg.matchAll(/新規(?:\([^)]*\))?[x×]?\s*(\d+)?/g)) {
    const before = msg.slice(0, match.index);
    const after = msg.slice((match.index ?? 0) + match[0].length);
    const beforeLines = before.split('\n');
    const sameLine = beforeLines.pop() ?? '';
    const prevLine = beforeLines.pop() ?? '';
    const afterLines = after.split('\n');
    const afterLine = afterLines[0] ?? '';
    const nextLine = afterLines[1] ?? '';
    const nextNextLine = afterLines[2] ?? '';
    const fullLine = sameLine + afterLine;
    if (SHIN_EXCLUDE_PREFIX.test(sameLine)) continue;
    if (SHIN_EXCLUDE_LINE.test(prevLine) || SHIN_EXCLUDE_LINE.test(fullLine) || SHIN_EXCLUDE_LINE.test(nextLine) || SHIN_EXCLUDE_LINE.test(nextNextLine)) continue;
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
      for (const match of msg.matchAll(/MNP(\d+)?/gi)) {
        const before = msg.slice(0, match.index);
        const after = msg.slice((match.index ?? 0) + match[0].length);
        const beforeLines = before.split('\n');
        const sameLine = beforeLines.pop() ?? '';
        const prevLine = beforeLines.pop() ?? '';
        const afterLines = after.split('\n');
        const afterLine = afterLines[0] ?? '';
        const nextLine = afterLines[1] ?? '';
        const nextNextLine = afterLines[2] ?? '';
        const fullLine = sameLine + afterLine;
        if (SHIN_EXCLUDE_LINE.test(prevLine) || SHIN_EXCLUDE_LINE.test(fullLine) || SHIN_EXCLUDE_LINE.test(nextLine) || SHIN_EXCLUDE_LINE.test(nextNextLine)) continue;
        mnp += match[1] ? parseInt(match[1]) : 1;
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

function SiteCard({ site, staffList, agency, siteMap, filterWork = true, badgeSiteMap, externalCollapsed }: {
  site: string;
  staffList: string[];
  agency: string;
  siteMap: SiteMap;
  filterWork?: boolean;
  badgeSiteMap?: SiteMap;
  externalCollapsed?: boolean;
}) {
  const postsByStaff = siteMap[site] ?? {};
  const badgePostsByStaff = badgeSiteMap ? (badgeSiteMap[site] ?? {}) : postsByStaff;
  const workCount = filterWork ? countWorkPosts(postsByStaff) : Object.values(postsByStaff).reduce((s, ps) => s + ps.length, 0);
  const hasReport = workCount > 0;
  const { mnp, shin } = countMnpNew(badgePostsByStaff);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => { if (externalCollapsed !== undefined) setCollapsed(externalCollapsed); }, [externalCollapsed]);

  const handleCopy = () => {
    const text = filterWork ? buildCopyText(postsByStaff) : Object.entries(postsByStaff).map(([n, ps]) => `\n${n}\n${ps.map((p) => p.message).join('\n\n')}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
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
      <div
        onClick={() => setCollapsed((v) => !v)}
        style={{
          padding: '9px 12px',
          background: 'rgba(255,255,255,0.025)',
          borderBottom: hasReport && !collapsed ? '1px solid var(--border-color)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* 1行目: 現場名・代理店・MNP/新規 */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', flexShrink: 0 }}>
            {normalizeSiteName(site)}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>

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
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
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
      {!collapsed && hasReport ? (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(postsByStaff).map(([staffName, posts]) => {
            const workPosts = filterWork ? posts.filter((p) => isWorkRelated(p.message)) : posts;
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
                <div style={{ paddingLeft: 8 }}>
                  {workPosts.map((p, idx) => (
                    <div key={idx}>
                      {idx > 0 && (
                        <hr style={{
                          border: 'none',
                          borderTop: '1px solid rgba(255,255,255,0.08)',
                          margin: '8px 0',
                        }} />
                      )}
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-main)',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.65,
                        opacity: 0.85,
                      }}>
                        {p.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (!collapsed && (
        <div style={{
          padding: '7px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          報告なし
        </div>
      ))}


    </div>
  );
}

type Region = '関東' | '九州';
type Tab = 'talknote' | 'jisseki';

export default function TalknoteCard() {
  const [date, setDate] = useState(todayString());
  const [data, setData] = useState<TalknoteData | null>(null);
  const [jissekiData, setJissekiData] = useState<TalknoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [jissekiLoading, setJissekiLoading] = useState(false);
  const [region, setRegion] = useState<Region>('関東');
  const [tab, setTab] = useState<Tab>('talknote');

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

  useEffect(() => {
    setJissekiLoading(true);
    fetch(`/api/jisseki?date=${date}`)
      .then((r) => r.json())
      .then((d) => setJissekiData(d))
      .catch(() => setJissekiData(null))
      .finally(() => setJissekiLoading(false));
  }, [date]);

  const activeData = tab === 'talknote' ? data : jissekiData;
  const isLoading = tab === 'talknote' ? loading : jissekiLoading;
  const [allCollapsed, setAllCollapsed] = useState<boolean>(true);

  // 関東→東京、九州→福岡 に変換してフィルター
  const regionKey = region === '関東' ? '東京' : '福岡';
  const orderedSites = activeData
    ? activeData.siteOrder.filter((s) => s.staff.length > 0 && (s.region === regionKey || s.region === ''))
    : [];

  // 実績報告タブのみ: 現場不明の報告を「その他」として追加
  const otherSiteEntries = tab === 'jisseki' && jissekiData?.siteMap?.['その他']
    ? Object.keys(jissekiData.siteMap['その他']).length > 0
    : false;

  return (
    <div className="chart-card" style={{ marginTop: 16, marginBottom: 20, minHeight: 'unset' }}>
      {/* カードヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-main)' }}>
            稼働
          </h3>
          {/* Talknote/実績報告タブ */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2, gap: 2 }}>
            {([['talknote', 'Talknote'], ['jisseki', '実績報告']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  background: tab === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: tab === t ? 'var(--text-main)' : 'var(--text-muted)',
                  transition: 'background 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
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
          {/* 一括開閉トグル */}
          <button
            onClick={() => setAllCollapsed((v) => !v)}
            title={allCollapsed ? 'すべて開く' : 'すべて閉じる'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 4px', display: 'flex', flexDirection: 'column',
              gap: 2.5, alignItems: 'center', justifyContent: 'center', opacity: 0.5,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
          >
            {allCollapsed ? (
              /* 展開アイコン: 上下に広がる2本の矢印 */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 20 12 15 17 20" />
                <line x1="12" y1="15" x2="12" y2="9" />
                <polyline points="7 4 12 9 17 4" />
              </svg>
            ) : (
              /* 折りたたみアイコン: 内側に向かう2本の矢印 */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 9 12 14 17 9" />
                <line x1="12" y1="14" x2="12" y2="20" />
                <polyline points="7 15 12 10 17 15" />
              </svg>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => {
              const d = new Date(date); d.setDate(d.getDate() - 1);
              setDate(d.toISOString().slice(0, 10));
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: 18, padding: '0 4px', lineHeight: 1, opacity: 0.7 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          >‹</button>
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
          <button
            onClick={() => {
              const d = new Date(date); d.setDate(d.getDate() + 1);
              setDate(d.toISOString().slice(0, 10));
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: 18, padding: '0 4px', lineHeight: 1, opacity: 0.7 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          >›</button>
        </div>
      </div>

      {isLoading && (
        <div style={{ color: 'var(--text-sub)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          読み込み中...
        </div>
      )}

      {!isLoading && orderedSites.length === 0 && (
        <div style={{ color: 'var(--text-sub)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          {tab === 'jisseki' ? 'この日の実績報告はありません' : 'この日のシフトデータはありません'}
        </div>
      )}


      {!isLoading && activeData && orderedSites.map((s) => (
        <SiteCard
          key={s.location}
          site={s.location}
          staffList={s.staff}
          agency={s.agency}
          siteMap={activeData.siteMap}
          filterWork={tab === 'talknote'}
          badgeSiteMap={tab === 'jisseki' && data ? data.siteMap : undefined}
          externalCollapsed={allCollapsed}
        />
      ))}

      {/* 実績報告タブ: 現場不明の報告 */}
      {!isLoading && tab === 'jisseki' && otherSiteEntries && jissekiData && (
        <SiteCard
          key="その他"
          site="その他"
          staffList={[]}
          agency=""
          siteMap={jissekiData.siteMap}
          filterWork={false}
        />
      )}
    </div>
  );
}
