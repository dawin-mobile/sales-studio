'use client';

import { useEffect, useState } from 'react';
import { DashboardData } from '@/types';
import type { MonthData } from '@/app/api/yearly/route';

interface YearlyViewProps {
  data: DashboardData;
  loginName?: string;
  userRole?: string;
}

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function BarChart({ months, accentColor, label }: { months: MonthData[]; accentColor: string; label: string }) {
  const maxTotal = Math.max(...months.map(m => m.total), 1);
  return (
    <div className="chart-card" style={{ minHeight: 'auto', padding: '14px 8px 10px', marginTop: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--text-main)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110 }}>
          {months.map(m => {
            const barH = m.total > 0 ? Math.max(Math.round((m.total / maxTotal) * 100), 4) : 0;
            const isCurrent = m.month === CURRENT_MONTH;
            return (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                {m.total > 0 && (
                  <span style={{ fontSize: 7, color: isCurrent ? accentColor : 'var(--text-sub)', marginBottom: 2, lineHeight: 1 }}>
                    {m.total % 1 === 0 ? m.total : m.total.toFixed(1)}
                  </span>
                )}
                <div style={{
                  width: '100%',
                  height: `${barH}%`,
                  background: isCurrent
                    ? `linear-gradient(180deg, ${accentColor}, ${accentColor}88)`
                    : 'linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.12))',
                  borderRadius: '3px 3px 0 0',
                  boxShadow: isCurrent ? `0 0 6px ${accentColor}55` : 'none',
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {months.map(m => {
            const isCurrent = m.month === CURRENT_MONTH;
            return (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: 8, color: isCurrent ? accentColor : 'var(--text-sub)', fontWeight: isCurrent ? 700 : 400, lineHeight: 1 }}>
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
    </div>
  );
}

export default function YearlyView({ data, loginName, userRole }: YearlyViewProps) {
  const allStaff = data.staffOrder?.length ? data.staffOrder : data.ranking;
  const initialName = (loginName && allStaff.find(s => s.name === loginName))
    ? loginName : allStaff[0]?.name ?? '';

  const [staffName, setStaffName] = useState(initialName);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [avgMonths, setAvgMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffName) return;
    setLoading(true);
    fetch(`/api/yearly?staff=${encodeURIComponent(staffName)}`)
      .then(r => r.json())
      .then(d => { setMonths(d.data ?? []); setAvgMonths(d.avgData ?? []); })
      .finally(() => setLoading(false));
  }, [staffName]);

  const isLimitedRole = userRole === 'アルバイト' || userRole === '業務委託';

  return (
    <>
      {!isLimitedRole && (
        <div className="analysis-controls" style={{ flexWrap: 'nowrap', alignItems: 'center', marginBottom: 0 }}>
          <div className="control-group">
            <span className="control-label">スタッフ選択</span>
            <select className="control-select" value={staffName} onChange={e => setStaffName(e.target.value)}>
              {allStaff.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="chart-card" style={{ minHeight: 'auto', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
          <div className="shift-loading-spinner" />
        </div>
      ) : (
        <>
          <BarChart months={months} accentColor="#00cfff" label={`${staffName} の獲得推移`} />
          <BarChart months={avgMonths} accentColor="#facc15" label="全体平均" />
        </>
      )}
    </>
  );
}
