import React, { useEffect, useState, useMemo } from 'react';
import { fetchBookings } from '../api/bookingApi.js';
import { getAdminBarbers } from '../api/adminApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar as CalendarIcon,
  Clock,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

import AdminSidebar from '../components/admin/AdminSidebar.jsx';
import MetricCard from '../components/admin/MetricCard.jsx';
import CalendarGrid from '../components/admin/CalendarGrid.jsx';
import AppointmentsTable from '../components/admin/AppointmentsTable.jsx';
import AppointmentDetailsPanel from '../components/admin/AppointmentDetailsPanel.jsx';
import ClientsList from '../components/admin/ClientsList.jsx';
import AdminServicesLight from '../components/admin/AdminServicesLight.jsx';
import AdminBarbersLight from '../components/admin/AdminBarbersLight.jsx';
import AdminSettingsLight from '../components/admin/AdminSettingsLight.jsx';

import './AdminPage.css';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedBooking, setSelectedBooking] = useState(null);

  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleAuthError = () => navigate('/login');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [bookingsData, barbersData] = await Promise.all([
        fetchBookings().catch((err) => { if (err.status === 401) throw err; return []; }),
        getAdminBarbers().catch((err) => { if (err.status === 401) throw err; return []; }),
      ]);
      setBookings(bookingsData);
      setBarbers(barbersData);
    } catch (err) {
      if (err.status === 401) { navigate('/login'); return; }
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getLocalDateStr = (d = new Date()) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const metrics = useMemo(() => {
    const total = bookings.length;
    const now = new Date();
    const todayStr = getLocalDateStr(now);

    const todayCount = bookings.filter((b) => {
      const time = b.startsAt || b.start_time;
      if (!time || (b.status || '') === 'cancelled') return false;
      return getLocalDateStr(new Date(time)) === todayStr;
    }).length;

    const upcomingCount = bookings.filter((b) => {
      const time = b.startsAt || b.start_time;
      return time && new Date(time) >= now && b.status === 'confirmed';
    }).length;

    const completedCount = bookings.filter((b) => {
      const time = b.startsAt || b.start_time;
      return time && new Date(time) < now && b.status === 'confirmed';
    }).length;

    return { total, todayCount, upcomingCount, completedCount };
  }, [bookings]);

  return (
    <div className={`admin-dashboard-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 1. Left Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={(tab) => { setActiveTab(tab); setSelectedBooking(null); }}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Main Content */}
      <main className="admin-main-viewport">
        {/* Top bar */}
        <header className="admin-top-bar">
          <div className="top-bar-left">
            <h1 className="page-title">
              {activeTab === 'overview' && 'Обзор дашборда'}
              {activeTab === 'appointments' && 'Управление записями'}
              {activeTab === 'calendar' && 'Календарь записей'}
              {activeTab === 'clients' && 'База клиентов'}
              {activeTab === 'services' && 'Услуги и прайс-лист'}
              {activeTab === 'barbers' && 'Команда барберов'}
              {activeTab === 'settings' && 'Настройки заведения'}
            </h1>
          </div>
          <div className="top-bar-right">
            <button className="btn-secondary-light" onClick={loadData} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
              <span>Обновить</span>
            </button>
          </div>
        </header>

        {error && <div className="admin-error-banner"><span>{error}</span></div>}

        <div className="admin-workspace-content">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="overview-tab-view step-in">
              <div className="metrics-row">
                <MetricCard title="Всего записей" value={metrics.total} subtitle="За всё время" icon={Users} color="gold" />
                <MetricCard title="Записей на сегодня" value={metrics.todayCount} subtitle="Активный день" icon={CalendarIcon} color="green" />
                <MetricCard title="Предстоящие" value={metrics.upcomingCount} subtitle="В ближайшее время" icon={TrendingUp} color="blue" />
                <MetricCard title="Завершённые" value={metrics.completedCount} subtitle="Выполнено визитов" icon={Clock} color="purple" />
              </div>
              <div className="section-card-panel">
                <div className="panel-title-bar">
                  <h2>Расписание мастеров</h2>
                </div>
                <CalendarGrid
                  barbers={barbers}
                  bookings={bookings}
                  selectedBooking={selectedBooking}
                  onSelectBooking={setSelectedBooking}
                />
              </div>
            </div>
          )}

          {/* APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="appointments-tab-view step-in">
              <AppointmentsTable
                bookings={bookings}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectBooking={setSelectedBooking}
                selectedBookingId={selectedBooking?.id}
              />
            </div>
          )}

          {/* CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="calendar-tab-view step-in">
              <div className="section-card-panel no-inner-pad">
                <CalendarGrid
                  barbers={barbers}
                  bookings={bookings}
                  selectedBooking={selectedBooking}
                  onSelectBooking={setSelectedBooking}
                />
              </div>
            </div>
          )}

          {/* CLIENTS */}
          {activeTab === 'clients' && (
            <div className="clients-tab-view step-in">
              <ClientsList bookings={bookings} onSelectClientBooking={setSelectedBooking} />
            </div>
          )}

          {/* SERVICES */}
          {activeTab === 'services' && (
            <div className="step-in">
              <AdminServicesLight onAuthError={handleAuthError} />
            </div>
          )}

          {/* BARBERS */}
          {activeTab === 'barbers' && (
            <div className="step-in">
              <AdminBarbersLight onAuthError={handleAuthError} />
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div className="step-in">
              <AdminSettingsLight onAuthError={handleAuthError} />
            </div>
          )}
        </div>
      </main>

      {/* 3. Right Details Panel */}
      {selectedBooking && (
        <AppointmentDetailsPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}
