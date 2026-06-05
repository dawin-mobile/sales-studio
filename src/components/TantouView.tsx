'use client';

import { useState, useEffect } from 'react';
import type { TantouEntry } from '@/app/api/tantou/route';

export default function TantouView() {
  const [staff, setStaff] = useState<TantouEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tantou')
      .then(r => r.json())
      .then(d => setStaff(d.staff ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="shift-loading">
        <div className="shift-loading-spinner" />
      </div>
    );
  }

  // 担当上司ごとにグループ化
  const grouped = new Map<string, TantouEntry[]>();
  for (const s of staff) {
    const key = s.supervisor || '未設定';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const sortedGroups = [...grouped.entries()]; // APIがスタッフ情報の行順（入社歴順）で返す

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sortedGroups.map(([supervisor, members]) => (
        <div key={supervisor} className="chart-card" style={{ minHeight: 'auto', padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 10, fontWeight: 600 }}>
            担当：{supervisor}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500, minWidth: 80 }}>
                  {s.name}
                </span>
                {s.position && (() => {
                  const c = s.position === 'ディレクター'
                    ? { bg: 'rgba(239,68,68,0.2)', text: '#f87171', border: 'rgba(239,68,68,0.4)' }
                    : s.position.includes('準ディレ')
                    ? { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa', border: 'rgba(59,130,246,0.4)' }
                    : { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.15)' };
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 10,
                      background: c.bg, color: c.text,
                      border: `1px solid ${c.border}`,
                    }}>
                      {s.position}
                    </span>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      ))}
      {staff.length === 0 && (
        <div className="chart-card" style={{ textAlign: 'center', color: 'var(--text-sub)', padding: 24 }}>
          データがありません
        </div>
      )}
    </div>
  );
}
