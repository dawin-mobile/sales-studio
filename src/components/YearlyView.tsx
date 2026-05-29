'use client';

import { useEffect, useState } from 'react';
import { DashboardData } from '@/types';
import type { MonthData } from '@/app/api/yearly/route';

interface YearlyViewProps {
  data: DashboardData;
  loginName?: string;
  userRole?: string;
}

export default function YearlyView({ data, loginName, userRole }: YearlyViewProps) {
  const allStaff = data.staffOrder?.length ? data.staffOrder : data.ranking;
  const initialName = (loginName && allStaff.find(s => s.name === loginName))
    ? loginName : allStaff[0]?.name ?? '';

  const [staffName, setStaffName] = useState(initialName);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffName) return;
    setLoading(true);
    fetch(`/api/yearly?staff=${encodeURIComponent(staffName)}`)
      .then(r => r.json())
      .then(d => setMonths(d.data ?? []))
      .finally(() => setLoading(false));
  }, [staffName]);

  const maxTotal = Math.max(...months.map(m => m.total), 1);
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <>
      <div className="analysis-controls" style={{ flexWrap: 'nowrap', alignItems: 'center', marginBottom: 0 }}>
        <div className="control-group">
          {userRole !== 'アルバイト' && userRole !== '業務委託' && (
            <span className="control-label">スタッフ選択</span>
          )}
          {userRole === 'アルバイト' || userRole === '業務委託' ? (
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{staffName}</span>
          ) : (
            <select className="control-select" value={staffName} onChange={e => setStaffName(e.target.value)}>
              {allStaff.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="chart-card" style={{ minHeight: 'auto', padding: '16px 8px 12px' }}>
        {loading ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="shift-loading-spinner" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* バーエリア */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
              {months.map(m => {
                const barH = m.total > 0 ? Math.max(Math.round((m.total / maxTotal) * 100), 4) : 0;
                const isCurrent = m.month === currentMonth;
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    {m.total > 0 && (
                      <span style={{ fontSize: 7, color: isCurrent ? '#00cfff' : 'var(--text-sub)', marginBottom: 2, lineHeight: 1 }}>
                        {m.total % 1 === 0 ? m.total : m.total.toFixed(1)}
                      </span>
                    )}
                    <div style={{
                      width: '100%',
                      height: `${barH}%`,
                      background: isCurrent
                        ? 'linear-gradient(180deg, #00cfff, #0077aa)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.15))',
                      borderRadius: '3px 3px 0 0',
                      boxShadow: isCurrent ? '0 0 6px #00cfff55' : 'none',
                    }} />
                  </div>
                );
              })}
            </div>

            {/* 月ラベル */}
            <div style={{ display: 'flex', gap: 3 }}>
              {months.map(m => {
                const isCurrent = m.month === currentMonth;
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: 8, color: isCurrent ? '#00cfff' : 'var(--text-sub)', fontWeight: isCurrent ? 700 : 400, lineHeight: 1 }}>
                      {m.label}
                    </span>
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.28)', lineHeight: 1 }}>
                      {m.workDays > 0 ? `${m.workDays}日` : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
