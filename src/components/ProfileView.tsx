'use client';

import { useEffect, useState } from 'react';
import { readable } from '@/lib/colors';


interface ProfileData {
  prefectures: Record<string, number>;
  regions: Record<string, number>;
  bloodTypes: Record<string, number>;
  total: number;
  roleCounts: Record<string, number>;
  animalTypes: Record<string, number>;
  ageBrackets: Record<string, number>;
  genders: { male: number; female: number };
  genderStaff: { male: string[]; female: string[] };
  bloodStaff: Record<string, string[]>;
  animalStaff: Record<string, string[]>;
  ageBracketStaff: Record<string, string[]>;
  regionStaff: Record<string, string[]>;
  roleStaff: Record<string, string[]>;
  genderMap: Record<string, 'male' | 'female'>;
  prefectureStaff: Record<string, string[]>;
}


const BLOOD_TYPE_COLORS: Record<string, string> = {
  'A型':  '#f9a8d4', // ピンク
  'B型':  '#7dd3fc', // 水色
  'O型':  '#fbbf24', // イエロー
  'AB型': '#a3e635', // 黄緑
};

// 地方→都道府県リスト
const REGION_TO_PREFECTURES: Record<string, string[]> = {
  '北海道':     ['北海道'],
  '東北':       ['青森','岩手','宮城','秋田','山形','福島'],
  '関東':       ['茨城','栃木','群馬','埼玉','千葉','東京','神奈川'],
  '中部':       ['新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知'],
  '関西':       ['三重','滋賀','京都','大阪','兵庫','奈良','和歌山'],
  '中国':       ['鳥取','島根','岡山','広島','山口'],
  '四国':       ['徳島','香川','愛媛','高知'],
  '九州・沖縄': ['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'],
};

// ブロックの端から約2mm外側にラベル配置
// push: モバイル時にラベルをさらに外側へ動かす方向
const OVERLAY_POS: Record<string, { top: string; left: string; push: 'up' | 'down' | 'left' | 'right'; mobileTop?: string; mobileLeft?: string }> = {
  '海外':       { top: '20%', left: '19%', push: 'left'  },
  '北海道':     { top: '19%', left: '57%', push: 'up'    },
  '東北':       { top: '49%', left: '83%', push: 'right', mobileTop: '44%' },
  '関東':       { top: '65%', left: '82%', push: 'right', mobileTop: '70%' },
  '中部':       { top: '79%', left: '55%', push: 'down'  },
  '関西':       { top: '50%', left: '45%', push: 'up'    },
  '中国':       { top: '50%', left: '35%', push: 'up',    mobileLeft: '30%' },
  '四国':       { top: '76%', left: '30%', push: 'down'  },
  '九州・沖縄': { top: '50%', left: '12%', push: 'left'  },
};

// push方向に応じた translate オフセット（モバイル時に追加で外側へ）
const PUSH_TRANSFORM: Record<string, string> = {
  up:    'translate(-50%, -70%)',
  down:  'translate(-50%, -30%)',
  left:  'translate(-65%, -50%)',
  right: 'translate(-35%, -50%)',
};

