'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

async function fetchWithRetry(url: string, timeoutMs = 15000): Promise<Response> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && e.name === 'AbortError' && attempt === 0) continue;
      throw e;
    }
  }
  throw new Error('リクエストに失敗しました');
}
import { useSession, signOut } from 'next-auth/react';
import { RefreshCw, ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { TabName, DashboardData, ShiftRow } from '@/types';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import KpiCards from '@/components/KpiCards';
import BarChart from '@/components/BarChart';
import StackedBarChart from '@/components/StackedBarChart';
import RankingList from '@/components/RankingList';
import RankingTable from '@/components/RankingTable';
import AnalysisView from '@/components/AnalysisView';
import AttendanceTable from '@/components/AttendanceTable';
import ShiftView from '@/components/ShiftView';
import ProfileView from '@/components/ProfileView';
import NippoAlert from '@/components/NippoAlert';
import TalknoteCard from '@/components/TalknoteCard';
import GrowthView from '@/components/GrowthView';
import TardinessView from '@/components/TardinessView';
import AnalyticsView from '@/components/AnalyticsView';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import IncentiveBar from '@/components/IncentiveBar';

const TAB_TITLES: Record<TabName, string> = {
  'dashboard': '獲得状況',
  'visual-ranking': 'ランキング',
  'stacked-chart': 'MNP・新規・SU',
  'analysis': '分析・比較',
  'attendance': '個人実績',
  'analytics': '実績・分析',
  'shift': 'シフト',
  'profile': 'スタッフ',
  'growth': '育成管理',
  'tardiness': '遅刻/早退',
};

export default function Home() {
  const { data: session } = useSession();
  useActivityTracker();
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [rankingView, setRankingView] = useState<'default' | 'total' | 'selfclose' | 'mnp' | 'table'>('default');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<{ name: string; contact: string; mentees: string[] }[]>([]);
  const [loginInfoOpen, setLoginInfoOpen] = useState(false);
  const [loginInfoList, setLoginInfoList] = useState<{ name: string; loginInfo: string }[]>([]);
  const [tenureOpen, setTenureOpen] = useState(false);
  const [tenureList, setTenureList] = useState<{ name: string; joinDate: string; years: number; months: number; totalMonths: number }[]>([]);
  const [meData, setMeData] = useState<{ birthday: string; bloodType: string; joinDate: string; animal: string; zodiac: string } | null>(null);
  const [impersonated, setImpersonated] = useState<{ name: string; role: string } | null>(null);
  const [allUsers, setAllUsers] = useState<{ name: string; role: string }[]>([]);
  const [secretMode, setSecretMode] = useState(false);
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTab = useRef<TabName>('dashboard');

  // なりすまし時に使う実効値
  const effectiveName = impersonated?.name ?? session?.user?.name;
  const effectiveRole = impersonated?.role ?? session?.user?.role;

  const handleLogoTap = useCallback(() => {
    if (!['社員', '幹部', '管理者'].includes(effectiveRole ?? '')) return;
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    if (logoTapCount.current >= 3) {
      logoTapCount.current = 0;
      setSecretMode(v => !v);
    } else {
      logoTapTimer.current = setTimeout(() => { logoTapCount.current = 0; }, 800);
    }
  }, [effectiveRole]);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState('更新中...');

  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([]);
  const [tokyoStaffNames, setTokyoStaffNames] = useState<string[]>([]);
  const [fukuokaStaffNames, setFukuokaStaffNames] = useState<string[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shiftFetchedMonth, setShiftFetchedMonth] = useState<string | null>(null);

  const fetchShift = useCallback(async (month: string) => {
    setShiftLoading(true);
    setShiftError(null);
    try {
      const res = await fetchWithRetry(`/api/shift?month=${month}`);
      if (!res.ok) {
        const text = await res.text();
        let msg = 'シフトデータの取得に失敗しました';
        try { msg = JSON.parse(text).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const json: { rows: ShiftRow[]; tokyoStaffNames: string[]; fukuokaStaffNames: string[] } = await res.json();
      setShiftRows(json.rows);
      setTokyoStaffNames(json.tokyoStaffNames);
      setFukuokaStaffNames(json.fukuokaStaffNames);
    } catch (e) {
      const msg = e instanceof Error
        ? (e.name === 'AbortError' ? 'タイムアウトしました。再度お試しください。' : e.message)
        : 'シフトデータの取得に失敗しました';
      setShiftError(msg);
      setShiftRows([]);
    } finally {
      setShiftFetchedMonth(month);
      setShiftLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(`/api/data?month=${month}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'データの取得に失敗しました');
      }
      const json: DashboardData = await res.json();
      setData(json);
      const t = new Date();
      setLastUpdate(`最終更新: ${new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(t)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedMonth);
  }, [selectedMonth, fetchData]);

  // シフトタブ表示中 or 切り替え時に（未取得 or 月が変わっていたら）取得
  useEffect(() => {
    if (activeTab === 'shift' && shiftFetchedMonth !== selectedMonth) {
      fetchShift(selectedMonth);
    }
  }, [activeTab, selectedMonth, shiftFetchedMonth, fetchShift]);

  // ページロード時にprefetch（ドロワーを開いた時に即表示するため）
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setMeData(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!drawerOpen || (session?.user?.role as string) !== '管理者' || allUsers.length > 0) return;
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => setAllUsers(d))
      .catch(() => {});
  }, [drawerOpen, session?.user?.role, allUsers.length]);

  // タブ切り替え時にすべてのパネルを閉じ、スクロール位置をリセット
  useEffect(() => {
    if (secretMode) {
      prevTab.current = activeTab;
      setActiveTab('growth');
    } else {
      setActiveTab(prevTab.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secretMode]);

  useEffect(() => {
    setDrawerOpen(false);
    setContactsOpen(false);
    setLoginInfoOpen(false);
    document.querySelector<HTMLElement>('.main-content')?.scrollTo({ top: 0 });
  }, [activeTab]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  return (
    <AuthGuard>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userName={session?.user?.name}
        userRole={session?.user?.role}
        secretMode={secretMode}
        onLogoTap={handleLogoTap}
      />

      <main className="main-content">
        <header className="header-area">
          {/* ブランドバー: スマホのみ表示 */}
          <div className="header-brand-row">
            <div className="header-logo" onClick={handleLogoTap} style={{ cursor: 'pointer' }}>
              <Image src={secretMode ? '/L-icon4g-g-512.png' : '/L-icon4w-512.png'} alt="logo" width={36} height={36} style={{ borderRadius: 10, flexShrink: 0 }} />
              <span style={{ fontSize: 22, fontWeight: 700, color: secretMode ? '#4ade80' : 'var(--text-main)', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                Sales Studio
              </span>
            </div>
            {/* 右側: アバター＋最終更新（スマホのみ） */}
            <div className="header-brand-right">
              {session?.user?.name && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="header-avatar-btn"
                  title={session.user.name}
                >
                  {session.user.name.slice(0, 2)}
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#aaa' }}>{lastUpdate}</span>
                <button
                  onClick={() => {
                    fetchData(selectedMonth);
                    if (activeTab === 'shift') fetchShift(selectedMonth);
                  }}
                  title="更新"
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#aaa', display: 'flex', alignItems: 'center', opacity: 0.55 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.55')}
                >
                  <RefreshCw size={13} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
          {/* ページタイトル＋月選択、PC時はアバター＋最終更新も表示 */}
          <div className="header-top-row">
            <div className="header-left">
              <h1 className="page-title">{TAB_TITLES[activeTab]}</h1>
              {activeTab !== 'profile' && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  aria-label="表示月を選択"
                />
              )}
            </div>
            {/* PC時のみ表示 */}
            <div className="header-pc-right">
              {session?.user?.name && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="header-avatar-btn"
                  title={session.user.name}
                >
                  {session.user.name.slice(0, 2)}
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#aaa' }}>{lastUpdate}</span>
                <button
                  onClick={() => {
                    fetchData(selectedMonth);
                    if (activeTab === 'shift') fetchShift(selectedMonth);
                  }}
                  title="更新"
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#aaa', display: 'flex', alignItems: 'center', opacity: 0.55 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.55')}
                >
                  <RefreshCw size={13} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <NippoAlert />

        {/* なりすまし中バナー */}
        {impersonated && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(234,179,8,0.15)',
            border: '1px solid rgba(234,179,8,0.4)',
            borderRadius: 8,
            padding: '6px 12px',
            marginBottom: 8,
            fontSize: 13,
            color: '#fbbf24',
          }}>
            <span>{impersonated.name}（{impersonated.role}）でログイン中</span>
            <button
              onClick={() => setImpersonated(null)}
              style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        )}

        {secretMode && ['社員', '幹部', '管理者'].includes(effectiveRole ?? '') ? (
          <>
            {activeTab === 'growth' && <GrowthView />}
            {activeTab === 'tardiness' && <TardinessView />}
          </>
        ) : (<>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
            データを読み込んでいます...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: 40, color: '#ff4e45' }}>
            エラー: {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {activeTab === 'dashboard' && (
              <>
                <TalknoteCard />
                <KpiCards kpi={data.kpi} prevKpi={data.prevKpi} />
                <div className="dashboard-split">
                  <div className="chart-card">
                    <h3 style={{ fontSize: '14px', color: 'var(--text-sub)', marginBottom: '10px' }}>
                      Top 10 チャート
                    </h3>
                    <BarChart ranking={[...data.ranking].sort((a, b) => b.total - a.total)} limit={10} />
                  </div>
                  <div className="ranking-card">
                    <div style={{ padding: '16px', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
                      トップパフォーマー
                    </div>
                    <RankingList ranking={data.ranking} limit={5} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'visual-ranking' && (
              <>
                {/* PC用タブ */}
                <div className="ranking-charts-pc" style={{ marginBottom: 16 }}>
                  <div className="shift-region-toggle">
                    <button
                      className={`shift-region-btn${rankingView === 'mnp' ? ' active' : ''}`}
                      onClick={() => setRankingView(rankingView === 'mnp' ? 'default' : 'mnp')}
                    >
                      MNP・新規・SU
                    </button>
                    <button
                      className={`shift-region-btn${rankingView === 'table' ? ' active' : ''}`}
                      onClick={() => setRankingView(rankingView === 'table' ? 'default' : 'table')}
                    >
                      詳細
                    </button>
                  </div>
                </div>

                {/* MNP・新規・SU (PC) */}
                {rankingView === 'mnp' && (
                  <div className="ranking-charts-pc">
                    <div className="chart-card" style={{ width: '100%' }}>
                      <StackedBarChart ranking={data.ranking} />
                    </div>
                  </div>
                )}

                {/* 詳細テーブル (PC) */}
                {rankingView === 'table' && (
                  <div className="ranking-charts-pc" style={{ width: '100%' }}>
                    <RankingTable ranking={data.ranking} />
                  </div>
                )}

                {/* 獲得・自己クロ (PC横並び) */}
                {(rankingView === 'default' || rankingView === 'total' || rankingView === 'selfclose') && (
                  <div className="ranking-charts-pc" style={{ gap: 16 }}>
                    <div className="chart-card" style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8 }}>獲得</div>
                      <BarChart ranking={[...data.ranking].sort((a, b) => b.total - a.total)} />
                    </div>
                    <div className="chart-card" style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8 }}>自己クロ</div>
                      <BarChart
                        ranking={[...data.ranking].sort((a, b) => b.selfClose - a.selfClose)}
                        getValue={(s) => s.selfClose}
                        color="#f97316"
                      />
                    </div>
                  </div>
                )}

                {/* SP: 獲得/自己クロ常時表示 + MNP・詳細タブ */}
                <div className="ranking-charts-sp">
                  {/* 獲得・自己クロ タブ（常時） */}
                  <div className="shift-controls" style={{ marginBottom: 12 }}>
                    <div className="shift-region-toggle">
                      <button
                        className={`shift-region-btn${rankingView === 'total' ? ' active' : ''}`}
                        onClick={() => setRankingView('total')}
                      >
                        獲得
                      </button>
                      <button
                        className={`shift-region-btn${rankingView === 'selfclose' ? ' active' : ''}`}
                        onClick={() => setRankingView('selfclose')}
                      >
                        自己クロ
                      </button>
                    </div>
                  </div>
                  {/* MNP・詳細 タブ */}
                  <div className="shift-controls" style={{ marginBottom: 16 }}>
                    <div className="shift-region-toggle">
                      <button
                        className={`shift-region-btn${rankingView === 'mnp' ? ' active' : ''}`}
                        onClick={() => setRankingView(rankingView === 'mnp' ? 'total' : 'mnp')}
                      >
                        MNP・新規・SU
                      </button>
                      <button
                        className={`shift-region-btn${rankingView === 'table' ? ' active' : ''}`}
                        onClick={() => setRankingView(rankingView === 'table' ? 'total' : 'table')}
                      >
                        詳細
                      </button>
                    </div>
                  </div>
                  {/* コンテンツ */}
                  {rankingView === 'mnp' && (
                    <div className="chart-card"><StackedBarChart ranking={data.ranking} /></div>
                  )}
                  {rankingView === 'table' && (
                    <RankingTable ranking={data.ranking} />
                  )}
                  {rankingView !== 'mnp' && rankingView !== 'table' && (
                    <div className="chart-card">
                      {rankingView === 'selfclose' ? (
                        <BarChart
                          ranking={[...data.ranking].sort((a, b) => b.selfClose - a.selfClose)}
                          getValue={(s) => s.selfClose}
                          color="#f97316"
                        />
                      ) : (
                        <BarChart ranking={[...data.ranking].sort((a, b) => b.total - a.total)} />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'stacked-chart' && (
              <div className="chart-card">
                <StackedBarChart ranking={data.ranking} />
              </div>
            )}

            {activeTab === 'analysis' && (
              <AnalysisView data={data} />
            )}

            {activeTab === 'attendance' && (
              <div style={{ marginBottom: 28 }}>
                <AttendanceTable data={data} selectedMonth={selectedMonth} loginName={effectiveName} userRole={effectiveRole} />
              </div>
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView data={data} selectedMonth={selectedMonth} loginName={effectiveName} userRole={effectiveRole} />
            )}
          </>
        )}

        {activeTab === 'shift' && (
          <ShiftView
            rows={shiftRows}
            tokyoStaffNames={tokyoStaffNames}
            fukuokaStaffNames={fukuokaStaffNames}
            loading={shiftLoading}
            error={shiftError}
            selectedMonth={selectedMonth}
            userRole={effectiveRole}
          />
        )}

        {activeTab === 'profile' && <ProfileView effectiveRole={effectiveRole} effectiveName={effectiveName} />}

        {activeTab === 'growth' && ['社員', '幹部', '管理者'].includes(effectiveRole ?? '') && <GrowthView />}

        </>)}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} userRole={effectiveRole} secretMode={secretMode} />

      {/* プロフィール フルスクリーン / PC ドロップダウン */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
      )}
      {drawerOpen && session?.user?.name && (
        <div
          className="profile-panel"
          onTouchStart={(e) => { (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX); }}
          onTouchEnd={(e) => {
            const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
            if (e.changedTouches[0].clientX - startX > 80) setDrawerOpen(false);
          }}
        >
          {/* 戻るヘッダー（スマホのみ表示） */}
          <div className="profile-panel-header">
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
              }}
            >
              <ChevronLeft size={24} strokeWidth={1.75} />
            </button>
          </div>

          {/* コンテンツ */}
          <div style={{ padding: '28px 24px', paddingBottom: 'calc(28px + 50px + env(safe-area-inset-bottom))', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {/* アバター + 名前 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <div className="header-avatar-btn" style={{ cursor: 'default', fontSize: 18, width: 56, height: 56, flexShrink: 0 }}>
                {session.user.name.slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>{session.user.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>{session.user.role}</div>
              </div>
            </div>

            {/* プロフィール情報 */}
            {meData && (meData.birthday || meData.bloodType || meData.animal || meData.zodiac) && (
              <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {meData.birthday && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-sub)' }}>生年月日</span>
                    <span style={{ color: 'var(--text-main)' }}>{meData.birthday}</span>
                  </div>
                )}
                {meData.bloodType && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-sub)' }}>血液型</span>
                    <span style={{ color: 'var(--text-main)' }}>{meData.bloodType}</span>
                  </div>
                )}
                {meData.animal && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-sub)' }}>動物占い</span>
                    <span style={{ color: 'var(--text-main)' }}>{meData.animal}</span>
                  </div>
                )}
                {meData.zodiac && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-sub)' }}>星座</span>
                    <span style={{ color: 'var(--text-main)' }}>{meData.zodiac}</span>
                  </div>
                )}
                {meData.joinDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-sub)' }}>入社日</span>
                    <span style={{ color: 'var(--text-main)' }}>{meData.joinDate}</span>
                  </div>
                )}
              </div>
            )}

            {/* 管理者向けスタッフ切り替え */}
            {(session.user.role as string) === '管理者' && allUsers.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 8 }}>スタッフとして表示</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    style={{
                      flex: 1,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      color: 'var(--text-main)',
                      fontSize: 14,
                      padding: '8px 10px',
                    }}
                    value={impersonated?.name ?? ''}
                    onChange={(e) => {
                      const user = allUsers.find((u) => u.name === e.target.value);
                      setImpersonated(user ? { name: user.name, role: user.role as string } : null);
                    }}
                  >
                    <option value=''>-- 選択 --</option>
                    {allUsers.map((u) => (
                      <option key={u.name} value={u.name}>{u.name}（{u.role}）</option>
                    ))}
                  </select>
                  {impersonated && (
                    <button
                      onClick={() => setImpersonated(null)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        color: 'var(--text-sub)',
                        fontSize: 13,
                        padding: '8px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      解除
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 社員連絡先メニュー */}
            <button
              onClick={() => {
                if (contacts.length === 0) {
                  fetch('/api/contacts').then(r => r.json()).then(setContacts).catch(() => {});
                }
                setContactsOpen(true);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: 15,
                cursor: 'pointer',
                marginBottom: 16,
              }}
            >
              <span>社員連絡先</span>
              <ChevronLeft size={18} strokeWidth={1.75} style={{ transform: 'rotate(180deg)', color: 'var(--text-sub)' }} />
            </button>

            {/* 勤続年数（社員以上） */}
            {(session.user.role === '管理者' || session.user.role === '社員') && (
              <button
                onClick={() => {
                  if (tenureList.length === 0) {
                    fetch('/api/admin/tenure').then(r => r.json()).then(setTenureList).catch(() => {});
                  }
                  setTenureOpen(true);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 15,
                  cursor: 'pointer',
                  marginBottom: 16,
                }}
              >
                <span>勤続年数</span>
                <ChevronLeft size={18} strokeWidth={1.75} style={{ transform: 'rotate(180deg)', color: 'var(--text-sub)' }} />
              </button>
            )}

            {/* ログイン情報（管理者のみ） */}
            {(session.user.role as string) === '管理者' && (
              <button
                onClick={() => {
                  setLoginInfoList([]);
                  fetch('/api/admin/login-info').then(r => r.json()).then(setLoginInfoList).catch(() => {});
                  setLoginInfoOpen(true);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 15,
                  cursor: 'pointer',
                  marginBottom: 16,
                }}
              >
                <span>ログイン情報</span>
                <ChevronLeft size={18} strokeWidth={1.75} style={{ transform: 'rotate(180deg)', color: 'var(--text-sub)' }} />
              </button>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                color: 'var(--text-sub)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      )}

      {/* 勤続年数パネル */}
      {tenureOpen && (
        <div onClick={() => setTenureOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
      )}
      {tenureOpen && (
        <div
          className="contacts-panel"
          onTouchStart={(e) => { (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX); }}
          onTouchEnd={(e) => {
            const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
            if (e.changedTouches[0].clientX - startX > 80) setTenureOpen(false);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 8px', paddingTop: 'calc(10px + env(safe-area-inset-top))', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <button onClick={() => setTenureOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px' }}>
              <ChevronLeft size={24} strokeWidth={1.75} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginLeft: 4 }}>勤続年数</span>
          </div>
          <div style={{ padding: '16px', paddingBottom: 'calc(50px + env(safe-area-inset-bottom))', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {tenureList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)', fontSize: 14 }}>読み込み中...</div>
            ) : (() => {
              return tenureList.map((item) => (
                <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '5.5em 6em 1fr auto', alignItems: 'center', gap: 8, padding: '12px 0', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                  <span style={{ color: 'var(--text-sub)', fontSize: 11 }}>{item.joinDate}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, var(--accent-color))' }} />
                    <span style={{ color: 'var(--accent-color)', fontSize: 11, lineHeight: 1 }}>▷</span>
                  </div>
                  <span style={{ color: 'var(--text-sub)', textAlign: 'right' }}>
                    {item.years > 0 ? `${item.years}年` : ''}{item.months}ヶ月
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ログイン情報パネル（管理者のみ） */}
      {loginInfoOpen && (
        <div onClick={() => setLoginInfoOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
      )}
      {loginInfoOpen && (
        <div
          className="contacts-panel"
          onTouchStart={(e) => { (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX); }}
          onTouchEnd={(e) => {
            const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
            if (e.changedTouches[0].clientX - startX > 80) setLoginInfoOpen(false);
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 8px',
            paddingTop: 'calc(10px + env(safe-area-inset-top))',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setLoginInfoOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px' }}
            >
              <ChevronLeft size={24} strokeWidth={1.75} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginLeft: 4 }}>ログイン情報</span>
          </div>
          <div style={{ padding: '8px 0', paddingBottom: 'calc(50px + env(safe-area-inset-bottom))', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {loginInfoList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)', fontSize: 14 }}>読み込み中...</div>
            ) : (() => {
              const nowMs = Date.now();

              return loginInfoList.map((item) => {
                let badge: { label: string; color: string; bg: string; border: string };
                let formattedDate = '';

                if (item.loginInfo) {
                  // "2026/4/19 3:38:32" → "4/19 3:38:32"
                  formattedDate = item.loginInfo.replace(/^\d{4}\//, '');
                  // パース → JST のDateオブジェクトに変換
                  const p = item.loginInfo.split(/[\/\s:]/);
                  // new Date(年, 月-1, 日, 時, 分, 秒) はローカル時刻として解釈されるため
                  // UTC+9のオフセットを考慮して UTC ms に変換
                  const loginJstMs = Date.UTC(
                    parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]),
                    parseInt(p[3] ?? '0'), parseInt(p[4] ?? '0'), parseInt(p[5] ?? '0')
                  ) - 9 * 60 * 60 * 1000; // JSTをUTCに変換
                  const diffMin = (nowMs - loginJstMs) / 60000;

                  if (diffMin <= 60 * 24) {
                    badge = { label: '1日以内', color: '#22c55e', bg: '', border: '' };
                  } else if (diffMin <= 60 * 48) {
                    badge = { label: '2日以内', color: '#facc15', bg: '', border: '' };
                  } else if (diffMin <= 60 * 72) {
                    badge = { label: '3日以内', color: '#facc15', bg: '', border: '' };
                  } else {
                    badge = { label: '3日以上前', color: '#ef4444', bg: '', border: '' };
                  }
                } else {
                  badge = { label: '未ログイン', color: '#555', bg: '', border: '' };
                }

                return (
                  <div key={item.name} style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-sub)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: badge.color, flexShrink: 0, display: 'inline-block' }} />
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-sub)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{formattedDate}</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 社員連絡先パネル */}
      {contactsOpen && (
        <div onClick={() => setContactsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
      )}
      {contactsOpen && (
        <div
          className="contacts-panel"
          onTouchStart={(e) => { (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX); }}
          onTouchEnd={(e) => {
            const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
            if (e.changedTouches[0].clientX - startX > 80) setContactsOpen(false);
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 8px',
            paddingTop: 'calc(10px + env(safe-area-inset-top))',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setContactsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px' }}
            >
              <ChevronLeft size={24} strokeWidth={1.75} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginLeft: 4 }}>社員連絡先</span>
          </div>
          <div style={{ padding: '8px 0', paddingBottom: 'calc(50px + env(safe-area-inset-bottom))', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {contacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)', fontSize: 14 }}>読み込み中...</div>
            ) : (
              contacts.map((c) => (
                <div key={c.name} style={{
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</div>
                    <a
                      href={`tel:${c.contact.replace(/[-\s]/g, '')}`}
                      style={{ fontSize: 14, color: '#60a5fa', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {c.contact}
                    </a>
                  </div>
                  {c.mentees.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-sub)' }}>
                      {c.mentees.join('・')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
