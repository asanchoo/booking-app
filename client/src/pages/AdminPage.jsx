import React, { useEffect, useState, useMemo } from 'react';
import { fetchBookings } from '../api/bookingApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  Clock, 
  RefreshCw, 
  Search, 
  Scissors, 
  Phone, 
  CheckCircle2, 
  TrendingUp,
  LogOut,
  LayoutDashboard,
  Settings,
  UserCog
} from 'lucide-react';
import AdminServices from '../components/AdminServices.jsx';
import AdminBarbers from '../components/AdminBarbers.jsx';
import AdminSettings from '../components/AdminSettings.jsx';
import './AdminPage.css';

const TABS = [
  { id: 'bookings', label: 'Записи', icon: LayoutDashboard },
  { id: 'services', label: 'Услуги', icon: Scissors },
  { id: 'barbers', label: 'Барберы', icon: UserCog },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleAuthError = () => navigate('/login');

  useEffect(() => {
    if (activeTab === 'bookings') loadData();
  }, [activeTab]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      setError(err.message || 'Ошибка загрузки списка записей');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for local YYYY-MM-DD string
  const getLocalDateStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = bookings.length;
    const now = new Date();
    const todayStr = getLocalDateStr(now);

    const todayCount = bookings.filter((b) => {
      const time = b.startsAt || b.start_time;
      const status = b.status || 'confirmed';
      if (!time || status === 'cancelled') return false;
      const bDateStr = getLocalDateStr(new Date(time));
      return bDateStr === todayStr;
    }).length;

    const upcomingCount = bookings.filter((b) => {
      const time = b.startsAt || b.start_time;
      const status = b.status || 'confirmed';
      return time && new Date(time) >= now && status === 'confirmed';
    }).length;

    return {
      total,
      todayCount,
      upcomingCount,
    };
  }, [bookings]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter((b) => {
      const cName = (b.clientName || b.customer_name || '').toLowerCase();
      const cPhone = (b.clientPhone || b.customer_phone || '').toLowerCase();
      const sName = (b.serviceName || b.service_name || '').toLowerCase();
      const bName = (b.barberName || b.barber_name || '').toLowerCase();
      return cName.includes(q) || cPhone.includes(q) || sName.includes(q) || bName.includes(q);
    });
  }, [bookings, searchQuery]);

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

    const getStatusInfo = (booking) => {
      if (booking.status === 'cancelled') {
        return { label: 'Отменено', className: 'cancelled' };
      }
      const time = booking.startsAt || booking.start_time;
      if (!time) {
        return { label: 'Завершена', className: 'completed' };
      }
      const now = new Date();
      if (booking.status === 'confirmed' && new Date(time) >= now) {
        return { label: 'Предстоящая', className: 'confirmed' };
      }
      return { label: 'Завершена', className: 'completed' };
    };
  const renderBookingsTab = () => (
    <>
      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <div className="metric-icon-bg gold">
            <Users size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Всего записей</span>
            <span className="metric-value">{metrics.total}</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon-bg green">
            <Calendar size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Записей на сегодня</span>
            <span className="metric-value">{metrics.todayCount}</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon-bg blue">
            <TrendingUp size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Предстоящие записи</span>
            <span className="metric-value">{metrics.upcomingCount}</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-section glass-panel">
        <div className="table-header">
          <h2 className="table-title">Список записей</h2>
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Поиск по имени, телефону, услуге или мастеру..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="table-loading">
            <RefreshCw className="spinner" size={24} />
            <span>Загрузка записей...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="empty-table">
            <p>{searchQuery ? 'Записи по вашему запросу не найдены' : 'Список записей пока пуст'}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Дата и Время</th>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Мастер</th>
                  <th>Услуга</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => {
                  const time = b.startsAt || b.start_time;
                  const cName = b.clientName || b.customer_name;
                  const cPhone = b.clientPhone || b.customer_phone;
                  const sName = b.serviceName || b.service_name || `Услуга #${b.serviceId || b.service_id}`;
                  const bName = b.barberName || b.barber_name || 'Не указан';
                  const statusInfo = getStatusInfo(b);

                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="date-cell">
                          <span className="date-main">{formatDate(time)}</span>
                          <span className="time-sub">
                            <Clock size={12} /> {formatTime(time)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="client-name">{cName}</div>
                      </td>
                      <td>
                        <div className="phone-cell">
                          <Phone size={13} />
                          <span>{cPhone}</span>
                        </div>
                      </td>
                      <td>
                        <div className="barber-name-cell">{bName}</div>
                      </td>
                      <td>
                        <div className="service-badge">
                          <Scissors size={13} />
                          <span>{sName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${statusInfo.className}`}>
                          <CheckCircle2 size={12} />
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="admin-page-container">
      {/* Top Header */}
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Панель управления</h1>
          <p className="admin-subtitle">Управление записями, услугами и настройками</p>
        </div>
        <div className="header-actions">
          {activeTab === 'bookings' && (
            <button onClick={loadData} className="refresh-button" disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'spinner' : ''} />
              <span>Обновить</span>
            </button>
          )}
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={16} />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error-banner">
          <span>{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="admin-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? 'admin-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content">
        {activeTab === 'bookings' && renderBookingsTab()}
        {activeTab === 'services' && <AdminServices onAuthError={handleAuthError} />}
        {activeTab === 'barbers' && <AdminBarbers onAuthError={handleAuthError} />}
        {activeTab === 'settings' && <AdminSettings onAuthError={handleAuthError} />}
      </div>
    </div>
  );
}