function BloodTypeDonut({ bloodTypes, staffMap, onSelect }: { bloodTypes: Record<string, number>; staffMap?: Record<string, string[]>; onSelect?: (title: string, names: string[]) => void }) {
  const total = Object.values(bloodTypes).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const cx = 210, cy = 195;
  const outerR = 130, innerR = 72;

  const ORDER = ['A型', 'B型', 'O型', 'AB型'];
  const entries = ORDER
    .filter(t => (bloodTypes[t] || 0) > 0)
    .map(t => ({ type: t, count: bloodTypes[t], pct: Math.round(bloodTypes[t] / total * 100) }));

  let angle = -Math.PI / 2;
  const segments = entries.map(e => {
    const span = (e.count / total) * 2 * Math.PI;
    const start = angle;
    angle += span;
    return { ...e, start, end: angle, mid: start + span / 2 };
  });

  const pt = (a: number, r: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });

  const arc = (s: number, e: number) => {
    const o0 = pt(s, outerR), o1 = pt(e, outerR);
    const i0 = pt(s, innerR), i1 = pt(e, innerR);
    const lg = e - s > Math.PI ? 1 : 0;
    return `M${o0.x} ${o0.y} A${outerR} ${outerR} 0 ${lg} 1 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A${innerR} ${innerR} 0 ${lg} 0 ${i0.x} ${i0.y}Z`;
  };

  return (
    <svg viewBox="0 0 420 390" style={{ width: '100%', height: 'auto' }}>
      {segments.map(({ type, count, pct, start, end, mid }) => {
        const color = BLOOD_TYPE_COLORS[type] || '#888';
        const inside = pt(mid, (outerR + innerR) / 2);
        const lineStart = pt(mid, outerR + 6);
        const lineEnd = pt(mid, outerR + 28);
        const label = pt(mid, outerR + 34);
        const right = Math.cos(mid) >= 0;
        const anchor = right ? 'start' : 'end';

        return (
          <g key={type} style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect && staffMap?.[type] && onSelect(type, staffMap[type])}>
            <path d={arc(start, end)} fill={color} />
            {/* セグメント内: 人数 */}
            <text x={inside.x} y={inside.y} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="15" fontWeight="bold">
              {count}名
            </text>
            {/* リーダーライン */}
            <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y}
              stroke={color} strokeWidth="1.5" />
            {/* 外側ラベル: 血液型名 */}
            <text x={label.x} y={label.y - 8} textAnchor={anchor} dominantBaseline="middle"
              fill="var(--text-sub)" fontSize="12" fontWeight="600">
              {type}
            </text>
            {/* 外側ラベル: % */}
            <text x={label.x} y={label.y + 9} textAnchor={anchor} dominantBaseline="middle"
              fill={readable(color)} fontSize="14" fontWeight="800">
              {pct}%
            </text>
          </g>
        );
      })}
      {/* 中央: 総勢 */}
      <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-sub)" fontSize="15">総勢</text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-main)" fontSize="26" fontWeight="bold">{total}名</text>
    </svg>
  );
}

function nameBadgeStyle(name: string, genderMap?: Record<string, 'male' | 'female'>) {
  const g = genderMap?.[name];
  if (g === 'male')   return { background: 'rgba(125,211,252,0.18)', color: readable('#7dd3fc') };
  if (g === 'female') return { background: 'rgba(249,168,212,0.18)', color: readable('#f9a8d4') };
  return { background: 'rgba(var(--ov), 0.07)', color: 'var(--text-main)' as string };
}

