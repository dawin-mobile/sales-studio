'use client';

import { useEffect, useState } from 'react';
import type { UserStat, TabStat } from '@/app/api/access-log/route';

const BAR_COLOR = 'rgba(255,255,255,0.75)';

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr.replace(/\//g, '-').replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今日';
  if (days === 1) return '1日前';
  if (days < 7) return `${days}日前`;
  return dateStr.slice(0, 10);
}

export default function AccessLogView() {
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [tabStats, setTabStats] = useState<TabStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/access-log')
      .then(r => r.json())
      .then(d => { setUserStats(d.userStats ?? []); setTabStats(d.tabStats ?? []); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="shift-loading"><div className="shift-loading-spinner" /><div>読み込み中...</div></div>
  );

  const maxTabCount = tabStats[0]?.count ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 機能別ランキング */}
      <div className="chart-card" style={{ minHeight: 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          機能別アクセス数
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tabStats.map((t, i) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text-sub)', width: 14, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: 'var(--text-main)', width: 80, flexShrink: 0 }}>{t.name}</span>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                  width: `${(t.count / maxTabCount) * 100}%`,
                  height: '100%',
                  background: BAR_COLOR,
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-sub)', width: 32, textAlign: 'right' }}>{t.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ユーザー別サマリー */}
      <div className="chart-card" style={{ minHeight: 'auto', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 11, color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>
          ユーザー別アクセス
        </div>
        {userStats.map((u, i) => {
          const topTabs = Object.entries(u.tabs).sort((a, b) => b[1] - a[1]).slice(0, 4);
          const maxT = topTabs[0]?.[1] ?? 1;
          return (
            <div key={u.name} style={{
              padding: '12px 16px',
              borderBottom: i < userStats.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>{u.total}回</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>{timeAgo(u.lastAccess)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {topTabs.map(([tab, cnt]) => (
                  <div key={tab} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-sub)', width: 72, flexShrink: 0 }}>{tab}</span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(cnt / maxT) * 100}%`,
                        height: '100%',
                        background: BAR_COLOR,
                        opacity: 0.6,
                        borderRadius: 3,
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-sub)', width: 24, textAlign: 'right' }}>{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
