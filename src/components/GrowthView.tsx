'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { StaffEvaluation } from '@/types';
import { readable } from '@/lib/colors';

// ────────────────────────────────────────────
//  スキルカテゴリのグループ定義
// ────────────────────────────────────────────
const SCORE_GROUPS = [
  { label: '訴求',                  keys: ['キャッチ', '興味付け', '着座', '価格', '端末', 'CB'] },
  { label: 'クローズ（高齢者）',    keys: ['クローズ高齢_単発', 'クローズ高齢_複数'] },
  { label: 'クローズ（若年・中年）',keys: ['クローズ若年_単発', 'クローズ若年_複数'] },
  { label: 'クローズ特別',          keys: ['クローズ特別_付帯新規', 'クローズ特別_光'] },
  { label: 'メンバー',              keys: ['メンバー_2番手', 'メンバー_3番手'] },
];

const KEY_LABELS: Record<string, string> = {
  'クローズ高齢_単発':    '単発',
  'クローズ高齢_複数':    '複数',
  'クローズ若年_単発':    '単発',
  'クローズ若年_複数':    '複数',
  'クローズ特別_付帯新規':'付帯新規',
  'クローズ特別_光':      '光',
  'メンバー_2番手':       '2番手',
  'メンバー_3番手':       '3番手',
};

// ────────────────────────────────────────────
//  ヘルパー
// ────────────────────────────────────────────
function Stars({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span style={{ letterSpacing: 1, fontSize: 13 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ color: i < value ? readable('#facc15') : 'var(--text-muted)' }}>★</span>
      ))}
    </span>
  );
}

function levelToStars(label: string): number {
  if (label === '高') return 3;
  if (label === '中') return 2;
  if (label === '低') return 1;
  return 0;
}

