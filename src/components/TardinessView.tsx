'use client';

export default function TardinessView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="chart-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          gap: 12,
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 36 }}>🕐</span>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>
          遅刻 / 早退
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
          データ準備中です
        </div>
      </div>
    </div>
  );
}
