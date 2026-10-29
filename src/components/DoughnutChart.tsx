'use client';

import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useChartColors } from '@/lib/theme';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface DoughnutChartProps {
  dataMap: Record<string, number>;
  cutout?: string;
  showLegend?: boolean;
  className?: string;
  tooltipUnit?: string;
}

const colorMap: Record<string, string> = {
  '20代~30代': '#4285F4',
  '40代~60代': '#AB47BC',
  '60代~': '#FBBC04',
  '家族': '#4285F4',
  '2名': '#AB47BC',
  'シングル': '#FBBC04',
  'A型': '#4285F4',
  'B型': '#EA4335',
  'O型': '#34A853',
  'AB型': '#9c27b0',
};

const defaultColors = ['#888', '#666'];

export default function DoughnutChart({ dataMap, cutout = '70%', showLegend = false, className, tooltipUnit = '件' }: DoughnutChartProps) {
  const colors = useChartColors();
  if (!dataMap || Object.keys(dataMap).length === 0) return null;

  const entries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);
  const labels = entries.map((e) => e[0]);
  const data = entries.map((e) => e[1]);
  const bgColors = labels.map((label, i) => colorMap[label] || defaultColors[i % defaultColors.length]);

  return (
    <Doughnut
      className={className}
      data={{
        labels,
        datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: colors.sliceBorder }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout,
        plugins: {
          legend: {
            display: showLegend,
            position: 'right',
            labels: { color: colors.tick, font: { size: 12 }, boxWidth: 12 },
          },
          tooltip: {
            callbacks: { label: (c) => `${c.label}: ${c.raw}${tooltipUnit}` },
          },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold', size: 12 },
            formatter: (val: number) => (val > 0 ? val : ''),
          },
        },
      }}
    />
  );
}
