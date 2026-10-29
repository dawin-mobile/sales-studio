'use client';

import { useState, useRef, useEffect } from 'react';
import { Staff } from '@/types';
import { readable } from '@/lib/colors';

type SortKey = 'total' | 'selfClose' | 'mnp' | 'new' | 'change' | 'hikari' | 'tablet' | 'other';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'total',     label: '獲得合計' },
  { key: 'selfClose', label: '自己クロ' },
  { key: 'mnp',       label: 'MNP' },
  { key: 'new',       label: '新規' },
  { key: 'change',    label: '機変' },
  { key: 'hikari',    label: 'ひかり' },
  { key: 'tablet',    label: 'タブ' },
  { key: 'other',     label: '自銀・クレカ' },
];

interface RankingTableProps {
  ranking: Staff[];
}

export default function RankingTable({ ranking }: RankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const rankColRef = useRef<HTMLTableCellElement>(null);
  const [nameLeft, setNameLeft] = useState(44);

  useEffect(() => {
    if (rankColRef.current) {
      setNameLeft(rankColRef.current.getBoundingClientRect().width);
    }
  }, []);

  const sorted = [...ranking].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="chart-card" style={{ padding: '24px 24px 24px 0' }}>
      <div className="table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="full-ranking-table" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th ref={rankColRef}>順位</th>
              <th style={{ left: nameLeft }}>名前</th>
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => setSortKey(key)}
                  style={{
                    cursor: 'pointer',
                    color: sortKey === key ? readable('#ff4e45') : undefined,
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((staff, i) => (
              <tr key={staff.name}>
                <td style={{ textAlign: 'center', color: i < 3 ? readable('#facc15') : 'var(--text-sub)', fontWeight: i < 3 ? 700 : 400 }}>
                  {i + 1}
                </td>
                <td style={{ whiteSpace: 'nowrap', left: nameLeft }}>{staff.name.length > 12 ? staff.name.slice(0, 12) + '…' : staff.name}</td>
                <td style={{ color: readable('#3ea6ff'), fontWeight: 'bold' }}>{staff.total}</td>
                <td style={{ color: staff.selfClose > 0 ? readable('#f97316') : 'var(--text-sub)' }}>{staff.selfClose}</td>
                <td>{staff.mnp}</td>
                <td>{staff.new}</td>
                <td>{staff.change}</td>
                <td>{staff.hikari}</td>
                <td>{staff.tablet}</td>
                <td>{staff.other}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
