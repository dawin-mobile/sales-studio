'use client';

import { useState, useEffect } from 'react';

interface Tier {
  name: string;
  pt: number;
  incentive: number;
  selfClosePt: number | null;
}

const TIERS: Tier[] = [
  { name: 'グリーン',         pt:  0, incentive:     0, selfClosePt: null },
  { name: 'ビギナー',         pt:  5, incentive:  1000, selfClosePt: null },
  { name: 'レギュラー',       pt: 10, incentive:  2000, selfClosePt: null },
  { name: 'ブロンズ',         pt: 15, incentive:  3000, selfClosePt: 10 },
  { name: 'クローザー',       pt: 20, incentive:  4000, selfClosePt: 15 },
  { name: 'トップクローザー', pt: 25, incentive:  5000, selfClosePt: 20 },
  { name: 'レジェンド',       pt: 30, incentive:  8000, selfClosePt: 30 },
  { name: 'ゼウス',           pt: 40, incentive:  9000, selfClosePt: 40 },
  { name: 'ゼウスⅡ',         pt: 50, incentive: 10000, selfClosePt: 50 },
  { name: 'ゼウスⅢ',         pt: 60, incentive: 11000, selfClosePt: 60 },
  { name: 'ゼウスⅣ',         pt: 70, incentive: 12000, selfClosePt: 70 },
  { name: 'ゼウスⅤ',         pt: 80, incentive: 13000, selfClosePt: 80 },
  { name: 'ゼウスⅥ',         pt: 90, incentive: 14000, selfClosePt: 90 },
  { name: 'ゼウスⅦ',         pt: 100, incentive: 15000, selfClosePt: 100 },
];


function tierColor(tierIndex: number): string {
  const pt = TIERS[tierIndex].pt;
  if (pt < 15) return '#00ff88';
  if (pt < 30) return '#00cfff';
  return '#ff2d7a';
}

function getCurrentTier(total: number, selfClose: number): number {
  let idx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i];
    const ptOk = total >= t.pt;
    const scOk = t.selfClosePt === null || selfClose >= t.selfClosePt;
    if (ptOk && scOk) { idx = i; break; }
  }
  return idx;
}

function zoneProgress(total: number, min: number, max: number): number {
  if (total <= min) return 0;
  if (total >= max) return 100;
  return ((total - min) / (max - min)) * 100;
}

