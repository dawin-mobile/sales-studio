import { DashboardData, KPI, Staff, CalendarDay, GlobalStats, SiteDetail } from '@/types';

const safeAdd = (a: number, b: number) => Math.round((a + b) * 100) / 100;

// Column indices for 合算データ sheet (0-based, matching GAS COL definition)
const COL = {
  DATE: 1,
  NAME: 2,
  SITE: 5,
  MNP_H: 6,
  MNP_S: 7,
  NEW: 8,
  CHANGE: 9,
  CELLUP: 10,
  HIKARI_N: 11,
  HIKARI_T: 12,
  HIKARI_C: 13,
  TABLET: 14,
  LIFE: 15,
  CREDIT: 16,
  SELF_CLOSE: 17,
  FARE: 32,  // AG列: 往復交通費（公共交通機関）
  TAXI: 33,  // AH列: タクシー代・有料特急（事前承諾が必要なもの）
};

function getNum(row: string[], idx: number): number {
  const val = row[idx];
  if (val === undefined || val === null || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function aggregateMainSheet(
  rows: string[][],
  targetYear: number,
  targetMonthIdx: number
): DashboardData {
  const prevDate = new Date(targetYear, targetMonthIdx - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonthIdx = prevDate.getMonth();
  const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();

  const staffMap: Record<string, Staff> = {};
  const siteDetails: Record<string, SiteDetail> = {};
  const kpi: KPI = { total: 0, mnp: 0, new: 0, change: 0, hikari: 0, tablet: 0, other: 0 };
  const prevKpi: KPI = { total: 0, mnp: 0, new: 0, change: 0, hikari: 0, tablet: 0, other: 0 };

  const initStaff = (name: string) => {
    if (!staffMap[name]) {
      staffMap[name] = {
        name,
        total: 0, mnp: 0, new: 0, change: 0, hikari: 0, tablet: 0, other: 0, selfClose: 0,
        sites: {}, ages: {}, types: {},
        dailyTotal: new Array(daysInMonth).fill(0),
        dailyBySite: {},
        calendar: Array.from({ length: daysInMonth }, (): CalendarDay => ({
          pt: 0, selfClose: 0, mnp: 0, new: 0, uq: 0, nw: 0, elec: 0, credit: 0, site: '', fare: 0,
        })),
      };
    }
  };

  // Skip header row (rows[0])
  const dataRows = rows.slice(1);

  dataRows.forEach((row) => {
    const rowDateVal = row[COL.DATE];
    if (!rowDateVal) return;

    const d = new Date(rowDateVal);
    if (isNaN(d.getTime())) return;

    const isCurrent = d.getFullYear() === targetYear && d.getMonth() === targetMonthIdx;
    const isPrev = d.getFullYear() === prevYear && d.getMonth() === prevMonthIdx;
    if (!isCurrent && !isPrev) return;

    const name = row[COL.NAME];
    if (!name) return;

    const mnp = safeAdd(getNum(row, COL.MNP_H), getNum(row, COL.MNP_S));
    const neew = getNum(row, COL.NEW);
    const change = safeAdd(getNum(row, COL.CHANGE), getNum(row, COL.CELLUP));
    const hikari = safeAdd(safeAdd(getNum(row, COL.HIKARI_N), getNum(row, COL.HIKARI_T)), getNum(row, COL.HIKARI_C));
    const tablet = getNum(row, COL.TABLET);
    const life = getNum(row, COL.LIFE);
    const credit = getNum(row, COL.CREDIT);
    const selfClose = getNum(row, COL.SELF_CLOSE);
    const other = safeAdd(life, credit);
    const rowTotal = safeAdd(safeAdd(safeAdd(mnp, neew), change), safeAdd(safeAdd(hikari, tablet), other));

    if (isCurrent) {
      initStaff(name);
      const s = staffMap[name];
      s.mnp = safeAdd(s.mnp, mnp);
      s.new = safeAdd(s.new, neew);
      s.change = safeAdd(s.change, change);
      s.hikari = safeAdd(s.hikari, hikari);
      s.tablet = safeAdd(s.tablet, tablet);
      s.other = safeAdd(s.other, other);
      s.total = safeAdd(s.total, rowTotal);
      s.selfClose = safeAdd(s.selfClose, selfClose);

      const siteName = row[COL.SITE] ? String(row[COL.SITE]) : '';
      if (siteName) {
        if (!s.sites[siteName]) s.sites[siteName] = 0;
        s.sites[siteName] = safeAdd(s.sites[siteName], rowTotal);
      }

      const dayIndex = d.getDate() - 1;
      s.dailyTotal[dayIndex] = safeAdd(s.dailyTotal[dayIndex], rowTotal);
      if (siteName) {
        if (!s.dailyBySite[siteName]) s.dailyBySite[siteName] = new Array(daysInMonth).fill(0);
        s.dailyBySite[siteName][dayIndex] = safeAdd(s.dailyBySite[siteName][dayIndex], rowTotal);
      }

      const cDay = s.calendar[dayIndex];
      cDay.pt = safeAdd(cDay.pt, rowTotal);
      cDay.selfClose = safeAdd(cDay.selfClose, selfClose);
      cDay.mnp = safeAdd(cDay.mnp, mnp);
      cDay.new = safeAdd(cDay.new, neew);
      cDay.uq = safeAdd(cDay.uq, change);
      cDay.nw = safeAdd(cDay.nw, hikari);
      cDay.elec = safeAdd(cDay.elec, life);
      cDay.credit = safeAdd(cDay.credit, credit);
      // 交通費は往復とタクシー代を合わせた実費（円）。同じ日に複数行あれば合算する
      cDay.fare = cDay.fare + getNum(row, COL.FARE) + getNum(row, COL.TAXI);
      if (siteName) cDay.site = siteName;

      if (siteName) {
        if (!siteDetails[siteName]) {
          siteDetails[siteName] = { total: 0, staffBreakdown: {}, dailyTotal: new Array(daysInMonth).fill(0) };
        }
        siteDetails[siteName].total = safeAdd(siteDetails[siteName].total, rowTotal);
        siteDetails[siteName].dailyTotal[dayIndex] = safeAdd(siteDetails[siteName].dailyTotal[dayIndex], rowTotal);
        if (!siteDetails[siteName].staffBreakdown[name]) siteDetails[siteName].staffBreakdown[name] = 0;
        siteDetails[siteName].staffBreakdown[name] = safeAdd(siteDetails[siteName].staffBreakdown[name], rowTotal);
      }

      kpi.total = safeAdd(kpi.total, rowTotal);
      kpi.mnp = safeAdd(kpi.mnp, mnp);
      kpi.new = safeAdd(kpi.new, neew);
      kpi.change = safeAdd(kpi.change, change);
      kpi.hikari = safeAdd(kpi.hikari, hikari);
      kpi.tablet = safeAdd(kpi.tablet, tablet);
      kpi.other = safeAdd(kpi.other, other);
    }

    if (isPrev) {
      prevKpi.total = safeAdd(prevKpi.total, rowTotal);
      prevKpi.mnp = safeAdd(prevKpi.mnp, mnp);
      prevKpi.new = safeAdd(prevKpi.new, neew);
      prevKpi.change = safeAdd(prevKpi.change, change);
      prevKpi.hikari = safeAdd(prevKpi.hikari, hikari);
      prevKpi.tablet = safeAdd(prevKpi.tablet, tablet);
      prevKpi.other = safeAdd(prevKpi.other, other);
    }
  });

  const ranking = Object.values(staffMap).sort((a, b) => b.total - a.total);

  const globalStats: GlobalStats = {
    sites: {},
    ages: {},
    types: {},
    dailyTotal: new Array(daysInMonth).fill(0),
  };

  ranking.forEach((p) => {
    Object.entries(p.sites).forEach(([k, v]) => {
      globalStats.sites[k] = safeAdd(globalStats.sites[k] || 0, v);
    });
    Object.entries(p.ages).forEach(([k, v]) => {
      globalStats.ages[k] = (globalStats.ages[k] || 0) + v;
    });
    Object.entries(p.types).forEach(([k, v]) => {
      globalStats.types[k] = (globalStats.types[k] || 0) + v;
    });
    p.dailyTotal.forEach((v, i) => {
      globalStats.dailyTotal[i] = safeAdd(globalStats.dailyTotal[i], v);
    });
  });

  return { kpi, prevKpi, ranking, globalStats, siteDetails, daysInMonth };
}

// Sheet columns: [タイムスタンプ(0), 名前(1), 年代(2), 件数(3)]
export function aggregateAgeSheet(rows: string[][], staffMap: Record<string, Staff>, targetYear: number, targetMonthIdx: number) {
  const dataRows = rows.slice(1);
  dataRows.forEach((row) => {
    const dateVal = row[0];
    if (!dateVal) return;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return;
    if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonthIdx) return;

    const name = row[1];
    if (!name || !staffMap[name]) return;

    const ageGroup = row[2];
    if (!ageGroup) return;
    const count = getNum(row, 3) || 1;
    if (!staffMap[name].ages[ageGroup]) staffMap[name].ages[ageGroup] = 0;
    staffMap[name].ages[ageGroup] += count;
  });
}

// Sheet columns: [タイムスタンプ(0), 名前(1), 組数(2), 件数(3)]
export function aggregateTypeSheet(rows: string[][], staffMap: Record<string, Staff>, targetYear: number, targetMonthIdx: number) {
  const dataRows = rows.slice(1);
  dataRows.forEach((row) => {
    const dateVal = row[0];
    if (!dateVal) return;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return;
    if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonthIdx) return;

    const name = row[1];
    if (!name || !staffMap[name]) return;

    const typeGroup = row[2];
    if (!typeGroup) return;
    const count = getNum(row, 3) || 1;
    if (!staffMap[name].types[typeGroup]) staffMap[name].types[typeGroup] = 0;
    staffMap[name].types[typeGroup] += count;
  });
}
