'use client';

import { useState, useMemo, useEffect } from 'react';
import type { ShiftRow } from '@/types';
import ShiftAnalysis from '@/components/ShiftAnalysis';

interface ShiftViewProps {
  rows: ShiftRow[];
  tokyoStaffNames: string[];
  fukuokaStaffNames: string[];
  loading: boolean;
  error: string | null;
  selectedMonth: string; // 'YYYY-MM'
  userRole?: string;
}

// 代理店ごとに割り当てるカラーパレット（色相環を均等12分割・最大限視覚的に識別可能）
const PILL_COLORS = [
  { bg: 'rgba(248,113,113,0.20)', text: '#f87171', dot: '#ef4444' },  // 赤        0°
  { bg: 'rgba(251,146,60,0.20)',  text: '#fb923c', dot: '#f97316' },  // オレンジ  30°
  { bg: 'rgba(250,204,21,0.20)',  text: '#facc15', dot: '#eab308' },  // 黄        60°
  { bg: 'rgba(163,230,53,0.20)',  text: '#a3e635', dot: '#84cc16' },  // ライム    90°
  { bg: 'rgba(74,222,128,0.20)',  text: '#4ade80', dot: '#22c55e' },  // 緑       120°
  { bg: 'rgba(45,212,191,0.20)',  text: '#2dd4bf', dot: '#14b8a6' },  // ティール 180°
  { bg: 'rgba(34,211,238,0.20)',  text: '#22d3ee', dot: '#06b6d4' },  // シアン   210°
  { bg: 'rgba(56,189,248,0.20)',  text: '#38bdf8', dot: '#0ea5e9' },  // スカイ   240°
  { bg: 'rgba(129,140,248,0.20)', text: '#818cf8', dot: '#6366f1' },  // インディゴ270°
  { bg: 'rgba(192,132,252,0.20)', text: '#c084fc', dot: '#a855f7' },  // 紫       300°
  { bg: 'rgba(232,121,249,0.20)', text: '#e879f9', dot: '#d946ef' },  // フクシア 315°
  { bg: 'rgba(244,114,182,0.20)', text: '#f472b6', dot: '#ec4899' },  // ピンク   330°
];

// 社員シフトの勤務区分スタイル
const EMP_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  '現場':  { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
  '事務所': { bg: 'rgba(59,130,246,0.18)',  color: '#60a5fa' },
  '有給':  { bg: 'rgba(168,85,247,0.18)',  color: '#c084fc' },
  '在宅':  { bg: 'rgba(100,116,139,0.06)', color: '#64748b' },
  'OFF':   { bg: 'rgba(34,197,94,0.18)',   color: '#4ade80' },
  '希OFF': { bg: 'rgba(20,184,166,0.18)',  color: '#2dd4bf' },
};

// 代理店名を固定インデックスにマップ（月・地域をまたいでも色が変わらない）
function agencyColorIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
  return h % PILL_COLORS.length;
}

// × 系の文字（✖ U+2716、× U+00D7 など）で始まる名前かどうか
function startsWithX(name: string): boolean {
  return /^[×✖✗✘]/.test(name);
}

// 現場名の「親現場名（Base Site Name）」を返す
function getBaseSiteName(location: string): string {
  const spaceIdx = location.search(/[ 　]/);
  return spaceIdx === -1 ? location : location.slice(0, spaceIdx);
}

type ViewMode = 'staff' | 'location' | 'employee';

interface EmpShiftData {
  staff: string[];
  dates: { date: string; dayOfWeek: string }[];
  cells: Record<string, Record<string, string>>;
}

