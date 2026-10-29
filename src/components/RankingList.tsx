'use client';

import { Staff } from '@/types';

interface RankingListProps {
  ranking: Staff[];
  limit?: number;
}

export default function RankingList({ ranking, limit = 5 }: RankingListProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {ranking.slice(0, limit).map((staff, i) => (
        <div key={staff.name} className="ranking-item">
          <div className="rank-num">{i + 1}</div>
          <div className="staff-info">
            <span className="staff-name">{staff.name}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-soft)' }}>
              MNP: {staff.mnp} / 新規: {staff.new}
            </span>
          </div>
          <div className="staff-score">{staff.total}</div>
        </div>
      ))}
    </div>
  );
}
