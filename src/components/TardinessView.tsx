'use client';

import { useState, useEffect } from 'react';

type KintaiKind = '当欠' | '遅刻' | '早退' | 'その他';

interface KintaiRecord {
  date: string;
  kind: KintaiKind;
  staff: string;
  site: string;
  reason: string;
  workTime: string;
  breakTime: string;
  reporter: string;
  receivedAt: string;
  raw: string;
}

// 区分ごとの色。当欠が一番目立つようにする
const KIND_COLORS: Record<KintaiKind, { bg: string; text: string; border: string }> = {
  '当欠':   { bg: 'rgba(248,113,113,0.18)', text: '#f87171', border: 'rgba(248,113,113,0.4)' },
  '遅刻':   { bg: 'rgba(251,146,60,0.18)',  text: '#fb923c', border: 'rgba(251,146,60,0.4)' },
  '早退':   { bg: 'rgba(96,165,250,0.18)',  text: '#60a5fa', border: 'rgba(96,165,250,0.4)' },
  'その他': { bg: 'rgba(255,255,255,0.08)', text: 'var(--text-sub)', border: 'rgba(255,255,255,0.15)' },
};

function KindBadge({ kind }: { kind: KintaiKind }) {
  const c = KIND_COLORS[kind];
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{kind}</span>
  );
}

// 'YYYY-MM-DD' → '8/27（木）'。日付が読めなかった投稿は受信日時を出す
function formatDate(rec: KintaiRecord): string {
  if (!rec.date) return rec.receivedAt.split(' ')[0] || '不明';
  const [, m, d] = rec.date.split('-');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(rec.date).getDay()];
  return `${parseInt(m)}/${parseInt(d)}（${wd}）`;
}

interface StaffSummary {
  name: string;
  counts: Record<KintaiKind, number>;
  total: number;
}

// 同じ人が「馬塲」「馬塲 光優」のように姓だけ／フルネームで書かれることがあるため、
// 空白を除いて前方一致するものは同一人物としてまとめる（既存APIの照合と同じ考え方）。
// 表示名は長いほう（フルネーム）を採用する
function summarizeByStaff(records: KintaiRecord[]): StaffSummary[] {
  const groups: { keys: string[]; name: string; counts: Record<KintaiKind, number>; total: number }[] = [];
  const norm = (n: string) => n.replace(/[\s　]/g, '');

  for (const rec of records) {
    const name = rec.staff.trim() || '（記載なし）';
    const key = norm(name);
    let g = groups.find((x) => x.keys.some((k) => k === key || k.startsWith(key) || key.startsWith(k)));
    if (!g) {
      g = { keys: [], name, counts: { 当欠: 0, 遅刻: 0, 早退: 0, その他: 0 }, total: 0 };
      groups.push(g);
    }
    if (!g.keys.includes(key)) g.keys.push(key);
    if (name.length > g.name.length) g.name = name;
    g.counts[rec.kind] += 1;
    g.total += 1;
  }

  // 回数が多い順。同数なら当欠の多い人を上にする
  return groups
    .map(({ name, counts, total }) => ({ name, counts, total }))
    .sort((a, b) => b.total - a.total || b.counts['当欠'] - a.counts['当欠'] || a.name.localeCompare(b.name));
}

// 何回から「多い」とみなすか。3回以上で赤、2回で橙
const ALERT_TOTAL = 3;
const WARN_TOTAL = 2;

