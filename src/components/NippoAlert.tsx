'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { readable } from '@/lib/colors';

export default function NippoAlert() {
  const { data: session } = useSession();
  const [missingDates, setMissingDates] = useState<string[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/nippo-check')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.missingDates)) setMissingDates(data.missingDates);
      })
      .catch(() => {});
  }, [session]);

  if (missingDates.length === 0) return null;

  const dateLabels = missingDates
    .map((d) => {
      const parts = d.split('-');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    })
    .join('、');

  return (
    <div style={{
      background: 'color-mix(in srgb, #cc3333 12%, var(--card-bg))',
      border: '1px solid #cc3333',
      borderRadius: 8,
      padding: '10px 16px',
      marginBottom: 16,
      color: readable('#ff6666'),
      fontSize: 13,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      ⚠️ 日報未提出です（{dateLabels}）
    </div>
  );
}
