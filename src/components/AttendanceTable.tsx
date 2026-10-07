'use client';

import { useState, useMemo, useEffect } from 'react';
import { DashboardData, Staff } from '@/types';
import IncentiveBar from './IncentiveBar';
import { modoriToCalendarRow, sameStaff, ModoriEntry } from '@/lib/modori';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface AttendanceTableProps {
  data: DashboardData;
  selectedMonth: string; // 'YYYY-MM'
  loginName?: string;
  userRole?: string;
  onNoData?: () => void;
  onStaffChange?: (name: string) => void; // 育成アプリのリンク先を選択中スタッフに合わせるため親へ通知
  initialStaff?: string;                  // タブを切り替えても選択が外れないよう、親が覚えている選択を受け取る
  onStaffPick?: (name: string) => void;   // 人が自分でプルダウンを操作したときだけ親へ通知
}

// 獲得・自己クロの数字は、桁が増えたぶんだけ字を小さくする。
// 整数部の桁数（3桁になったら縮める）と、小数を含めた全体の文字数の
// 両方を見る。「123.4」は5文字でも3桁なので縮める。
function figureSizeClass(value: number): string {
  const text = String(value);
  const intDigits = text.split('.')[0].replace('-', '').length;
  if (intDigits >= 4 || text.length >= 8) return 'stat-figure-value--xs';
  if (intDigits >= 3 || text.length >= 6) return 'stat-figure-value--sm';
  return '';
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

export default function AttendanceTable({ data, selectedMonth, loginName, userRole, onNoData, onStaffChange, initialStaff, onStaffPick }: AttendanceTableProps) {
  const allStaff = data.staffOrder?.length ? data.staffOrder : data.ranking;
  // 親が覚えている選択（＝人が自分で選んだ相手）があればそれを優先する
  const picked = initialStaff && allStaff.find((s) => s.name === initialStaff) ? initialStaff : '';
  const initialName = picked
    || ((loginName && allStaff.find((s) => s.name === loginName)) ? loginName : allStaff[0]?.name || '');
  const [staffName, setStaffName] = useState(initialName);
  const [manuallySelected, setManuallySelected] = useState(!!picked);

  const handlePick = (name: string) => {
    setStaffName(name);
    setManuallySelected(true);
    onStaffPick?.(name);
  };

  // loginName が後から届いた場合（セッション取得遅延）やデータ更新時に追従
  useEffect(() => {
    // 人が自分で選んでいるときは、あとからログイン名が届いても上書きしない
    if (!manuallySelected && loginName && allStaff.find((s) => s.name === loginName)) {
      setStaffName(loginName);
    } else if (allStaff.length > 0 && !allStaff.find((s) => s.name === staffName)) {
      setStaffName(allStaff[0].name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginName, data.ranking]);

  // 選択中スタッフを親に伝える（育成アプリのリンク先に使う）
  useEffect(() => {
    onStaffChange?.(staffName);
  }, [staffName, onStaffChange]);

  const staff = data.ranking.find((s) => s.name === staffName);

  // 自分のデータがない場合（手動選択でない場合のみ）親に通知して月を遡る
  useEffect(() => {
    if (!manuallySelected && (!staff || !staff.calendar)) {
      onNoData?.();
    }
  }, [staff, manuallySelected, onNoData]);

  // ログインユーザーの未提出日（日番号のSet）
  // 日報の未提出日。自分の分だけでなく、選択中のスタッフ・選択中の月でも取る
  // （出勤日数＝提出した日数＋未提出の日数 を出すため）。他人の分は社員以上のみAPIが返す
  const [missingDays, setMissingDays] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!staffName) { setMissingDays(new Set()); return; }
    let canceled = false;
    const params = new URLSearchParams({ staff: staffName, month: selectedMonth });
    fetch(`/api/nippo-check?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (canceled) return;
        if (!Array.isArray(data.missingDates)) { setMissingDays(new Set()); return; }
        setMissingDays(new Set<number>(data.missingDates.map((d: string) => parseInt(d.split('-')[2]))));
      })
      .catch(() => { if (!canceled) setMissingDays(new Set()); });
    return () => { canceled = true; };
  }, [staffName, selectedMonth]);

  // 戻り報告（別日に戻ってきた分）を取得する。月が変わったら取り直す
  const [modoriEntries, setModoriEntries] = useState<ModoriEntry[]>([]);
  useEffect(() => {
    let canceled = false;
    fetch(`/api/modori?month=${selectedMonth}`)
      .then((r) => r.json())
      .then((json) => { if (!canceled && Array.isArray(json.entries)) setModoriEntries(json.entries); })
      .catch(() => { if (!canceled) setModoriEntries([]); });
    return () => { canceled = true; };
  }, [selectedMonth]);

  // 選択中のスタッフの戻り分を、日ごとにまとめる
  const modoriByDay = useMemo(() => {
    const map = new Map<number, { pt: number; selfClose: number; mnp: number; new: number; uq: number; nw: number; elec: number; credit: number }>();
    for (const e of modoriEntries) {
      if (!sameStaff(e.staff, staffName)) continue;
      const row = modoriToCalendarRow(e.items);
      const cur = map.get(e.day) ?? { pt: 0, selfClose: 0, mnp: 0, new: 0, uq: 0, nw: 0, elec: 0, credit: 0 };
      map.set(e.day, {
        pt:        round2(cur.pt + e.pt),
        selfClose: round2(cur.selfClose + e.selfClose),
        mnp:       round2(cur.mnp + row.mnp),
        new:       round2(cur.new + row.new),
        uq:        round2(cur.uq + row.uq),
        nw:        round2(cur.nw + row.nw),
        elec:      round2(cur.elec + row.elec),
        credit:    round2(cur.credit + row.credit),
      });
    }
    return map;
  }, [modoriEntries, staffName]);

  const modoriTotalPt = useMemo(
    () => round2([...modoriByDay.values()].reduce((sum, v) => sum + v.pt, 0)),
    [modoriByDay]
  );
  const modoriTotalSelfClose = useMemo(
    () => round2([...modoriByDay.values()].reduce((sum, v) => sum + v.selfClose, 0)),
    [modoriByDay]
  );

  const hasModori = modoriTotalPt > 0 || modoriTotalSelfClose > 0;

  // 出勤日数 = 日報を出した日数 ＋ 日報が未提出の日数（シフトに入っていたのに出していない日）
  const reportDays = staff?.reportDays ?? 0;
  const attendanceDays = reportDays + missingDays.size;

  const yearMonth = useMemo(() => {
    const parts = selectedMonth.split('-');
    return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 };
  }, [selectedMonth]);

  const staffOrderEntry = data.staffOrder?.find((s) => s.name === staffName);
  // アルバイトにはクラス（インセン）カードを出す。出勤日数はその中に入れる
  const showIncentive = userRole === 'アルバイト' || staffOrderEntry?.role === 'アルバイト';
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

  // データがない月・出勤していないスタッフのとき。
  // プルダウンの選択肢は data.ranking（データのある人だけ）ではなく allStaff を使う。
  // ranking にすると、出勤していない人を選んだとき value に合う option がなく、
  // ブラウザが先頭の人（＝別人）を表示してしまう。
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
                <select className="control-select" value={staffName} onChange={(e) => handlePick(e.target.value)}>
                  {allStaff.map((s) => (
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

  // 合計には戻り分を含める（インセンのクラス判定もこの数字で行う）
  const totalPt = round2(staff.total + modoriTotalPt);
  const totalSelfClose = round2(
    staff.calendar.reduce((sum, d) => Math.round((sum + (d.selfClose || 0)) * 100) / 100, 0) + modoriTotalSelfClose
  );

  return (
    <>
      <div className="analysis-controls attendance-stats-row" style={{ alignItems: 'center' }}>
        <div className="control-group">
          {userRole !== 'アルバイト' && userRole !== '業務委託' && <span className="control-label">スタッフ選択</span>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {userRole === 'アルバイト' || userRole === '業務委託' ? (
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{staffName}</span>
            ) : (
              <select className="control-select" value={staffName} onChange={(e) => handlePick(e.target.value)}>
                {allStaff.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}
            {positionBadge}
          </div>
        </div>
        <div className="stat-figures">
          <div className="stat-figure">
            <span className="stat-figure-label">獲得</span>
            <span className={`stat-figure-value ${figureSizeClass(totalPt)}`}>{totalPt}<span className="stat-figure-unit">pt</span></span>
            {/* 戻りがあるときは獲得・自己クロの両方に内数を出す（片方が0でも並びをそろえる） */}
            {hasModori && <span className="stat-figure-note">┗戻り {modoriTotalPt}pt</span>}
          </div>
          <div className="stat-figure">
            <span className="stat-figure-label">自己クロ</span>
            <span className={`stat-figure-value ${figureSizeClass(totalSelfClose)}`}>{totalSelfClose}<span className="stat-figure-unit">pt</span></span>
            {hasModori && <span className="stat-figure-note">┗戻り {modoriTotalSelfClose}pt</span>}
          </div>
        </div>
      </div>
      {/* アルバイトはクラスカードの中（現在クラスの左）に出勤日数を出すので、単独のカードは出さない */}
      {showIncentive ? (
        <IncentiveBar
          total={totalPt}
          selfClose={totalSelfClose}
          attendanceDays={attendanceDays}
          missingCount={missingDays.size}
        />
      ) : (
        <div className="attendance-days-card">
          <span className="attendance-days-label">出勤</span>
          <span className="attendance-days-value">{attendanceDays}</span>
          <span className="attendance-days-label">日</span>
          {missingDays.size > 0 && (
            <span className="attendance-days-note">（日報未提出 {missingDays.size}日を含む）</span>
          )}
        </div>
      )}
      <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="calendar-wrapper">
          <table className="cal-table">
            <thead>
              <tr>
                <th className="cal-label-col">日付</th>
                {Array.from({ length: days }, (_, i) => (
                  <th key={i} style={missingDays.has(i + 1) ? { background: 'rgba(180,30,30,0.35)' } : undefined}>
                    {i + 1}
                    {/* 戻り分を含む日に印を付ける（セルの数字は戻りを足した合算） */}
                    {modoriByDay.has(i + 1) && <span className="cal-modori-mark">*</span>}
                  </th>
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
                    const base = staff.calendar[i][row.key] ?? 0;
                    const add = modoriByDay.get(i + 1)?.[row.key] ?? 0;
                    const val = round2(base + add);
                    const displayVal = val === 0 ? '-' : val;
                    const cls = val === 0 ? 'cal-data-cell zero' : 'cal-data-cell';
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
              <tr>
                <td className="cal-label-col">交通費</td>
                {Array.from({ length: days }, (_, i) => {
                  const fare = staff.calendar[i].fare ?? 0;
                  return (
                    <td key={i} className={fare === 0 ? 'cal-data-cell zero' : 'cal-data-cell'}
                      style={missingDays.has(i + 1) ? { background: 'rgba(180,30,30,0.25)' } : undefined}>
                      {fare === 0 ? '-' : fare.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {hasModori && (
          <div className="cal-modori-note">
            <span className="cal-modori-mark">*</span> の日は戻り分（別日に戻ってきた獲得）を含みます
          </div>
        )}
      </div>
    </>
  );
}
