'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
} from 'chart.js';
import { useChartColors } from '@/lib/theme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

interface DualLineChartProps {
  name1: string;
  data1: number[];
  name2: string;
  data2: number[];
}

export default function DualLineChart({ name1, data1, name2, data2 }: DualLineChartProps) {
  const colors = useChartColors();
  const labels = data1.map((_, i) => `${i + 1}日`);

  return (
    <div className="chart-card" style={{ marginTop: 16 }}>
      <Line
        data={{
          labels,
          datasets: [
            { label: name1, data: data1, borderColor: '#3ea6ff', backgroundColor: 'transparent', tension: 0.3 },
            { label: name2, data: data2, borderColor: '#ff4e45', backgroundColor: 'transparent', tension: 0.3 },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: colors.legend } },
            datalabels: { display: false },
          },
          scales: {
            x: { grid: { color: colors.grid }, ticks: { color: colors.tick } },
            y: { grid: { color: colors.grid }, ticks: { color: colors.tick }, beginAtZero: true },
          },
        }}
      />
    </div>
  );
}