export default function ShiftView({
  rows,
  tokyoStaffNames,
  fukuokaStaffNames,
  loading,
  error,
  selectedMonth,
  userRole,
}: ShiftViewProps) {
  const [regionFilter, setRegionFilter] = useState<'東京' | '福岡'>('東京');
  const [viewMode, setViewMode] = useState<ViewMode>('location');
  const [pageMode, setPageMode] = useState<'shift' | 'analysis'>('shift');
  const [showAgency, setShowAgency] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // 社員シフトデータ
  const [empData, setEmpData] = useState<EmpShiftData | null>(null);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);
  const [empFetchedMonth, setEmpFetchedMonth] = useState<string | null>(null);

  const staffNames = regionFilter === '東京' ? tokyoStaffNames : fukuokaStaffNames;

  const filtered = useMemo(
    () => rows.filter((r) => r.sheetRegion === regionFilter),
    [rows, regionFilter]
  );

  const selectedMonthNum = selectedMonth.split('-')[1];

  // 「2026年2月」形式の月ラベル
  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-');
    return `${y}年${parseInt(m)}月`;
  })();

  // ─── スタッフ別ビュー用 ────────────────────────────────────────────

  const dates = useMemo(
    () => [...new Set(filtered.map((r) => r.date))].sort((a, b) => {
      const [am, ad] = a.split('/').map(Number);
      const [bm, bd] = b.split('/').map(Number);
      return am !== bm ? am - bm : ad - bd;
    }),
    [filtered]
  );

  const dayOfWeekMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const row of filtered) m[row.date] = row.dayOfWeek;
    return m;
  }, [filtered]);

  const shiftMap = useMemo(() => {
    const m: Record<string, Record<string, string[]>> = {};
    for (const row of filtered) {
      for (const staffName of row.staff) {
        if (!m[staffName]) m[staffName] = {};
        if (!m[staffName][row.date]) m[staffName][row.date] = [];
        m[staffName][row.date].push(row.location);
      }
    }
    return m;
  }, [filtered]);

  const agencyShiftMap = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    for (const row of filtered) {
      for (const staffName of row.staff) {
        if (!m[staffName]) m[staffName] = {};
        if (!m[staffName][row.date]) m[staffName][row.date] = row.agency;
      }
    }
    return m;
  }, [filtered]);

  const agencyColors = useMemo(() => {
    const agencies = [...new Set(filtered.map((r) => r.agency))]
      .filter((ag) => ag && ag.trim() !== '' && !startsWithX(ag));

    const sorted = agencies
      .map((ag) => ({ ag, pref: agencyColorIndex(ag) }))
      .sort((a, b) => a.pref - b.pref || a.ag.localeCompare(b.ag));

    const used = new Set<number>();
    const map = new Map<string, typeof PILL_COLORS[0]>();
    for (const { ag, pref } of sorted) {
      let idx = pref;
      for (let i = 0; i < PILL_COLORS.length; i++) {
        if (!used.has(idx)) break;
        idx = (idx + 1) % PILL_COLORS.length;
      }
      used.add(idx);
      map.set(ag, PILL_COLORS[idx]);
    }
    return map;
  }, [filtered]);

  const visibleStaffNames = useMemo(
    () => staffNames.filter(
      (name) => name && name.trim() !== '' && !startsWithX(name) && shiftMap[name]
    ),
    [staffNames, shiftMap]
  );

  // ─── 現場別ビュー用 ────────────────────────────────────────────────

  const staffNameSet = useMemo(() => new Set(staffNames), [staffNames]);

  // staffNameSetになくてもスタッフとして扱うキーワード
  const isAlwaysStaff = (name: string) =>
    name.includes('アスクラ') || name.includes('salud') || name.includes('HE');

  const ADMIN_ROW_KEYWORDS = ['管理費', '備品'];

  const locationRows = useMemo(() => {
    return filtered
      .filter((r) => {
        if (!r.location || !r.location.trim()) return false;
        if (ADMIN_ROW_KEYWORDS.includes(r.startTime)) return false;
        if (startsWithX(r.agency)) return false;
        return r.staff.some(
          (s) => s && s.trim() !== '' && !startsWithX(s) && (staffNameSet.size === 0 || staffNameSet.has(s) || isAlwaysStaff(s))
        );
      })
      .sort((a, b) => {
        const [am, ad] = a.date.split('/').map(Number);
        const [bm, bd] = b.date.split('/').map(Number);
        return am !== bm ? am - bm : ad - bd;
      });
  }, [filtered, staffNameSet]);

  useEffect(() => {
    setSelectedAgency(null);
    setSelectedLocation(null);
    setShowAgency(false);
    setShowLocation(false);
  }, [regionFilter]);

  const locationAgencySet = useMemo(
    () => new Set(locationRows.map((r) => r.agency).filter((ag) => ag && ag.trim() !== '' && !startsWithX(ag))),
    [locationRows]
  );

  const locationNames = useMemo(
    () => [...new Set(locationRows.map((r) => getBaseSiteName(r.location)))].sort((a, b) => a.localeCompare(b, 'ja')),
    [locationRows]
  );

  const filteredLocationRows = useMemo(() => {
    if (selectedAgency) return locationRows.filter((r) => r.agency === selectedAgency);
    if (selectedLocation) return locationRows.filter((r) => getBaseSiteName(r.location) === selectedLocation);
    return locationRows;
  }, [locationRows, selectedAgency, selectedLocation]);

  const holidaySet = useMemo(() => {
    const s = new Set<string>();
    for (const row of filtered) {
      if (row.isHoliday) s.add(row.date);
    }
    return s;
  }, [filtered]);

  // ─── 共通 ──────────────────────────────────────────────────────────

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getMonth() + 1}/${t.getDate()}`;
  }, []);

  // シフト表が表示されたとき・データ読み込み完了時に今日の列/行までスクロール
  useEffect(() => {
    if (!rows.length || pageMode !== 'shift') return;
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('.shift-table .today');
      if (!el) return;
      el.scrollIntoView({ block: 'start', inline: 'nearest' });
    }, 50);
    return () => clearTimeout(timer);
  }, [rows, viewMode, pageMode]);

  // ─── 社員シフトデータ取得 ──────────────────────────────────────────

  useEffect(() => {
    if (viewMode !== 'employee') return;
    if (empFetchedMonth === selectedMonth) return;
    setEmpLoading(true);
    setEmpError(null);
    fetch(`/api/employee-shift?month=${selectedMonth}`)
      .then((r) => r.json())
      .then((data: EmpShiftData & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setEmpData(data);
      })
      .catch((e: Error) => setEmpError(e.message))
      .finally(() => {
        setEmpFetchedMonth(selectedMonth);
        setEmpLoading(false);
      });
  }, [viewMode, selectedMonth, empFetchedMonth]);

  // ─── Loading / Error / Empty ───────────────────────────────────────

  if (loading) {
    return (
      <div className="shift-loading">
        <div className="shift-loading-spinner" />
        <div>シフトデータを読み込んでいます...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shift-loading" style={{ color: '#f87171' }}>
        {error}
      </div>
    );
  }


  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="shift-container">

      <div className="shift-sticky-header">

      {/* Controls */}
      <div className="shift-controls">
        <div className="shift-controls-left">
          {/* ページモードトグル（社員モード以外・管理者/社員のみ分析タブ表示） */}
          {viewMode !== 'employee' && (userRole === '管理者' || userRole === '社員') && (
            <div className="shift-region-toggle">
              <button
                className={`shift-region-btn${pageMode === 'shift' ? ' active' : ''}`}
                onClick={() => setPageMode('shift')}
              >
                シフト表
              </button>
              <button
                className={`shift-region-btn${pageMode === 'analysis' ? ' active' : ''}`}
                onClick={() => setPageMode('analysis')}
              >
                分析
              </button>
            </div>
          )}

          {/* 表示モードトグル（シフト表のみ） */}
          {(viewMode === 'employee' || pageMode === 'shift') && (
            <div className="shift-region-toggle">
              <button
                className={`shift-region-btn${viewMode === 'location' ? ' active' : ''}`}
                onClick={() => setViewMode('location')}
              >
                現場別
              </button>
              <button
                className={`shift-region-btn${viewMode === 'staff' ? ' active' : ''}`}
                onClick={() => setViewMode('staff')}
              >
                スタッフ別
              </button>
              {userRole !== 'アルバイト' && userRole !== '業務委託' && (
                <button
                  className={`shift-region-btn${viewMode === 'employee' ? ' active' : ''}`}
                  onClick={() => { setViewMode('employee'); setPageMode('shift'); }}
                >
                  社員
                </button>
              )}
            </div>
          )}

          {/* 地域トグル（社員モード以外） */}
          {viewMode !== 'employee' && (
            <div className="shift-region-toggle">
              {(['東京', '福岡'] as const).map((region) => (
                <button
                  key={region}
                  className={`shift-region-btn${regionFilter === region ? ' active' : ''}`}
                  onClick={() => setRegionFilter(region)}
                >
                  {region}
                </button>
              ))}
            </div>
          )}

          {/* 代理店凡例トグル（現場別ビューのみ・現場データがある代理店のみ） */}
          {pageMode === 'shift' && viewMode === 'location' && locationAgencySet.size > 0 && (
            <button
              className={`shift-agency-btn${showAgency ? ' active' : ''}${selectedAgency ? ' filtered' : ''}`}
              onClick={() => { setShowAgency(v => !v); setShowLocation(false); }}
              aria-expanded={showAgency}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 2.5h10M3 6h6M5 9.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              代理店
              {selectedAgency && <span className="shift-agency-filter-dot" />}
              <svg
                width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                className={`shift-agency-chevron${showAgency ? ' open' : ''}`}
              >
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* 現場フィルタートグル（現場別ビューのみ） */}
          {pageMode === 'shift' && viewMode === 'location' && locationNames.length > 0 && (
            <button
              className={`shift-agency-btn${showLocation ? ' active' : ''}${selectedLocation ? ' filtered' : ''}`}
              onClick={() => { setShowLocation(v => !v); setShowAgency(false); }}
              aria-expanded={showLocation}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 11V5l4-3 4 3v6M5 11V8h2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              現場
              {selectedLocation && <span className="shift-agency-filter-dot" />}
              <svg
                width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                className={`shift-agency-chevron${showLocation ? ' open' : ''}`}
              >
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* メタ情報 */}
        <div className="shift-meta">
          {viewMode === 'employee' ? (
            empData ? <span>{empData.staff.length} 名</span> : null
          ) : pageMode === 'analysis' ? (
            <span>{visibleStaffNames.length} 名</span>
          ) : viewMode === 'staff' ? (
            <>
              <span>{visibleStaffNames.length} 名</span>
              <span style={{ color: 'var(--border-color)' }}>·</span>
              <span>{dates.length} 日</span>
            </>
          ) : (
            (selectedAgency || selectedLocation)
              ? <span>{filteredLocationRows.length} / {locationRows.length} 件</span>
              : null
          )}
        </div>
      </div>

      {/* 代理店凡例（シフト表のみ・トグルで開閉） */}
      {pageMode === 'shift' && agencyColors.size > 0 && (
        <div className={`shift-legend-wrapper${showAgency ? ' open' : ''}`}>
          <div className="shift-legend">
            {[...agencyColors.entries()].filter(([agency]) => locationAgencySet.has(agency)).map(([agency, color]) => {
              const isSelected = selectedAgency === agency;
              const isDimmed = selectedAgency !== null && !isSelected;
              return (
                <div
                  key={agency}
                  className={`shift-legend-item${isSelected ? ' selected' : ''}${isDimmed ? ' dimmed' : ''}`}
                  onClick={() => {
                    setSelectedAgency(prev => prev === agency ? null : agency);
                    setSelectedLocation(null);
                  }}
                  role="button"
                  aria-pressed={isSelected}
                >
                  <span className="shift-legend-dot" style={{ background: color.dot }} />
                  <span style={{ color: isSelected ? color.text : undefined }}>{agency}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 現場フィルターパネル（現場別ビューのみ・トグルで開閉） */}
      {pageMode === 'shift' && viewMode === 'location' && locationNames.length > 0 && (
        <div className={`shift-legend-wrapper loc-filter-wrapper${showLocation ? ' open' : ''}`}>
          <div className="shift-legend">
            {locationNames.map((loc) => {
              const isSelected = selectedLocation === loc;
              const isDimmed = selectedLocation !== null && !isSelected;
              return (
                <div
                  key={loc}
                  className={`shift-legend-item${isSelected ? ' selected' : ''}${isDimmed ? ' dimmed' : ''}`}
                  onClick={() => {
                    setSelectedLocation(prev => prev === loc ? null : loc);
                    setSelectedAgency(null);
                  }}
                  role="button"
                  aria-pressed={isSelected}
                >
                  <span>{loc}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>{/* /shift-sticky-header */}

      {/* ── スタッフ別テーブル ── */}
      {pageMode === 'shift' && viewMode === 'staff' && rows.length === 0 && (
        <div className="shift-loading" style={{ color: 'var(--text-sub)' }}>
          この月のシフトデータはありません
        </div>
      )}
      {pageMode === 'shift' && viewMode === 'staff' && rows.length > 0 && (
        <div className="shift-table-card">
          <div className="shift-scroll-y">
          <div className="shift-scroll">
            <table className="shift-table">
              <thead>
                <tr>
                  <th className="shift-sticky-col shift-col-label">
                    <div className="shift-label-month">{monthLabel}</div>
                  </th>
                  {visibleStaffNames.map((staffName) => (
                    <th key={staffName} className="shift-col-date">
                      <div className="shift-date-num" style={{ fontSize: 11 }}>{staffName}</div>
                    </th>
                  ))}
                  <th className="shift-col-total">計</th>
                </tr>
              </thead>

              <tbody>
                {dates.map((date) => {
                  const [mm, dd] = date.split('/');
                  const label =
                    parseInt(mm) === parseInt(selectedMonthNum)
                      ? parseInt(dd)
                      : `${parseInt(mm)}/${parseInt(dd)}`;
                  const day = dayOfWeekMap[date] ?? '';
                  const isToday = date === todayStr;
                  const isHoliday = holidaySet.has(date);
                  const isSat = day === '土' && !isHoliday;
                  const isSun = day === '日' || day === '祝' || isHoliday;
                  const totalStaff = visibleStaffNames.filter(
                    (s) => (shiftMap[s]?.[date] ?? []).length > 0
                  ).length;

                  return (
                    <tr key={date} className={[
                      'shift-row',
                      isToday ? 'today' : '',
                      isSat ? 'weekend-sat' : '',
                      isSun ? 'weekend-sun' : '',
                    ].filter(Boolean).join(' ')}>
                      <td className="shift-sticky-col shift-staff-name">
                        <span className="shift-date-num">{label}</span>
                        <span className={`shift-date-dow${isSat ? ' sat' : isSun ? ' sun' : ''}`} style={{ marginLeft: 4 }}>{day}</span>
                      </td>

                      {visibleStaffNames.map((staffName) => {
                        const locations = shiftMap[staffName]?.[date] ?? [];
                        const agency = agencyShiftMap[staffName]?.[date];
                        const color = agency ? agencyColors.get(agency) : null;

                        return (
                          <td
                            key={staffName}
                            className="shift-data-cell"
                            title={locations.join('\n')}
                          >
                            {color && locations.length > 0 && (
                              <div
                                className="shift-pill"
                                style={{ background: color.bg, color: color.text }}
                              >
                                {locations[0].slice(0, 4)}
                                {locations.length > 1 && (
                                  <span className="shift-pill-extra">
                                    +{locations.length - 1}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="shift-total-cell">
                        {totalStaff > 0 ? totalStaff : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* ── 現場別テーブル ── */}
      {pageMode === 'shift' && viewMode === 'location' && rows.length === 0 && (
        <div className="shift-loading" style={{ color: 'var(--text-sub)' }}>
          この月のシフトデータはありません
        </div>
      )}
      {pageMode === 'shift' && viewMode === 'location' && rows.length > 0 && (
        <div className="shift-table-card">
          <div className="shift-scroll-y">
          <div className="shift-scroll">
            <table className="shift-table location-table">
              <thead>
                <tr>
                  <th className="shift-sticky-col loc-th loc-th-date">日付</th>
                  <th className="loc-th loc-th-dow">曜日</th>
                  <th className="loc-th loc-th-place">店舗名</th>
                  <th className="loc-th loc-th-time">時間</th>
                  <th className="loc-th loc-th-staff">スタッフ</th>
                  <th className="loc-th loc-th-order">クロ</th>
                  <th className="loc-th loc-th-order">キャ</th>
                  <th className="loc-th loc-th-final">終担</th>
                  <th className="loc-th loc-th-agency">代理店</th>
                </tr>
              </thead>

              <tbody>
                {filteredLocationRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-sub)', fontSize: 13 }}>
                      {selectedAgency
                        ? `「${selectedAgency}」の現場データがありません`
                        : '表示できる現場データがありません'}
                    </td>
                  </tr>
                ) : (
                  filteredLocationRows.map((row, i) => {
                    const isDateBoundary = i > 0 && filteredLocationRows[i - 1].date !== row.date;
                    const [mm, dd] = row.date.split('/');
                    const dateLabel =
                      parseInt(mm) === parseInt(selectedMonthNum)
                        ? parseInt(dd)
                        : `${parseInt(mm)}/${parseInt(dd)}`;
                    const isToday = row.date === todayStr;
                    const isSat = row.dayOfWeek === '土' && !row.isHoliday;
                    const isSun = row.dayOfWeek === '日' || row.dayOfWeek === '祝' || row.isHoliday;
                    const agencyColor = agencyColors.get(row.agency) ?? null;
                    const visibleStaff = row.staff.filter(
                      (s) => s && s.trim() !== '' && !startsWithX(s)
                    );

                    return (
                      <tr key={`${row.date}-${row.location}-${i}`} className={`shift-row${isDateBoundary ? ' date-boundary' : ''}`}>
                        <td
                          className={[
                            'shift-sticky-col',
                            'loc-date-cell',
                            isToday ? 'today' : '',
                            isSat ? 'weekend-sat' : '',
                            isSun ? 'weekend-sun' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className="loc-date-num">{dateLabel}</span>
                        </td>

                        <td className={['loc-dow-cell', isSat ? 'sat' : isSun ? 'sun' : ''].filter(Boolean).join(' ')}>
                          {row.dayOfWeek}
                        </td>

                        <td className="loc-place-cell">{row.location}</td>

                        <td className="loc-time-cell">{row.startTime}</td>

                        <td className="loc-staff-cell">
                          <div className="loc-staff-list">
                            {visibleStaff.length > 0 ? (
                              visibleStaff.map((name) => (
                                <span key={name} className="loc-staff-chip">{name}</span>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-sub)', fontSize: 12 }}>—</span>
                            )}
                          </div>
                        </td>

                        <td className="loc-order-cell">{row.order1 === 'O' || row.order1 === 'o' ? '0' : row.order1}</td>
                        <td className="loc-order-cell">{row.order2 === 'O' || row.order2 === 'o' ? '0' : row.order2}</td>

                        <td className="loc-staff-cell">
                          <div className="loc-staff-list">
                            {row.finalStaff ? (
                              <span className="loc-staff-chip">{row.finalStaff}</span>
                            ) : ''}
                          </div>
                        </td>

                        <td className="loc-agency-cell">
                          {agencyColor ? (
                            <span
                              className="loc-agency-badge"
                              style={{ background: agencyColor.bg, color: agencyColor.text }}
                            >
                              {row.agency}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-sub)', fontSize: 12 }}>
                              {row.agency}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* ── 社員テーブル ── */}
      {viewMode === 'employee' && (
        <div className="shift-table-card">
          {empLoading ? (
            <div className="shift-loading">
              <div className="shift-loading-spinner" />
              <div>社員シフトを読み込んでいます...</div>
            </div>
          ) : empError ? (
            <div className="shift-loading" style={{ color: '#f87171' }}>{empError}</div>
          ) : !empData || empData.staff.length === 0 ? (
            empFetchedMonth === selectedMonth ? (
              <div className="shift-loading" style={{ color: 'var(--text-sub)' }}>
                この月の社員シフトデータはありません
              </div>
            ) : null
          ) : (
            <div className="shift-scroll-y">
            <div className="shift-scroll">
              <table className="shift-table">
                <thead>
                  <tr>
                    <th className="shift-sticky-col shift-col-label" style={{ minWidth: 64 }}>
                      <div className="shift-label-month">{monthLabel}</div>
                    </th>
                    {empData.staff.map((name) => (
                      <th key={name} className="shift-col-date" style={{ minWidth: 52, fontSize: 11 }}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empData.dates.map(({ date, dayOfWeek }) => {
                    const [, dd] = date.split('/');
                    const isToday = date.replace(/^0(\d)\//, '$1/').replace(/\/0(\d)$/, '/$1') === todayStr;
                    const isSat = dayOfWeek === '土';
                    const isSun = dayOfWeek === '日';
                    return (
                      <tr key={date} className="shift-row">
                        <td
                          className={[
                            'shift-sticky-col',
                            'loc-date-cell',
                            isToday ? 'today' : '',
                            isSat ? 'weekend-sat' : '',
                            isSun ? 'weekend-sun' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <span className="loc-date-num">{parseInt(dd)}</span>
                          {dayOfWeek && (
                            <span
                              className={`shift-date-dow${isSat ? ' sat' : isSun ? ' sun' : ''}`}
                              style={{ marginLeft: 4, fontSize: 10 }}
                            >
                              {dayOfWeek}
                            </span>
                          )}
                        </td>
                        {empData.staff.map((name) => {
                          const val = empData.cells[date]?.[name] ?? '';
                          const style = EMP_STATUS_STYLE[val];
                          return (
                            <td
                              key={name}
                              className={[
                                'shift-data-cell',
                                isToday ? 'today' : '',
                                isSat ? 'weekend-sat' : '',
                                isSun ? 'weekend-sun' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              {val && (
                                <div
                                  className="shift-pill"
                                  style={style
                                    ? { background: style.bg, color: style.color }
                                    : { background: 'rgba(255,255,255,0.06)', color: 'var(--text-sub)' }
                                  }
                                >
                                  {val}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
      )}

      {/* ── 分析 ── */}
      {pageMode === 'analysis' && viewMode !== 'employee' && (
        <ShiftAnalysis
          filtered={filtered}
          visibleStaffNames={visibleStaffNames}
          staffNameSet={staffNameSet}
        />
      )}

    </div>
  );
}