// BottomSheet（男女比率・年齢層・動物占い・血液型）
function BottomSheet({ title, names, genderMap, onClose }: { title: string; names: string[]; genderMap?: Record<string, 'male' | 'female'>; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 1000, animation: 'fadeIn 0.2s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--card-bg, #1a1a2e)',
        borderRadius: '16px 16px 0 0',
        zIndex: 1001,
        maxHeight: '60vh',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s ease',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--ov), 0.2)' }} />
        </div>
        <div style={{ padding: '8px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{title}</span>
          <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{names.length}名</span>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 20px 32px', flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {names.map((name, i) => (
              <span key={i} style={{ borderRadius: 20, padding: '5px 12px', fontSize: 13, ...nameBadgeStyle(name, genderMap) }}>{name}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// StaffModal（出身地用・都道府県グループ対応）
function StaffModal({ title, names, genderMap, grouped, onClose }: {
  title: string;
  names: string[];
  genderMap?: Record<string, 'male' | 'female'>;
  grouped?: { pref: string; names: string[] }[];
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, animation: 'fadeIn 0.2s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16, padding: '20px',
          minWidth: 260, maxWidth: '85vw', width: 340,
          maxHeight: '75vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{title}</span>
            <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{names.length}名</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {grouped ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {grouped.map(({ pref, names: pNames }) => (
                  <div key={pref}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 6, letterSpacing: '0.05em' }}>
                      {pref} <span style={{ fontWeight: 400 }}>{pNames.length}名</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pNames.map((name, i) => (
                        <span key={i} style={{ borderRadius: 20, padding: '4px 10px', fontSize: 13, ...nameBadgeStyle(name, genderMap) }}>{name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {names.map((name, i) => (
                  <span key={i} style={{ borderRadius: 20, padding: '5px 12px', fontSize: 13, ...nameBadgeStyle(name, genderMap) }}>{name}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            marginTop: 16, padding: '8px', borderRadius: 8,
            background: 'rgba(var(--ov), 0.08)', border: 'none',
            color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', width: '100%',
          }}>閉じる</button>
        </div>
      </div>
    </>
  );
}

// 動物占い：動物名に含まれるキーワードで色を決定
const ANIMAL_KEYWORD_COLORS: [string, string][] = [
  ['狼',       '#7dd3fc'], // 狼→スチールブルー
  ['オオカミ', '#7dd3fc'],
  ['ひつじ',   '#f9a8d4'], // 羊→ソフトピンク
  ['こじか',   '#fcd34d'], // 子鹿→アンバーイエロー
  ['ゾウ',     '#a5b4fc'], // 象→ラベンダーグレー
  ['子守熊',   '#86efac'], // コアラ/子守熊→ミントグリーン
  ['コアラ',   '#86efac'],
  ['猿',       '#fb923c'], // 猿→テラコッタオレンジ
  ['サル',     '#fb923c'],
  ['虎',       '#f97316'], // 虎→オレンジ
  ['トラ',     '#f97316'],
  ['ライオン', '#fbbf24'], // ライオン→ゴールデン
  ['ペガサス', '#c4b5fd'], // ペガサス→ライラック
  ['クロヒョウ','#818cf8'], // 黒豹→ディープパープル
  ['チータ',   '#fde68a'], // チーター→ゴールドイエロー
  ['たぬき',   '#d6b899'], // たぬき→アースブラウン
  ['タヌキ',   '#d6b899'],
];

function getAnimalColor(name: string, fallbackIndex: number): string {
  for (const [kw, color] of ANIMAL_KEYWORD_COLORS) {
    if (name.includes(kw)) return color;
  }
  const FALLBACK = ['#60a5fa','#34d399','#f472b6','#2dd4bf','#818cf8','#e879f9'];
  return FALLBACK[fallbackIndex % FALLBACK.length];
}

function AnimalChart({ animalTypes, staffMap, onSelect }: { animalTypes: Record<string, number>; staffMap?: Record<string, string[]>; onSelect?: (title: string, names: string[]) => void }) {
  const total = Object.values(animalTypes).reduce((a, b) => a + b, 0);
  if (total === 0) return <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>データなし</div>;

  const entries = Object.entries(animalTypes).sort((a, b) => b[1] - a[1]);
  const max = entries[0][1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(([animal, count], i) => {
        const pct = Math.round((count / total) * 100);
        const barPct = (count / max) * 100;
        const color = getAnimalColor(animal, i);
        return (
          <div key={animal} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect && staffMap?.[animal] && onSelect(animal, staffMap[animal])}>
            <div style={{ width: 72, fontSize: 12, color: 'var(--text-main)', textAlign: 'right', flexShrink: 0 }}>
              {animal}
            </div>
            <div style={{ flex: 1, background: 'rgba(var(--ov), 0.06)', borderRadius: 4, height: 20, overflow: 'hidden' }}>
              <div style={{
                width: `${barPct}%`, height: '100%',
                background: color, borderRadius: 4,
                transition: 'width 0.6s ease',
                opacity: 0.85,
              }} />
            </div>
            <div style={{ width: 52, fontSize: 12, color, fontWeight: 700, flexShrink: 0 }}>
              {count}名 <span style={{ color: 'var(--text-sub)', fontWeight: 400 }}>{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GenderBar({ genders, staffMap, onSelect }: { genders: { male: number; female: number }; staffMap?: { male: string[]; female: string[] }; onSelect?: (title: string, names: string[]) => void }) {
  const { male, female } = genders;
  const total = male + female;
  if (total === 0) return <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>データなし</div>;

  const malePct = Math.round((male / total) * 100);
  const femalePct = 100 - malePct;

  return (
    <div>
      {/* 数値表示 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ textAlign: 'center', cursor: onSelect ? 'pointer' : 'default' }}
          onClick={() => onSelect && staffMap && onSelect('男性', staffMap.male)}>
          <div style={{ fontSize: 28, fontWeight: 800, color: readable('#60a5fa'), lineHeight: 1 }}>{malePct}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3 }}>男性 {male}名</div>
        </div>
        <div style={{ textAlign: 'center', cursor: onSelect ? 'pointer' : 'default' }}
          onClick={() => onSelect && staffMap && onSelect('女性', staffMap.female)}>
          <div style={{ fontSize: 28, fontWeight: 800, color: readable('#f472b6'), lineHeight: 1 }}>{femalePct}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3 }}>女性 {female}名</div>
        </div>
      </div>
      {/* スプリットバー */}
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28 }}>
        <div style={{
          width: `${malePct}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', transition: 'width 0.6s ease',
          cursor: onSelect ? 'pointer' : 'default',
        }} onClick={() => onSelect && staffMap && onSelect('男性', staffMap.male)}>
          {malePct > 15 ? '男' : ''}
        </div>
        <div style={{
          flex: 1, background: 'linear-gradient(90deg, #ec4899, #f472b6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
          cursor: onSelect ? 'pointer' : 'default',
        }} onClick={() => onSelect && staffMap && onSelect('女性', staffMap.female)}>
          {femalePct > 15 ? '女' : ''}
        </div>
      </div>
    </div>
  );
}

const AGE_COLORS = ['#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#facc15', '#2dd4bf'];

function AgePieChart({ ageBrackets, staffMap, onSelect }: { ageBrackets: Record<string, number>; staffMap?: Record<string, string[]>; onSelect?: (title: string, names: string[]) => void }) {
  const entries = Object.entries(ageBrackets).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  if (entries.length === 0) return <div style={{ color: 'var(--text-sub)', fontSize: 13 }}>データなし</div>;

  const total = entries.reduce((s, [, c]) => s + c, 0);
  const cx = 210, cy = 195, outerR = 130, innerR = 72;

  let angle = -Math.PI / 2;
  const segments = entries.map(([bracket, count], i) => {
    const span = (count / total) * 2 * Math.PI;
    const start = angle;
    angle += span;
    return { bracket, count, start, end: angle, mid: start + span / 2, color: AGE_COLORS[i % AGE_COLORS.length] };
  });

  const pt = (a: number, r: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const arc = (s: number, e: number) => {
    const o0 = pt(s, outerR), o1 = pt(e, outerR);
    const i0 = pt(s, innerR), i1 = pt(e, innerR);
    const lg = e - s > Math.PI ? 1 : 0;
    return `M${o0.x} ${o0.y} A${outerR} ${outerR} 0 ${lg} 1 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A${innerR} ${innerR} 0 ${lg} 0 ${i0.x} ${i0.y}Z`;
  };

  return (
    <svg viewBox="0 0 420 390" style={{ width: '100%', height: 'auto' }}>
      {segments.map(({ bracket, count, start, end, mid, color }) => {
        const inside = pt(mid, (outerR + innerR) / 2);
        const lineStart = pt(mid, outerR + 6);
        const lineEnd = pt(mid, outerR + 28);
        const label = pt(mid, outerR + 34);
        const anchor = Math.cos(mid) >= 0 ? 'start' : 'end';
        const pct = Math.round((count / total) * 100);
        return (
          <g key={bracket} style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect && staffMap?.[bracket] && onSelect(`${bracket}歳`, staffMap[bracket])}>
            <path d={arc(start, end)} fill={color} />
            <text x={inside.x} y={inside.y} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="15" fontWeight="bold">{count}名</text>
            <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y}
              stroke={color} strokeWidth="1.5" />
            <text x={label.x} y={label.y - 8} textAnchor={anchor} dominantBaseline="middle"
              fill="var(--text-sub)" fontSize="12" fontWeight="600">{bracket}</text>
            <text x={label.x} y={label.y + 9} textAnchor={anchor} dominantBaseline="middle"
              fill={readable(color)} fontSize="14" fontWeight="800">{pct}%</text>
          </g>
        );
      })}
      <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-sub)" fontSize="15">総勢</text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-main)" fontSize="26" fontWeight="bold">{total}名</text>
    </svg>
  );
}

function JapanRegionMap({ regions, staffMap, onSelect }: { regions: Record<string, number>; staffMap?: Record<string, string[]>; onSelect?: (title: string, names: string[]) => void }) {
  const total = Object.values(regions).reduce((a, b) => a + b, 0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (total === 0) return null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/japan-map.png" alt="日本地図" style={{ width: '100%', display: 'block', borderRadius: 8 }} />
      {Object.entries(regions)
        .filter(([, count]) => count > 0)
        .map(([region, count]) => {
          const pos = OVERLAY_POS[region];
          if (!pos) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <div
              key={region}
              onClick={() => onSelect && staffMap?.[region] && onSelect(region, staffMap[region])}
              style={{
                position: 'absolute',
                top: isMobile && pos.mobileTop ? pos.mobileTop : pos.top,
                left: isMobile && pos.mobileLeft ? pos.mobileLeft : pos.left,
                transform: isMobile ? PUSH_TRANSFORM[pos.push] : 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: onSelect ? 'auto' : 'none',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                cursor: onSelect ? 'pointer' : 'default',
              }}
            >
              {/* 地方名 */}
              <div style={{
                fontSize: isMobile ? 'clamp(9px, 2.2vw, 15px)' : 'clamp(11px, 2.2vw, 15px)',
                fontWeight: '700',
                color: '#2a1a00',
                letterSpacing: '0.02em',
                marginBottom: 'clamp(2px, 0.8vw, 6px)',
              }}>
                {region}
              </div>
              {/* % */}
              <div style={{
                fontSize: isMobile ? 'clamp(26px, 5.5vw, 58px)' : 'clamp(28px, 5.5vw, 58px)',
                fontWeight: '900',
                color: '#e06e10',
                letterSpacing: '-1px',
                lineHeight: 1,
              }}>
                {pct}<span style={{ fontSize: '0.5em', fontWeight: '800', letterSpacing: 0 }}>%</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}

interface ProfileViewProps {
  effectiveRole?: string;
  effectiveName?: string;
}

const REGIONS = ['全国', '関東', '九州'] as const;
type Region = typeof REGIONS[number];

export default function ProfileView({ effectiveRole = '', effectiveName = '' }: ProfileViewProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ title: string; names: string[] } | null>(null);
  const [modal, setModal] = useState<{ title: string; names: string[]; grouped?: { pref: string; names: string[] }[] } | null>(null);
  const [region, setRegion] = useState<Region>('全国');
  const [isPC, setIsPC] = useState(false);
  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const openSheet = (title: string, names: string[]) => {
    if (isPC) setModal({ title, names });
    else setSheet({ title, names });
  };
  const openModal = (title: string, names: string[]) => {
    const prefList = REGION_TO_PREFECTURES[title];
    const prefStaff = data?.prefectureStaff;
    if (prefList && prefStaff) {
      const grouped = prefList
        .map(pref => ({ pref, names: prefStaff[pref] ?? [] }))
        .filter(g => g.names.length > 0);
      setModal({ title, names, grouped });
    } else {
      setModal({ title, names });
    }
  };
  const gm = data?.genderMap;

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/profile?region=${encodeURIComponent(region)}`)
      .then((r) => {
        if (!r.ok) return r.json().then((e: { error?: string }) => { throw new Error(e.error || 'エラー'); });
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [region]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-soft)' }}>データを読み込んでいます...</div>;
  }
  if (error) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--accent-red)' }}>エラー: {error}</div>;
  }
  if (!data) return null;

  return (
    <div style={{ padding: '0 0 80px' }}>
      {sheet && <BottomSheet title={sheet.title} names={sheet.names} genderMap={gm} onClose={() => setSheet(null)} />}
      {modal && <StaffModal title={modal.title} names={modal.names} genderMap={gm} grouped={modal.grouped} onClose={() => setModal(null)} />}

      {/* 拠点トグル */}
      <div className="shift-controls" style={{ marginBottom: 16 }}>
        <div className="shift-region-toggle">
          {REGIONS.map((r) => (
            <button
              key={r}
              className={`shift-region-btn${region === r ? ' active' : ''}`}
              onClick={() => setRegion(r)}
            >{r}</button>
          ))}
        </div>
      </div>
      {/* 総勢 */}
      <div className="chart-card" style={{ marginBottom: 12, minHeight: 'unset' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 34, fontWeight: 'bold', color: 'var(--text-main)', lineHeight: 1, letterSpacing: '-1px' }}>{data.total}</span>
          <span style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500 }}>名</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['社員', '#3ea6ff'], ['アルバイト', '#facc15'], ['業務委託', '#a3a3a3']] as [string, string][]).map(([label, color]) => (
            <div key={label}
              onClick={() => { const names = data.roleStaff?.[label]; if (names?.length) openSheet(label, names); }}
              style={{
                flex: 1,
                // カードの色に区分の色を少し混ぜる（黒基調・白基調どちらでも背景になじむように）
                background: `color-mix(in srgb, ${color} 14%, var(--card-bg))`,
                border: `1px solid ${color}30`,
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                cursor: 'pointer',
              }}>
              <span style={{ fontSize: 11, color: readable(color), fontWeight: 600, letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 28, fontWeight: 'bold', color: readable(color), lineHeight: 1, letterSpacing: '-1px' }}>{data.roleCounts?.[label] ?? 0}</span>
                <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>名</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 男女比率 */}
      <div className="chart-card" style={{ marginBottom: 12, minHeight: 'unset' }}>
        <h3 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 14, color: 'var(--text-main)' }}>男女比率</h3>
        <GenderBar genders={data.genders} staffMap={data.genderStaff} onSelect={openSheet} />
      </div>

      {/* 年齢層 */}
      <div className="chart-card" style={{ marginBottom: 12, minHeight: 'unset' }}>
        <h3 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 14, color: 'var(--text-main)' }}>年齢層</h3>
        <AgePieChart ageBrackets={data.ageBrackets} staffMap={data.ageBracketStaff} onSelect={openSheet} />
      </div>

      {/* 出身地 — 日本地図スタイル（モーダル） */}
      <div className="chart-card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: 'var(--text-main)' }}>出身地</h3>
        <JapanRegionMap regions={data.regions} staffMap={data.regionStaff} onSelect={openModal} />
      </div>

      {/* 血液型 */}
      <div className="chart-card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: 'var(--text-main)' }}>血液型</h3>
        <BloodTypeDonut bloodTypes={data.bloodTypes} staffMap={data.bloodStaff} onSelect={openSheet} />
      </div>

      {/* 動物占い */}
      <div className="chart-card">
        <h3 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 14, color: 'var(--text-main)' }}>動物占い</h3>
        <AnimalChart animalTypes={data.animalTypes} staffMap={data.animalStaff} onSelect={openSheet} />
      </div>
    </div>
  );
}
