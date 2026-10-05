'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, ExternalLink } from 'lucide-react';
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
  // 月を切り替えると読み込み中にこのコンポーネントごと消えるため、
  // 選んだ相手はページ側で覚えてもらう（渡されなければ自前で持つ）
  pickedStaff?: string;
  onStaffPick?: (name: string) => void;
}

type InnerTab = 'attendance' | 'yearly' | 'analysis';

export default function AnalyticsView({ data, selectedMonth, loginName, userRole, onNoData, pickedStaff: pickedStaffProp, onStaffPick: onStaffPickProp }: AnalyticsViewProps) {
  const [innerTab, setInnerTab] = useState<InnerTab>('attendance');
  // 「個人実績」のスタッフ選択で選ばれている人。育成アプリのリンク先に使う
  const [selectedStaff, setSelectedStaff] = useState(loginName ?? '');
  // 人が自分で選んだ相手。タブを切り替えると各タブは作り直されるため、
  // ここで覚えておいて初期値として渡さないと、ログインユーザーに戻ってしまう
  const [localPicked, setLocalPicked] = useState('');
  const pickedStaff = pickedStaffProp ?? localPicked;

  // どのタブで選んでも、覚えておく相手と育成アプリのリンク先をそろえる
  const handleStaffPick = (name: string) => {
    if (onStaffPickProp) onStaffPickProp(name);
    else setLocalPicked(name);
    setSelectedStaff(name);
  };

  // 育成アプリの査定シートに載っていない人にはボタンを出さない（押しても合言葉画面になるため）。
  // 社員以上は staffNames（登録済みの氏名一覧）が返るので、選択中の相手で判定する
  const [ikuseiAvailable, setIkuseiAvailable] = useState(false);
  const [ikuseiStaffNames, setIkuseiStaffNames] = useState<string[] | null>(null);

  useEffect(() => {
    fetch('/api/ikusei-sso/available')
      .then((r) => r.json())
      .then((d) => {
        setIkuseiAvailable(d.available === true);
        setIkuseiStaffNames(Array.isArray(d.staffNames) ? d.staffNames : null);
      })
      .catch(() => {});
  }, []);

  const ikuseiTarget = selectedStaff || loginName || '';
  const showIkuseiLink = ikuseiAvailable && (
    ikuseiStaffNames === null || ikuseiStaffNames.includes(ikuseiTarget.replace(/[\s　]/g, ''))
  );

  // 社員以上は選択中スタッフのページを開ける。権限判定はAPI側で行う
  const ikuseiHref = ikuseiTarget
    ? `/api/ikusei-sso?staff=${encodeURIComponent(ikuseiTarget)}`
    : '/api/ikusei-sso';

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

        {/* 育成アプリ（別アプリ）へのSSOリンク。押されたタイミングでサーバー側が署名URLを作る */}
        {showIkuseiLink && (
          <a
            className="ikusei-link-btn"
            href={ikuseiHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GraduationCap size={14} strokeWidth={1.75} />
            育成アプリ
            <ExternalLink size={12} strokeWidth={1.75} style={{ opacity: 0.6 }} />
          </a>
        )}
      </div>

      {innerTab === 'attendance' && (
        <AttendanceTable
          data={data}
          selectedMonth={selectedMonth}
          loginName={loginName}
          userRole={userRole}
          onNoData={onNoData}
          onStaffChange={setSelectedStaff}
          initialStaff={pickedStaff}
          onStaffPick={handleStaffPick}
        />
      )}
      {innerTab === 'yearly' && (
        <YearlyView
          data={data}
          loginName={loginName}
          userRole={userRole}
          selectedMonth={selectedMonth}
          initialStaff={pickedStaff}
          onStaffPick={handleStaffPick}
        />
      )}
      {innerTab === 'analysis' && (
        <AnalysisView data={data} initialStaff={pickedStaff} onStaffPick={handleStaffPick} />
      )}
    </div>
  );
}