export default function IncentiveBar({ total, selfClose }: { total: number; selfClose: number }) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const ZONES = [
    { label: 'グリーン〜レギュラー',       min: 0,  max: 15,             color: '#00ff88', trackColor: 'rgba(0,255,136,0.10)',   step: 5  },
    { label: 'ブロンズ〜トップクローザー', min: 15, max: 30,             color: '#00cfff', trackColor: 'rgba(0,207,255,0.10)',   step: 5  },
    { label: 'レジェンド〜ゼウス',         min: 30, max: isMobile ? 80 : 100, color: '#ff2d7a', trackColor: 'rgba(255,45,122,0.10)',  step: 10 },
  ];

  const currentIdx = getCurrentTier(total, selfClose);
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1] ?? null;

  return (
    <div className="chart-card" style={{ marginBottom: 12, minHeight: 'auto' }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: 'var(--text-sub)', marginRight: 6 }}>現在クラス</span>
        <span style={{ fontSize: 18, fontWeight: 'bold', color: tierColor(currentIdx) }}>{current.name}</span>
      </div>

      {/* 3本ゾーンバー（次ランク条件をそのバーの直下に表示） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 16 }}>
        {ZONES.map((zone) => {
          const pct = zoneProgress(total, zone.min, zone.max);
          const range = zone.max - zone.min;

          const allTicks: number[] = [];
          for (let pt = zone.min; pt <= zone.max; pt += zone.step) {
            allTicks.push(pt);
          }
          const tickPct = (pt: number) => ((pt - zone.min) / range) * 100;

          const RANK_H = 14;
          const BAR_H = 8;
          const GAP = 5;
          const TOTAL_H = RANK_H + BAR_H + GAP + 24 + 14;

          // このゾーンに次のランクが含まれるか
          const nextInZone = next && next.pt > zone.min && next.pt <= zone.max;

          return (
            <div key={zone.label}>
              <div style={{ position: 'relative', height: TOTAL_H }}>
                {/* ランク名（バー上段） */}
                {allTicks.map((pt) => {
                  const tierName = TIERS.find(t => t.pt === pt)?.name ?? null;
                  if (!tierName) return null;
                  const pct = tickPct(pt);
                  const xAlign = pct <= 2 ? 'translateX(0)' : pct >= 98 ? 'translateX(-100%)' : 'translateX(-50%)';
                  const tickColor = zone.color;
                  return (
                    <span key={`name-${pt}`} style={{
                      position: 'absolute',
                      top: 0,
                      left: `${pct}%`,
                      transform: xAlign,
                      fontSize: 9,
                      color: total >= pt ? tickColor : 'rgba(255,255,255,0.22)',
                      fontWeight: total >= pt ? 600 : 400,
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                      pointerEvents: 'none',
                    }}>
                      {tierName}
                    </span>
                  );
                })}

                {/* バー本体 */}
                <div style={{ position: 'absolute', top: RANK_H, left: 0, right: 0,
                  background: zone.trackColor, borderRadius: 6, height: BAR_H, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: `linear-gradient(90deg, ${zone.color}bb, ${zone.color})`,
                    borderRadius: 6,
                    transition: 'width 0.6s ease',
                    opacity: pct === 0 ? 0.3 : 1,
                    boxShadow: pct > 0 ? `0 0 8px ${zone.color}99` : 'none',
                  }} />
                </div>

                {/* 目盛り線＋pt数字（バー下段） */}
                {allTicks.map((pt) => {
                  const pct = tickPct(pt);
                  const xAlign = pct <= 2 ? 'translateX(0)' : pct >= 98 ? 'translateX(-100%)' : 'translateX(-50%)';
                  return (
                    <div key={`tick-${pt}`} style={{
                      position: 'absolute',
                      top: RANK_H + BAR_H,
                      left: `${pct}%`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: pct <= 2 ? 'flex-start' : pct >= 98 ? 'flex-end' : 'center',
                      transform: xAlign,
                      pointerEvents: 'none',
                    }}>
                      <div style={{ width: 1, height: GAP, background: 'rgba(255,255,255,0.18)' }} />
                      <span className="incentive-tick-num" style={{ fontSize: 20, lineHeight: 1, whiteSpace: 'nowrap', color: total >= pt ? zone.color : 'rgba(255,255,255,0.4)', fontWeight: total >= pt ? 700 : 400 }}>
                        {pt}
                      </span>
                      {(() => {
                        const tier = TIERS.find(t => t.pt === pt);
                        if (!tier) return null;
                        return (
                          <span style={{
                            fontSize: 9,
                            whiteSpace: 'nowrap',
                            marginTop: 2,
                            fontWeight: total >= pt ? 600 : 400,
                            ...(total >= pt ? {
                              background: 'linear-gradient(180deg, #ffe566 0%, #c8950a 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                            } : {
                              color: 'rgba(255,255,255,0.25)',
                            }),
                          }}>
                            ¥{tier.incentive.toLocaleString()}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* 次のランク条件（このゾーンに次ランクがある場合） */}
              {nextInZone && next && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: zone.color }}>{next.name}</span>
                  <span style={{ color: 'var(--text-sub)' }}> まであと </span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    {Math.ceil((next.pt - total) * 10) / 10}pt
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ゼウス達成時 */}
      {!next && (
        <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 700, fontSize: 14 }}>
          ゼウス達成！
        </div>
      )}
    </div>
  );
}
