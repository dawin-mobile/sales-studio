'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip,
} from 'chart.js';
import { useChartColors } from '@/lib/theme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Legend, Tooltip);

interface TrendChartProps {
  title: string;
  dataArray: number[];
  label: string;
}

export default function TrendChart({ title, dataArray, label }: TrendChartProps) {
  const colors = useChartColors();
  const labels = dataArray.map((_, i) => `${i + 1}日`);

  return (
    <div className="chart-card" style={{ marginBottom: 16, height: 350 }}>
      <h3 style={{ fontSize: '14px', color: 'var(--text-soft)', marginBottom: 10 }}>{title}</h3>
      <div style={{ flex: 1, position: 'relative' }}>
        <Line
          data={{
            labels,
            datasets: [
              {
                label,
                data: dataArray,
                borderColor: '#3ea6ff',
                backgroundColor: 'rgba(62, 166, 255, 0.2)',
                tension: 0.3,
                fill: true,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              datalabels: { display: false },
            },
            scales: {
              x: { grid: { color: colors.grid }, ticks: { color: colors.tick } },
              y: { grid: { color: colors.grid }, ticks: { color: colors.tick }, beginAtZero: true },
            },
          }}
        />
      </div>
    </div>
  );
}
