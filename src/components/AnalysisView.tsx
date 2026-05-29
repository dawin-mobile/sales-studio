'use client';

import { useState } from 'react';
import { AnalysisMode, DashboardData } from '@/types';
import TrendChart from './TrendChart';
import DualLineChart from './DualLineChart';
import DoughnutChart from './DoughnutChart';

interface AnalysisViewProps {
  data: DashboardData;
}

function SiteBarChart({ sites, nameWidth = 100 }: { sites: Record<string, number>; nameWidth?: number }) {
  const sorted = Object.entries(sites).sort((a, b) => b[1] - a[1]);
  const maxVal = sorted.length > 0 ? sorted[0][1] : 1;
  if (sorted.length === 0) return <div style={{ color: '#555', padding: 10 }}>データなし</div>;
  return (
    <div className="bar-chart-container" style={{ maxHeight: 200 }}>
      {sorted.map(([name, val]) => (
        <div key={name} className="bar-row">
          <div className="bar-name" style={{ width: nameWidth }}>{name}</div>
          <div className="bar-area">
            <div className="bar-fill" style={{ width: `${(val / maxVal) * 100}%` }} />
            <div className="bar-val">{val}</div>
          </div>
        </div>
      ))}
    </div>
  );
}


function SingleColumn({ title, stats, isCompact = false }: { title: string; stats: { sites: Record<string, number>; ages: Record<string, number>; types: Record<string, number> }; isCompact?: boolean }) {
  return (
    <>
      <div className="compare-header">{title}</div>
      <div className="chart-card">
        <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: 10 }}>現場別</h3>
        <SiteBarChart sites={stats.sites} nameWidth={isCompact ? 60 : 100} />
      </div>
      <div className="chart-card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: '14px', color: '#aaa', marginBottom: 10 }}>客層・年代</h3>
        <div className="pie-container">
          <div className="nested-pie-wrapper">
            <DoughnutChart dataMap={stats.ages} cutout="70%" className="outer-pie-canvas" />
            <DoughnutChart dataMap={stats.types} cutout="60%" className="inner-pie-canvas" />
            <div className="pie-center-text">年代<br />・<br />客層</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AnalysisView({ data }: AnalysisViewProps) {
  const [mode, setMode] = useState<AnalysisMode>('overall');
  const [staff1, setStaff1] = useState(data.ranking[0]?.name || '');
  const [staff2, setStaff2] = useState(data.ranking[1]?.name || '');
  const [siteFilter, setSiteFilter] = useState('all');
  const [selectedSite, setSelectedSite] = useState(Object.keys(data.siteDetails)[0] || '');

  const siteNames = Object.keys(data.siteDetails).sort();

  return (
    <>
      <div className="analysis-controls">
        <div className="control-group">
          <span className="control-label">モード</span>
          <select className="control-select" value={mode} onChange={(e) => setMode(e.target.value as AnalysisMode)}>
            <option value="overall">全体分析</option>
            <option value="individual">個人分析 (推移)</option>
            <option value="site">現場別分析</option>
            <option value="compare">2名比較</option>
          </select>
        </div>

        {(mode === 'individual' || mode === 'compare') && (
          <div className="control-group">
            <span className="control-label">スタッフ 1</span>
            <select className="control-select" value={staff1} onChange={(e) => setStaff1(e.target.value)}>
              {data.ranking.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        )}

        {mode === 'individual' && (
          <div className="control-group">
            <span className="control-label">現場で絞り込む</span>
            <select className="control-select" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
              <option value="all">全ての現場</option>
              {siteNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {mode === 'compare' && (
          <div className="control-group">
            <span className="control-label">スタッフ 2</span>
            <select className="control-select" value={staff2} onChange={(e) => setStaff2(e.target.value)}>
              {data.ranking.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        )}

        {mode === 'site' && (
          <div className="control-group">
            <span className="control-label">現場を選択</span>
            <select className="control-select" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
              {siteNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        {mode === 'overall' && (
          <>
            <TrendChart title="全体の日別推移" dataArray={data.globalStats.dailyTotal} label="全体" />
            <SingleColumn title="全体集計" stats={data.globalStats} />
          </>
        )}

        {mode === 'individual' && (() => {
          const person = data.ranking.find((s) => s.name === staff1);
          if (!person) return null;
          let trendData = person.dailyTotal;
          let chartTitle = `${person.name} (全体推移)`;
          if (siteFilter !== 'all') {
            chartTitle = `${person.name} (${siteFilter} での推移)`;
            trendData = person.dailyBySite[siteFilter] || new Array(data.daysInMonth).fill(0);
          }
          return (
            <>
              <TrendChart title={chartTitle} dataArray={trendData} label="獲得数" />
              <SingleColumn title={`${person.name} さんの分析`} stats={person} />
            </>
          );
        })()}

        {mode === 'site' && (() => {
          const siteData = data.siteDetails[selectedSite];
          if (!siteData) return null;
          const breakdown = Object.entries(siteData.staffBreakdown)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
          const maxCount = breakdown.length > 0 ? breakdown[0].count : 1;
          return (
            <>
              <TrendChart title={`${selectedSite} の日別推移`} dataArray={siteData.dailyTotal} label="獲得数" />
              <div className="chart-card">
                <h3 style={{ fontSize: '16px', marginBottom: 10 }}>スタッフ別内訳</h3>
                <div className="bar-chart-container" style={{ maxHeight: 400 }}>
                  {breakdown.map((item) => (
                    <div key={item.name} className="bar-row">
                      <div className="bar-name" style={{ width: 100 }}>{item.name}</div>
                      <div className="bar-area">
                        <div className="bar-fill" style={{ width: `${(item.count / maxCount) * 100}%` }} />
                        <div className="bar-val">{item.count}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        {mode === 'compare' && (() => {
          const p1 = data.ranking.find((s) => s.name === staff1);
          const p2 = data.ranking.find((s) => s.name === staff2);
          if (!p1 || !p2) return null;
          return (
            <>
              <div className="compare-grid">
                <div className="compare-col">
                  <SingleColumn title={p1.name} stats={p1} isCompact />
                </div>
                <div className="compare-col">
                  <SingleColumn title={p2.name} stats={p2} isCompact />
                </div>
              </div>
              <DualLineChart name1={p1.name} data1={p1.dailyTotal} name2={p2.name} data2={p2.dailyTotal} />
            </>
          );
        })()}
      </div>
    </>
  );
}
