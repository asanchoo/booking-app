import React, { useEffect, useState, useMemo } from 'react';
import { fetchBookings } from '../api/bookingApi.js';
import { getAdminBarbers, getAdminMasterTimeBlocks } from '../api/adminApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar as CalendarIcon,
  Clock,
  RefreshCw,
  TrendingUp,
  Wallet,
  ArrowRight,
  UserCheck,
  CircleAlert,
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
import AdminReviews from '../components/admin/AdminReviews.jsx';
import AdminBookingModal from '../components/admin/AdminBookingModal.jsx';
import AdminRescheduleModal from '../components/admin/AdminRescheduleModal.jsx';
import { cancelAdminBooking } from '../api/adminApi.js';
import AdminAnalytics from '../components/admin/AdminAnalytics.jsx';

import './AdminPage.css';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [timeBlocks, setTimeBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleAuthError = () => navigate('/login');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [bookingsData, barbersData, timeBlocksData] = await Promise.all([
        fetchBookings().catch((err) => { if (err.status === 401) throw err; return []; }),
        getAdminBarbers().catch((err) => { if (err.status === 401) throw err; return []; }),
        getAdminMasterTimeBlocks().catch((err) => { if (err.status === 401) throw err; return []; }),
      ]);
      setBookings(bookingsData);
      setBarbers(barbersData);
      setTimeBlocks(timeBlocksData);
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

    const todayRevenueCents = bookings
      .filter((b) => {
        const time = b.startsAt || b.start_time;
        return time && b.status !== 'cancelled' && getLocalDateStr(new Date(time)) === todayStr;
      })
      .reduce((totalRevenue, booking) => totalRevenue + Number(booking.servicePriceCents || 0), 0);

    const uniqueClients = new Set(bookings.map((booking) => booking.clientPhone).filter(Boolean)).size;
    const noShowCount = bookings.filter((booking) => booking.attendanceStatus === 'no_show').length;
    const attendedCount = bookings.filter((booking) => booking.attendanceStatus === 'attended').length;
    return { total, todayCount, upcomingCount, completedCount, todayRevenueCents, uniqueClients, noShowCount, attendedCount };
  }, [bookings]);

  const todayQueue = useMemo(() => {
    const todayStr = getLocalDateStr();
    return bookings
      .filter((booking) => {
        const startsAt = booking.startsAt || booking.start_time;
        return startsAt && booking.status !== 'cancelled' && getLocalDateStr(new Date(startsAt)) === todayStr;
      })
      .sort((a, b) => new Date(a.startsAt || a.start_time) - new Date(b.startsAt || b.start_time))
      .slice(0, 5);
  }, [bookings]);

  const formatMoney = (priceCents) => `${Math.round(priceCents / 100).toLocaleString('ru-RU')} ₸`;

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
              {activeTab === 'overview' && 'Обзор'}
              {activeTab === 'appointments' && 'Управление записями'}
              {activeTab === 'calendar' && 'Календарь записей'}
              {activeTab === 'clients' && 'База клиентов'}
              {activeTab === 'services' && 'Услуги и прайс-лист'}
              {activeTab === 'barbers' && 'Команда мастеров'}
              {activeTab === 'reviews' && 'Отзывы и качество сервиса'}
              {activeTab === 'analytics' && 'Аналитика бизнеса'}
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
              <section className="admin-pulse-card">
                <div>
                  <span className="admin-pulse-label">Сегодня в салоне</span>
                  <h2>{metrics.todayCount > 0 ? `${metrics.todayCount} записей · ${formatMoney(metrics.todayRevenueCents)}` : 'Свободный день без записей'}</h2>
                  <p>{metrics.upcomingCount} предстоящих визитов · {metrics.uniqueClients} клиентов в базе</p>
                </div>
                <div className="admin-quick-actions">
                  <button onClick={() => setActiveTab('appointments')}>Все записи <ArrowRight size={15} /></button>
                  <button onClick={() => setActiveTab('services')}>Услуги</button>
                  <button onClick={() => setActiveTab('barbers')}>Мастера</button>
                </div>
              </section>
              <div className="metrics-row">
                <MetricCard title="Всего записей" value={metrics.total} subtitle="За всё время" icon={Users} color="gold" />
                <MetricCard title="Записей на сегодня" value={metrics.todayCount} subtitle="Активный день" icon={CalendarIcon} color="green" />
                <MetricCard title="Плановая выручка" value={formatMoney(metrics.todayRevenueCents)} subtitle="По записям на сегодня" icon={Wallet} color="gold" />
                <MetricCard title="Предстоящие" value={metrics.upcomingCount} subtitle="В ближайшее время" icon={TrendingUp} color="blue" />
                <MetricCard title="Завершённые" value={metrics.completedCount} subtitle="Выполнено визитов" icon={Clock} color="purple" />
              </div>
              <div className="admin-insights-grid">
                <section className="section-card-panel admin-today-list">
                  <div className="panel-title-bar"><h2>Ближайшие сегодня</h2><span>{todayQueue.length}</span></div>
                  {todayQueue.length === 0 ? <p className="admin-overview-empty">На сегодня записей нет.</p> : todayQueue.map((booking) => (
                    <button key={booking.id} className="admin-today-row" onClick={() => setSelectedBooking(booking)}>
                      <time>{new Date(booking.startsAt || booking.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>
                      <span><strong>{booking.clientName}</strong><small>{booking.serviceName} · {booking.barberName || 'Мастер не указан'}</small></span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </section>
                <section className="section-card-panel admin-health-card">
                  <div className="panel-title-bar"><h2>Качество визитов</h2></div>
                  <div><UserCheck size={20} /><span>Пришли</span><strong>{metrics.attendedCount}</strong></div>
                  <div><CircleAlert size={20} /><span>Не пришли</span><strong>{metrics.noShowCount}</strong></div>
                  <p>Отмечайте результат визита в кабинете мастера — статистика станет точнее.</p>
                </section>
              </div>
              <div className="section-card-panel">
                <div className="panel-title-bar">
                  <h2>Расписание мастеров</h2>
                </div>
                <CalendarGrid
                  barbers={barbers}
                  bookings={bookings}
                  timeBlocks={timeBlocks}
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
                onCreateBooking={() => setBookingModalOpen(true)}
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
                  timeBlocks={timeBlocks}
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

          {/* REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="step-in">
              <AdminReviews onAuthError={handleAuthError} />
            </div>
          )}

          {/* ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="step-in">
              <AdminAnalytics bookings={bookings} />
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
          onReschedule={setRescheduleTarget}
          onCancel={async (booking) => {
            const result = await cancelAdminBooking(booking.id);
            const updated = { ...booking, status: result.status };
            setBookings((current) => current.map((item) => item.id === booking.id ? updated : item));
            setSelectedBooking(updated);
          }}
        />
      )}
      <AdminBookingModal
        open={bookingModalOpen}
        barbers={barbers}
        onClose={() => setBookingModalOpen(false)}
        onAuthError={handleAuthError}
        onCreated={(booking) => {
          setBookings((current) => [...current, booking].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
          setSelectedBooking(booking);
        }}
      />
      <AdminRescheduleModal
        booking={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onAuthError={handleAuthError}
        onUpdated={(updated) => {
          setBookings((current) => current.map((item) => item.id === updated.id ? updated : item));
          setSelectedBooking(updated);
        }}
      />
    </div>
  );
}
