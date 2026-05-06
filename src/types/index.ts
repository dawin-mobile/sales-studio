export type Role = '管理者' | '幹部' | '社員' | 'アルバイト' | '業務委託';

export interface User {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface CalendarDay {
  pt: number;
  selfClose: number;
  mnp: number;
  new: number;
  uq: number;
  nw: number;
  elec: number;
  credit: number;
  site: string;
}

export interface Staff {
  name: string;
  position?: string;
  total: number;
  mnp: number;
  new: number;
  change: number;
  hikari: number;
  tablet: number;
  other: number;
  selfClose: number;
  sites: Record<string, number>;
  ages: Record<string, number>;
  types: Record<string, number>;
  dailyTotal: number[];
  dailyBySite: Record<string, number[]>;
  calendar: CalendarDay[];
}

export interface KPI {
  total: number;
  mnp: number;
  new: number;
  change: number;
  hikari: number;
  tablet: number;
  other: number;
}

export interface SiteDetail {
  total: number;
  staffBreakdown: Record<string, number>;
  dailyTotal: number[];
}

export interface GlobalStats {
  sites: Record<string, number>;
  ages: Record<string, number>;
  types: Record<string, number>;
  dailyTotal: number[];
}

export interface DashboardData {
  kpi: KPI;
  prevKpi: KPI;
  ranking: Staff[];
  staffOrder?: { name: string; position?: string; role?: string }[];
  globalStats: GlobalStats;
  siteDetails: Record<string, SiteDetail>;
  daysInMonth: number;
}

export interface ShiftRow {
  date: string;
  dayOfWeek: string;
  location: string;
  startTime: string;
  order1: string;
  order2: string;
  staff: string[];
  finalStaff: string;
  agency: string;
  sheetRegion: '東京' | '福岡';
  isHoliday: boolean;
}

export type TabName =
  | 'dashboard'
  | 'visual-ranking'
  | 'stacked-chart'
  | 'analysis'
  | 'attendance'
  | 'analytics'
  | 'shift'
  | 'profile'
  | 'growth';

export interface StaffEvaluation {
  staffName: string;
  totalScore: number;
  rank: number;
  potential: string;
  attendance: string;
  attribute: string;
  supervisor: string;
  scores: Record<string, number>;
  knowledge: Record<string, boolean>;
  knowledgeItems: string[];
}

export type AnalysisMode = 'overall' | 'individual' | 'site' | 'compare';
