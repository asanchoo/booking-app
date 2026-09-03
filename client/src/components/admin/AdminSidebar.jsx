import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  Scissors,
  UserCog,
  MessageSquareText,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'appointments', label: 'Записи', icon: Clock },
  { id: 'calendar', label: 'Календарь', icon: Calendar },
  { id: 'clients', label: 'Клиенты', icon: Users },
  { id: 'services', label: 'Услуги', icon: Scissors },
  { id: 'barbers', label: 'Мастера', icon: UserCog },
  { id: 'reviews', label: 'Отзывы', icon: MessageSquareText },
  { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export default function AdminSidebar({
  activeTab,
  onSelectTab,
  onLogout,
  collapsed,
  onToggleCollapse
}) {
  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">B</div>
          {!collapsed && <span className="sidebar-brand-title">BARBERSHOP</span>}
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <>
              <ChevronLeft size={14} />
              <span>Свернуть</span>
            </>
          )}
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="sidebar-nav-icon" />
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {isActive && <div className="sidebar-active-pill" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="admin-profile">
          <div className="admin-avatar">A</div>
          {!collapsed && (
            <div className="admin-info">
              <span className="admin-name">Администратор</span>
              <span className="admin-role">Управление</span>
            </div>
          )}
        </div>
        <button
          className="logout-btn"
          onClick={onLogout}
          title="Выйти из аккаунта"
        >
          <LogOut size={18} />
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>
    </aside>
  );
}