function StaffCard({ summary, selected, onClick }: {
  summary: StaffSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const level = summary.total >= ALERT_TOTAL ? 'alert' : summary.total >= WARN_TOTAL ? 'warn' : 'normal';
  const border = level === 'alert' ? 'rgba(248,113,113,0.55)'
    : level === 'warn' ? 'rgba(251,146,60,0.45)'
    : 'var(--border-color)';
  const totalColor = level === 'alert' ? '#f87171' : level === 'warn' ? '#fb923c' : 'var(--text-main)';

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer',
        background: selected ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'rgba(255,255,255,0.5)' : border}`,
        borderRadius: 10, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{summary.name}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: totalColor, whiteSpace: 'nowrap' }}>
          {summary.total}<span style={{ fontSize: 11, fontWeight: 500, marginLeft: 1 }}>回</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(['当欠', '遅刻', '早退', 'その他'] as KintaiKind[]).map((k) =>
          summary.counts[k] ? (
            <span key={k} style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, whiteSpace: 'nowrap',
              background: KIND_COLORS[k].bg, color: KIND_COLORS[k].text,
              border: `1px solid ${KIND_COLORS[k].border}`,
            }}>{k} {summary.counts[k]}</span>
          ) : null
        )}
      </div>
    </button>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="chart-card" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, textAlign: 'center',
    }}>
      <span style={{ fontSize: 36 }}>🕐</span>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>遅刻 / 早退</div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>{message}</div>
    </div>
  );
}

export default function TardinessView({ selectedMonth }: { selectedMonth: string }) {
  const [records, setRecords] = useState<KintaiRecord[] | null>(null);
  const [error, setError] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  useEffect(() => {
    setRecords(null);
    setError('');
    setOpenIdx(null);
    setSelectedStaff(null);
    fetch(`/api/kintai?month=${selectedMonth}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? '取得に失敗しました');
        return d;
      })
      .then((d) => setRecords(Array.isArray(d.records) ? d.records : []))
      .catch((e) => setError(e instanceof Error ? e.message : '取得に失敗しました'));
  }, [selectedMonth]);

  if (error) return <EmptyCard message={error} />;
  if (records === null) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-sub)' }}>読み込み中...</div>;
  }
  if (records.length === 0) return <EmptyCard message="この月の勤怠報告はありません" />;

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});

  const summaries = summarizeByStaff(records);
  // カードで選んだスタッフだけに明細を絞る
  const shown = selectedStaff
    ? records.filter((r) => (r.staff.trim() || '（記載なし）') === selectedStaff
        || selectedStaff.startsWith(r.staff.trim())
        || r.staff.trim().startsWith(selectedStaff))
    : records;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="chart-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{records.length}件</span>
          {(['当欠', '遅刻', '早退', 'その他'] as KintaiKind[]).map((k) =>
            counts[k] ? (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <KindBadge kind={k} />
                <span style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 600 }}>{counts[k]}</span>
              </span>
            ) : null
          )}
        </div>

        {/* スタッフ別。回数が多い人ほど枠が目立つ。押すと下の明細がその人だけになる */}
        <div style={{
          display: 'grid', gap: 8, marginBottom: 14,
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        }}>
          {summaries.map((sum) => (
            <StaffCard
              key={sum.name}
              summary={sum}
              selected={selectedStaff === sum.name}
              onClick={() => {
                setSelectedStaff(selectedStaff === sum.name ? null : sum.name);
                setOpenIdx(null);
              }}
            />
          ))}
        </div>

        {selectedStaff && (
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => { setSelectedStaff(null); setOpenIdx(null); }}
              style={{
                fontSize: 11, color: 'var(--text-sub)', cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                borderRadius: 6, padding: '4px 10px',
              }}
            >{selectedStaff} で絞り込み中 — 解除</button>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['日付', 'スタッフ', '区分', '現場', '理由'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 6px', whiteSpace: 'nowrap',
                    color: 'var(--text-sub)', fontSize: 10, fontWeight: 500,
                    letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((rec, i) => (
                <FragmentRow
                  key={`${rec.receivedAt}-${i}`}
                  rec={rec}
                  open={openIdx === i}
                  onToggle={() => setOpenIdx(openIdx === i ? null : i)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ rec, open, onToggle }: { rec: KintaiRecord; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={cellStyle}>{formatDate(rec)}</td>
        <td style={{ ...cellStyle, fontWeight: 600 }}>{rec.staff || '—'}</td>
        <td style={cellStyle}><KindBadge kind={rec.kind} /></td>
        <td style={cellStyle}>{rec.site || '—'}</td>
        <td style={{ ...cellStyle, color: 'var(--text-sub)', whiteSpace: 'normal' }}>{rec.reason || '—'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ padding: '4px 6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px',
              fontSize: 12, lineHeight: 1.7, color: 'var(--text-main)', whiteSpace: 'pre-wrap',
            }}>
              <div style={{ color: 'var(--text-sub)', marginBottom: 6, fontSize: 11 }}>
                報告者: {rec.reporter || '不明'}　/　受信: {rec.receivedAt || '—'}
                {rec.workTime ? `　/　勤務時間: ${rec.workTime}` : ''}
                {rec.breakTime ? `　/　休憩: ${rec.breakTime}` : ''}
              </div>
              {rec.raw}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '9px 6px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  whiteSpace: 'nowrap',
  color: 'var(--text-main)',
};