function LevelBadge({ label }: { label: string }) {
  const color = label === '高' ? '#4ade80' : label === '中' ? '#facc15' : '#f87171';
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 7px',
      borderRadius: 10,
      background: color + '22',
      color: readable(color),
      border: `1px solid ${color}55`,
      fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

function AttributeBadge({ label }: { label: string }) {
  const isFreeter = label === 'フリーター';
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 7px',
      borderRadius: 10,
      background: isFreeter ? '#60a5fa22' : '#a78bfa22',
      color: readable(isFreeter ? readable('#60a5fa') : readable('#a78bfa')),
      border: `1px solid ${isFreeter ? '#60a5fa55' : '#a78bfa55'}`,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ────────────────────────────────────────────
//  知識グループ定義
// ────────────────────────────────────────────
const KNOWLEDGE_GROUPS: { label: string; color: string; match: (n: string) => boolean }[] = [
  { label: 'au,UQ',  color: '#60a5fa', match: (n) => n.startsWith('UQ') || n.startsWith('au') },
  { label: '固定',   color: '#a78bfa', match: (n) => n.includes('光') || n.startsWith('BIGLOBE') || n.startsWith('J.com') },
  { label: '新規',   color: '#34d399', match: (n) => ['エリア検索', '固定情報照会', '実質端末', '付帯新規'].some((k) => n.startsWith(k)) },
  { label: 'docomo', color: '#f87171', match: (n) => ['ギガライト', 'ギガホ', 'ahamo', 'eximo', 'irumo'].includes(n) },
  { label: 'SB',     color: '#fb923c', match: (n) => ['ミニフィット', 'メリハリ', 'LINEMO', 'YM'].some((k) => n.startsWith(k)) },
];

function groupKnowledgeItems(items: string[]): { label: string; color: string; items: string[] }[] {
  const groups = KNOWLEDGE_GROUPS.map((g) => ({ label: g.label, color: g.color, items: [] as string[] }));
  const other: string[] = [];
  for (const item of items) {
    const gi = KNOWLEDGE_GROUPS.findIndex((g) => g.match(item));
    if (gi >= 0) groups[gi].items.push(item);
    else other.push(item);
  }
  if (other.length > 0) groups.push({ label: 'その他', color: '#94a3b8', items: other });
  return groups.filter((g) => g.items.length > 0);
}

// ────────────────────────────────────────────
//  詳細パネル
// ────────────────────────────────────────────
function DetailPanel({ staff, onClose }: { staff: StaffEvaluation; onClose: () => void }) {
  const knowledgeCount = staff.knowledgeItems.filter((k) => staff.knowledge[k]).length;
  const knowledgeTotal = staff.knowledgeItems.length;
  const knowledgeGroups = groupKnowledgeItems(staff.knowledgeItems);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(KNOWLEDGE_GROUPS.map((g) => g.label).concat(['その他']))
  );
  const scorePercent = Math.round((staff.totalScore / 42) * 100);

  return (
    <div style={{
      width: 320,
      minWidth: 320,
      background: 'var(--card-bg)',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              background: '#3ea6ff22',
              color: readable('#3ea6ff'),
              border: '1px solid #3ea6ff55',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
            }}>
              {staff.rank}位
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
              {staff.staffName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <LevelBadge label={staff.potential} />
            <LevelBadge label={staff.attendance} />
            {staff.attribute && <AttributeBadge label={staff.attribute} />}
          </div>
          {/* スコアバー */}
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 4 }}>
            スキルスコア {staff.totalScore} / 42点
          </div>
          <div style={{ background: 'rgba(var(--ov), 0.12)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(90deg, #3ea6ff, #60d394)',
              width: `${scorePercent}%`,
              height: '100%',
              borderRadius: 4,
            }} />
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', padding: 4, flexShrink: 0 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* スキル評価 */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          スキル評価
        </div>
        {SCORE_GROUPS.map((group) => {
          const hasAny = group.keys.some((k) => staff.scores[k] !== undefined);
          if (!hasAny) return null;
          return (
            <div key={group.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>{group.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.keys.map((key) => {
                  const val = staff.scores[key];
                  if (val === undefined) return null;
                  const label = KEY_LABELS[key] ?? key;
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-main)' }}>{label}</span>
                      <Stars value={val} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 知識チェック */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          知識チェック
          <span style={{ marginLeft: 8, fontSize: 12, color: knowledgeCount === knowledgeTotal ? readable('#4ade80') : 'var(--text-sub)', fontWeight: 400, textTransform: 'none' }}>
            {knowledgeCount}/{knowledgeTotal}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {knowledgeGroups.map((group) => {
            const isCollapsed = collapsed.has(group.label);
            const groupOk = group.items.filter((i) => staff.knowledge[i]).length;
            const groupTotal = group.items.length;
            return (
              <div key={group.label} style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${group.color}33` }}>
                {/* グループヘッダー */}
                <button
                  onClick={() => {
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.label)) next.delete(group.label);
                      else next.add(group.label);
                      return next;
                    });
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: `${group.color}18`,
                    border: 'none',
                    cursor: 'pointer',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: readable(group.color), transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: readable(group.color) }}>{group.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: groupOk === groupTotal ? readable('#4ade80') : 'var(--text-sub)' }}>
                    {groupOk}/{groupTotal}
                  </span>
                </button>
                {/* アイテム一覧 */}
                {!isCollapsed && (
                  <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {group.items.map((item) => {
                      const ok = staff.knowledge[item];
                      return (
                        <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: ok ? 'var(--text-main)' : 'var(--text-sub)' }}>{item}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: ok ? readable('#4ade80') : readable('#f87171'), minWidth: 16, textAlign: 'right' }}>
                            {ok ? '○' : '×'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
//  メインコンポーネント
// ────────────────────────────────────────────
export default function GrowthView() {
  const [staff, setStaff] = useState<StaffEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffEvaluation | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    fetch('/api/growth', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setStaff(d) : setStaff([]))
      .catch(() => setStaff([]))
      .finally(() => { clearTimeout(timer); setLoading(false); });
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-soft)' }}>読み込み中...</div>;
  }

  if (staff.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-soft)' }}>データがありません。GASからsyncEvaluation()を実行してください。</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 130px)', overflow: 'hidden' }}>
      {/* テーブル */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--card-bg)', borderBottom: '2px solid var(--border-color)' }}>
              {['順位', '名前', '担当', 'スコア', 'ポテンシャル', '出勤', '属性', '知識'].map((h) => (
                <th key={h} style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: 11,
                  color: 'var(--text-sub)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  top: 0,
                  background: 'var(--card-bg)',
                  zIndex: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const isSelected = selected?.staffName === s.staffName;
              const knowledgeCount = s.knowledgeItems.filter((k) => s.knowledge[k]).length;
              return (
                <tr
                  key={s.staffName}
                  onClick={() => setSelected(isSelected ? null : s)}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(62,166,255,0.08)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(var(--ov), 0.04)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '10px 12px', color: readable('#3ea6ff'), fontWeight: 700 }}>{s.rank}位</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-main)' }}>{s.staffName}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-sub)' }}>{s.supervisor || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: readable('#3ea6ff'), fontWeight: 700 }}>{s.totalScore}</span>
                    <span style={{ color: 'var(--text-sub)', fontSize: 11 }}>/42</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.potential ? <LevelBadge label={s.potential} /> : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.attendance ? <LevelBadge label={s.attendance} /> : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.attribute ? <AttributeBadge label={s.attribute} /> : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: knowledgeCount === s.knowledgeItems.length && s.knowledgeItems.length > 0 ? readable('#4ade80') : 'var(--text-sub)' }}>
                      {knowledgeCount}/{s.knowledgeItems.length}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 詳細パネル */}
      {selected && (
        <DetailPanel staff={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
