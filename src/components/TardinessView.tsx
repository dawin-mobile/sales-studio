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

  useEffect(() => {
    setRecords(null);
    setError('');
    setOpenIdx(null);
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
              {records.map((rec, i) => (
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
