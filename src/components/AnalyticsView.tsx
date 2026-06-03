'use client';

import { useState } from 'react';
import { DashboardData } from '@/types';
import AttendanceTable from './AttendanceTable';
import AnalysisView from './AnalysisView';
import YearlyView from './YearlyView';

interface AnalyticsViewProps {
  data: DashboardData;
  selectedMonth: string;
  loginName?: string;
  userRole?: string;
  onNoData?: () => void;
}

type InnerTab = 'attendance' | 'yearly' | 'analysis';

export default function AnalyticsView({ data, selectedMonth, loginName, userRole, onNoData }: AnalyticsViewProps) {
  const [innerTab, setInnerTab] = useState<InnerTab>('attendance');

  return (
    <div>
      {/* 内部タブ */}
      <div className="shift-controls" style={{ marginBottom: 16 }}>
        <div className="shift-region-toggle">
          <button
            className={`shift-region-btn${innerTab === 'attendance' ? ' active' : ''}`}
            onClick={() => setInnerTab('attendance')}
          >
            個人実績
          </button>
          <button
            className={`shift-region-btn${innerTab === 'yearly' ? ' active' : ''}`}
            onClick={() => setInnerTab('yearly')}
          >
            過去1年
          </button>
          <button
            className={`shift-region-btn${innerTab === 'analysis' ? ' active' : ''}`}
            onClick={() => setInnerTab('analysis')}
          >
            分析・比較
          </button>
        </div>
      </div>

      {innerTab === 'attendance' && (
        <AttendanceTable
          data={data}
          selectedMonth={selectedMonth}
          loginName={loginName}
          userRole={userRole}
          onNoData={onNoData}
        />
      )}
      {innerTab === 'yearly' && (
        <YearlyView
          data={data}
          loginName={loginName}
          userRole={userRole}
          selectedMonth={selectedMonth}
        />
      )}
      {innerTab === 'analysis' && (
        <AnalysisView data={data} />
      )}
    </div>
  );
}
