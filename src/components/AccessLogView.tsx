'use client';

import { useEffect, useState } from 'react';
import type { UserStat, TabStat } from '@/app/api/access-log/route';

const BAR_COLOR = 'rgba(var(--ov), 0.75)';

function timeAgo(dateStr: string): string {
  // 記録の日時は「2026/10/29 9:38:08」のように月・日・時がゼロ埋めなしなので、数字を取り出して日付にする
  // （「2026-10-29T9:38:08」のように置き換えるだけだと、時が1桁のとき日付として読めない）
  const m = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return dateStr;
  const [, y, mo, day, h, mi] = m.map(Number);
  // 時刻ではなく日付の差で数える（昨日の夜の記録を「今日」と出さないように）
  const today = new Date();
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(y, mo - 1, day).getTime()) / 86400000);
  if (days === 0) return `今日 ${h}:${String(mi).padStart(2, '0')}`;
  if (days === 1) return '1日前';
  if (days < 7) return `${days}日前`;
  // 「2026/9/9 18:25:59」を先頭10文字で切ると時刻の一部が混ざるので、日付を組み立て直す
  return `${y}/${mo}/${day}`;
}

// 今月（日本時間）を「2026-10」の形で
function currentMonthJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

// 「2026-10」→「10月」。今年でなければ「2025年12月」
function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return y === currentMonthJst().slice(0, 4) ? `${parseInt(m)}月` : `${y}年${parseInt(m)}月`;
}

export default function AccessLogView() {
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [tabStats, setTabStats] = useState<TabStat[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  // 表示する月（'all' は全期間）。最初は今月
  const [month, setMonth] = useState(currentMonthJst());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/access-log?month=${month}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setUserStats(d.userStats ?? []);
        setTabStats(d.tabStats ?? []);
        if (Array.isArray(d.months)) setMonths(d.months);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  if (loading && months.length === 0) return (
    <div className="shift-loading"><div className="shift-loading-spinner" /><div>読み込み中...</div></div>
  );

  const maxTabCount = tabStats[0]?.count ?? 1;
  // 今月の記録がまだなくても今月を選べるようにする
  const monthOptions = [...new Set([currentMonthJst(), ...months])];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>

      {/* 月の切り替え（新しい月から順に。最後に全期間） */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {[...monthOptions, 'all'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setLoading(true); setMonth(m); }}
            className={`shift-region-btn${month === m ? ' active' : ''}`}
            style={{ flexShrink: 0, border: month === m ? undefined : '1px solid var(--border-color)' }}
          >
            {m === 'all' ? '全期間' : monthLabel(m)}
          </button>
        ))}
      </div>

      {/* 機能別ランキング */}
      <div className="chart-card" style={{ minHeight: 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          機能別アクセス数
        </div>
        {tabStats.length === 0 && !loading && (
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>この月の記録はありません</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tabStats.map((t, i) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text-sub)', width: 14, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: 'var(--text-main)', width: 80, flexShrink: 0 }}>{t.name}</span>
              <div style={{ flex: 1, background: 'rgba(var(--ov), 0.06)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
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
          // その人が使った機能を全部、回数の多い順に出す
          const topTabs = Object.entries(u.tabs).sort((a, b) => b[1] - a[1]);
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
                    <div style={{ flex: 1, background: 'rgba(var(--ov), 0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
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
