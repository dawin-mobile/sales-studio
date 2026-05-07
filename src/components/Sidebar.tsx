'use client';

import { useState } from 'react';
import Image from 'next/image';
import { LayoutDashboard, BarChart2, Layers, PieChart, Clock, Calendar, Users, Menu, GraduationCap } from 'lucide-react';
import { TabName } from '@/types';
import { signOut } from 'next-auth/react';

interface SidebarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  userName?: string;
  userRole?: string;
  secretMode?: boolean;
  onLogoTap?: () => void;
}

const ICON_PROPS = { size: 18, strokeWidth: 1.75 } as const;

const ALL_MENU_ITEMS: { id: TabName; label: string; icon: React.ReactNode; minRole?: string }[] = [
  { id: 'dashboard',      label: 'ダッシュボード', icon: <LayoutDashboard {...ICON_PROPS} /> },
  { id: 'visual-ranking', label: 'ランキング',     icon: <BarChart2       {...ICON_PROPS} /> },
  { id: 'analytics',      label: '実績・分析',     icon: <PieChart        {...ICON_PROPS} /> },
  { id: 'shift',          label: 'シフト',         icon: <Calendar        {...ICON_PROPS} /> },
  { id: 'growth',         label: '育成管理',       icon: <GraduationCap   {...ICON_PROPS} />, minRole: '社員' },
  { id: 'profile',        label: 'スタッフ',       icon: <Users           {...ICON_PROPS} /> },
];

const ROLE_ORDER = ['業務委託', 'アルバイト', '社員', '幹部', '管理者'];
function hasMinRole(userRole: string | undefined, minRole: string): boolean {
  const idx = ROLE_ORDER.indexOf(userRole ?? '');
  return idx >= ROLE_ORDER.indexOf(minRole);
}

export default function Sidebar({ activeTab, onTabChange, userName, userRole, secretMode, onLogoTap }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const initials = userName ? userName.slice(0, 2) : '??';

  return (
    <nav className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Brand + Toggle */}
      <div className="sidebar-brand-row">
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Image src={secretMode ? '/L-icon4g-g-512.png' : '/L-icon4w-512.png'} alt="logo" width={38} height={38} style={{ borderRadius: 8, cursor: onLogoTap ? 'pointer' : 'default' }} onClick={onLogoTap} />
            <div className="brand-text" style={secretMode ? { color: '#4ade80' } : undefined}>Sales Studio</div>
          </div>
        )}
        <button
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'メニューを展開' : 'メニューを折り畳む'}
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {ALL_MENU_ITEMS.filter((item) => {
          if (!item.minRole || hasMinRole(userRole, item.minRole)) {
            if (secretMode) return item.id === 'growth';
            return true;
          }
          return false;
        }).map((item) => (
          <button
            key={item.id}
            className={`menu-item${activeTab === item.id ? ' active' : ''}${collapsed ? ' menu-item-collapsed' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
          >
            <span style={{
              flexShrink: 0,
              opacity: activeTab === item.id ? 1 : 0.75,
              transition: 'opacity 0.15s',
            }}>
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* User Info */}
      {userName && (
        <div style={{
          padding: collapsed ? '14px 8px' : '14px 12px',
          borderTop: '1px solid var(--border-color)',
        }}>
          {collapsed ? (
            /* 折り畳み時はアバターのみ */
            <div style={{
              width: 34,
              height: 34,
              background: 'linear-gradient(135deg, #4a4a4a, #2a2a2a)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#fff',
              margin: '0 auto',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }}>
              {initials}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: 34, height: 34,
                  background: 'linear-gradient(135deg, #4a4a4a, #2a2a2a)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 'bold', color: '#fff', flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{userName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '1px' }}>{userRole}</div>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: 'var(--text-sub)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-color)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-sub)';
                }}
              >
                ログアウト
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
