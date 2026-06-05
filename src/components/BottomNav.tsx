'use client';

import { LayoutDashboard, BarChart2, PieChart, Calendar, Users, GraduationCap, Clock, UserCheck } from 'lucide-react';
import { TabName } from '@/types';

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  userRole?: string;
  secretMode?: boolean;
}

const ALL_NAV_ITEMS: { id: TabName; icon: React.ReactNode; label: string }[] = [
  { id: 'dashboard',      icon: <LayoutDashboard size={20} strokeWidth={1.75} />, label: 'ホーム' },
  { id: 'visual-ranking', icon: <BarChart2        size={20} strokeWidth={1.75} />, label: 'ランキング' },
  { id: 'analytics',      icon: <PieChart         size={20} strokeWidth={1.75} />, label: '実績・分析' },
  { id: 'shift',          icon: <Calendar         size={20} strokeWidth={1.75} />, label: 'シフト' },
  { id: 'profile',        icon: <Users            size={20} strokeWidth={1.75} />, label: 'スタッフ' },
];

const SECRET_NAV_ITEMS: { id: TabName; icon: React.ReactNode; label: string }[] = [
  { id: 'growth',     icon: <GraduationCap size={20} strokeWidth={1.75} />, label: '育成管理' },
  { id: 'tardiness',  icon: <Clock         size={20} strokeWidth={1.75} />, label: '遅刻/早退' },
  { id: 'tantou',     icon: <UserCheck     size={20} strokeWidth={1.75} />, label: '担当' },
];

export default function BottomNav({ activeTab, onTabChange, secretMode }: BottomNavProps) {
  const navItems = secretMode ? SECRET_NAV_ITEMS : ALL_NAV_ITEMS;
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`menu-item${isActive ? ' active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flexDirection: 'column',
              gap: '3px',
              padding: '6px 4px',
              color: isActive ? 'var(--text-main)' : 'var(--text-sub)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span style={{ display: 'flex', justifyContent: 'center' }}>
              {item.icon}
            </span>
            <span style={{ fontSize: '9px', letterSpacing: '0.01em' }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
