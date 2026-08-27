import { DashboardData, Staff, CalendarDay } from '@/types';

const DAYS = 28;
const SITES = ['渋谷店', '新宿店', '池袋店', '横浜店'];
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pickSite(): string {
  return SITES[Math.floor(Math.random() * SITES.length)];
}

function generateCalendar(daysInMonth: number): CalendarDay[] {
  return Array.from({ length: daysInMonth }, () => {
    const mnp = rand(0, 2);
    const nw = rand(0, 1.5);
    const uq = rand(0, 1);
    const hikari = rand(0, 1);
    const elec = rand(0, 0.5);
    const credit = rand(0, 0.5);
    const pt = Math.round((mnp + nw + uq + hikari + elec + credit) * 100) / 100;
    return {
      pt,
      selfClose: Math.random() > 0.7 ? rand(0.5, 2) : 0,
      mnp,
      new: nw,
      uq,
      nw: hikari,
      elec,
      credit,
      site: Math.random() > 0.15 ? pickSite() : '',
      fare: Math.random() > 0.15 ? rand(400, 1500) : 0,
    };
  });
}

function generateStaff(name: string, skill: number): Staff {
  const calendar = generateCalendar(DAYS);
  const mnp = Math.round(calendar.reduce((s, d) => s + d.mnp, 0) * 100) / 100;
  const newVal = Math.round(calendar.reduce((s, d) => s + d.new, 0) * 100) / 100;
  const change = Math.round(calendar.reduce((s, d) => s + d.uq, 0) * 100) / 100;
  const hikari = Math.round(calendar.reduce((s, d) => s + d.nw, 0) * 100) / 100;
  const elecTotal = Math.round(calendar.reduce((s, d) => s + d.elec, 0) * 100) / 100;
  const creditTotal = Math.round(calendar.reduce((s, d) => s + d.credit, 0) * 100) / 100;
  const tablet = Math.round(rand(0, 3) * skill * 100) / 100;
  const other = Math.round((elecTotal + creditTotal) * 100) / 100;
  const total = Math.round((mnp + newVal + change + hikari + tablet + other) * 100) / 100;

  const dailyTotal = calendar.map((d) => d.pt);

  const sites: Record<string, number> = {};
  const dailyBySite: Record<string, number[]> = {};
  calendar.forEach((d, i) => {
    if (d.site) {
      sites[d.site] = Math.round(((sites[d.site] || 0) + d.pt) * 100) / 100;
      if (!dailyBySite[d.site]) dailyBySite[d.site] = new Array(DAYS).fill(0);
      dailyBySite[d.site][i] = d.pt;
    }
  });

  const ageKeys = ['20代~30代', '40代~60代', '60代~'];
  const typeKeys = ['家族', '2名', 'シングル'];
  const ages: Record<string, number> = {};
  const types: Record<string, number> = {};
  ageKeys.forEach((k) => (ages[k] = Math.round(rand(3, 15))));
  typeKeys.forEach((k) => (types[k] = Math.round(rand(2, 12))));

  return {
    name,
    total,
    mnp,
    new: newVal,
    change,
    hikari,
    tablet,
    other,
    selfClose: Math.round(rand(0, 5)),
    sites,
    ages,
    types,
    dailyTotal,
    dailyBySite,
    calendar,
  };
}

const STAFF_NAMES = [
  '田中 太郎',
  '佐藤 花子',
  '鈴木 一郎',
  '高橋 美咲',
  '渡辺 健太',
  '伊藤 結衣',
  '山本 大輔',
  '中村 さくら',
  '小林 翔太',
  '加藤 真由美',
];

export function generateMockData(): DashboardData {
  const staffList = STAFF_NAMES.map((name, i) => {
    const skill = 1 + (STAFF_NAMES.length - i) * 0.12;
    return generateStaff(name, skill);
  }).sort((a, b) => b.total - a.total);

  const kpi = { total: 0, mnp: 0, new: 0, change: 0, hikari: 0, tablet: 0, other: 0 };
  staffList.forEach((s) => {
    kpi.total = Math.round((kpi.total + s.total) * 100) / 100;
    kpi.mnp = Math.round((kpi.mnp + s.mnp) * 100) / 100;
    kpi.new = Math.round((kpi.new + s.new) * 100) / 100;
    kpi.change = Math.round((kpi.change + s.change) * 100) / 100;
    kpi.hikari = Math.round((kpi.hikari + s.hikari) * 100) / 100;
    kpi.tablet = Math.round((kpi.tablet + s.tablet) * 100) / 100;
    kpi.other = Math.round((kpi.other + s.other) * 100) / 100;
  });

  const prevKpi = {
    total: Math.round(kpi.total * rand(0.85, 1.15) * 100) / 100,
    mnp: Math.round(kpi.mnp * rand(0.8, 1.2) * 100) / 100,
    new: Math.round(kpi.new * rand(0.8, 1.2) * 100) / 100,
    change: Math.round(kpi.change * rand(0.8, 1.2) * 100) / 100,
    hikari: Math.round(kpi.hikari * rand(0.8, 1.2) * 100) / 100,
    tablet: Math.round(kpi.tablet * rand(0.8, 1.2) * 100) / 100,
    other: Math.round(kpi.other * rand(0.8, 1.2) * 100) / 100,
  };

  const globalStats = {
    sites: {} as Record<string, number>,
    ages: {} as Record<string, number>,
    types: {} as Record<string, number>,
    dailyTotal: new Array(DAYS).fill(0) as number[],
  };
  staffList.forEach((s) => {
    Object.entries(s.sites).forEach(([k, v]) => {
      globalStats.sites[k] = Math.round(((globalStats.sites[k] || 0) + v) * 100) / 100;
    });
    Object.entries(s.ages).forEach(([k, v]) => {
      globalStats.ages[k] = (globalStats.ages[k] || 0) + v;
    });
    Object.entries(s.types).forEach(([k, v]) => {
      globalStats.types[k] = (globalStats.types[k] || 0) + v;
    });
    s.dailyTotal.forEach((v, i) => {
      globalStats.dailyTotal[i] = Math.round((globalStats.dailyTotal[i] + v) * 100) / 100;
    });
  });

  const siteDetails: Record<string, { total: number; staffBreakdown: Record<string, number>; dailyTotal: number[] }> = {};
  staffList.forEach((s) => {
    Object.entries(s.sites).forEach(([siteName, siteTotal]) => {
      if (!siteDetails[siteName]) {
        siteDetails[siteName] = { total: 0, staffBreakdown: {}, dailyTotal: new Array(DAYS).fill(0) };
      }
      siteDetails[siteName].total = Math.round((siteDetails[siteName].total + siteTotal) * 100) / 100;
      siteDetails[siteName].staffBreakdown[s.name] = siteTotal;
    });
    Object.entries(s.dailyBySite).forEach(([siteName, daily]) => {
      if (siteDetails[siteName]) {
        daily.forEach((v, i) => {
          siteDetails[siteName].dailyTotal[i] = Math.round((siteDetails[siteName].dailyTotal[i] + v) * 100) / 100;
        });
      }
    });
  });

  return {
    kpi,
    prevKpi,
    ranking: staffList,
    globalStats,
    siteDetails,
    daysInMonth: DAYS,
  };
}
