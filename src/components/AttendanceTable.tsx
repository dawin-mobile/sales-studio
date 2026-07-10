'use client';

import { useState, useMemo, useEffect } from 'react';
import { DashboardData, Staff } from '@/types';
import IncentiveBar from './IncentiveBar';

interface AttendanceTableProps {
  data: DashboardData;
  selectedMonth: string; // 'YYYY-MM'
  loginName?: string;
  userRole?: string;
  onNoData?: () => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type CalendarKey = 'pt' | 'selfClose' | 'mnp' | 'new' | 'uq' | 'nw' | 'elec' | 'credit';

const rows: { label: string; key: CalendarKey; isTotal?: boolean }[] = [
  { label: '獲得pt', key: 'pt', isTotal: true },
  { label: '自己クロ', key: 'selfClose' },
  { label: 'MNP', key: 'mnp' },
  { label: '新規', key: 'new' },
  { label: 'UQ→au', key: 'uq' },
  { label: 'NW', key: 'nw' },
  { label: 'でんガス', key: 'elec' },
  { label: 'クレカ', key: 'credit' },
];

export default function AttendanceTable({ data, selectedMonth, loginName, userRole, onNoData }: AttendanceTableProps) {
  const allStaff = data.staffOrder?.length ? data.staffOrder : data.ranking;
  const initialName = (loginName && allStaff.find((s) => s.name === loginName))
    ? loginName
    : allStaff[0]?.name || '';
  const [staffName, setStaffName] = useState(initialName);
  const [manuallySelected, setManuallySelected] = useState(false);

  // loginName が後から届いた場合（セッション取得遅延）やデータ更新時に追従
  useEffect(() => {
    const list = data.staffOrder?.length ? data.staffOrder : data.ranking;
    if (loginName && list.find((s) => s.name === loginName)) {
      setStaffName(loginName);
    } else if (list.length > 0 && !list.find((s) => s.name === staffName)) {
      setStaffName(list[0].name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginName, data.ranking]);

  const staff = data.ranking.find((s) => s.name === staffName);

  // 自分のデータがない場合（手動選択でない場合のみ）親に通知して月を遡る
  useEffect(() => {
    if (!manuallySelected && (!staff || !staff.calendar)) {
      onNoData?.();
    }
  }, [staff, manuallySelected, onNoData]);

  // ログインユーザーの未提出日（日番号のSet）
  const [missingDays, setMissingDays] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (staffName !== loginName) { setMissingDays(new Set()); return; }
    fetch('/api/nippo-check')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data.missingDates)) return;
        const days = new Set<number>(data.missingDates.map((d: string) => parseInt(d.split('-')[2])));
        setMissingDays(days);
      })
      .catch(() => {});
  }, [staffName, loginName]);

  const yearMonth = useMemo(() => {
    const parts = selectedMonth.split('-');
    return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 };
  }, [selectedMonth]);

  const staffOrderEntry = data.staffOrder?.find((s) => s.name === staffName);
  const position = staff?.position ?? staffOrderEntry?.position;
  const positionColor = position === 'ディレクター'
    ? { bg: 'rgba(239,68,68,0.2)', text: '#f87171', border: 'rgba(239,68,68,0.4)' }
    : position?.includes('準ディレ')
    ? { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa', border: 'rgba(59,130,246,0.4)' }
    : { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.15)' };
  const positionBadge = position ? (
    <span style={{
      display: 'inline-block', fontSize: 12, fontWeight: 600,
      padding: '4px 10px', borderRadius: 20, marginTop: 5,
      background: positionColor.bg, color: positionColor.text,
      border: `1px solid ${positionColor.border}`,
      alignSelf: 'flex-start',
    }}>{position}</span>
  ) : null;

  if (!staff || !staff.calendar) {
    return (
      <>
        <div className="analysis-controls">
          <div className="control-group">
            {userRole !== 'アルバイト' && userRole !== '業務委託' && <span className="control-label">スタッフ選択</span>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {userRole === 'アルバイト' || userRole === '業務委託' ? (
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{staffName}</span>
              ) : (
                <select className="control-select" value={staffName} onChange={(e) => { setStaffName(e.target.value); setManuallySelected(true); }}>
                  {data.ranking.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
              {positionBadge}
            </div>
          </div>
        </div>
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 20, textAlign: 'center' }}>データがありません</div>
        </div>
      </>
    );
  }

  const days = data.daysInMonth;

  const totalPt = staff.total;
  const totalSelfClose = staff.calendar.reduce((sum, d) => Math.round((sum + (d.selfClose || 0)) * 100) / 100, 0);

  return (
    <>
      <div className="analysis-controls" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
        <div className="control-group">
          {userRole !== 'アルバイト' && userRole !== '業務委託' && <span className="control-label">スタッフ選択</span>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {userRole === 'アルバイト' || userRole === '業務委託' ? (
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{staffName}</span>
            ) : (
              <select className="control-select" value={staffName} onChange={(e) => { setStaffName(e.target.value); setManuallySelected(true); }}>
                {(data.staffOrder?.length ? data.staffOrder : data.ranking).map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}
            {positionBadge}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginLeft: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>獲得</span>
            <span style={{ fontSize: 35, fontWeight: 600, color: 'var(--text-main)', lineHeight: 1 }}>{totalPt}<span style={{ fontSize: 15, marginLeft: 2 }}>pt</span></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>自己クロ</span>
            <span style={{ fontSize: 35, fontWeight: 600, color: 'var(--text-main)', lineHeight: 1 }}>{totalSelfClose}<span style={{ fontSize: 15, marginLeft: 2 }}>pt</span></span>
          </div>
        </div>
      </div>
      {(userRole === 'アルバイト' || staffOrderEntry?.role === 'アルバイト') && (
        <IncentiveBar total={totalPt} selfClose={totalSelfClose} />
      )}
      <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="calendar-wrapper">
          <table className="cal-table">
            <thead>
              <tr>
                <th className="cal-label-col">日付</th>
                {Array.from({ length: days }, (_, i) => (
                  <th key={i} style={missingDays.has(i + 1) ? { background: 'rgba(180,30,30,0.35)' } : undefined}>{i + 1}</th>
                ))}
              </tr>
              <tr>
                <th className="cal-label-col">曜日</th>
                {Array.from({ length: days }, (_, i) => {
                  const dateObj = new Date(yearMonth.year, yearMonth.month, i + 1);
                  const dayOfWeek = WEEKDAYS[dateObj.getDay()];
                  const colorStyle = dayOfWeek === '土' ? '#3ea6ff' : dayOfWeek === '日' ? '#ff4e45' : undefined;
                  return (
                    <th key={i} style={{
                      ...(colorStyle ? { color: colorStyle } : {}),
                      ...(missingDays.has(i + 1) ? { background: 'rgba(180,30,30,0.35)' } : {}),
                    }}>
                      {dayOfWeek}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className={`cal-label-col ${row.isTotal ? 'row-total' : ''}`}>{row.label}</td>
                  {Array.from({ length: days }, (_, i) => {
                    const val = staff.calendar[i][row.key];
                    const displayVal = val === 0 || val === undefined ? '-' : val;
                    const cls = val === 0 || val === undefined ? 'cal-data-cell zero' : 'cal-data-cell';
                    return (
                      <td key={i} className={`${cls} ${row.isTotal ? 'row-total' : ''}`}
                        style={missingDays.has(i + 1) ? { background: 'rgba(180,30,30,0.25)' } : undefined}>
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="cal-label-col">現場</td>
                {Array.from({ length: days }, (_, i) => (
                  <td key={i} className="cal-data-cell cal-site-cell"
                    style={missingDays.has(i + 1) ? { background: 'rgba(180,30,30,0.25)' } : undefined}>
                    {staff.calendar[i].site || ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
