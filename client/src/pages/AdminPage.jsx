import React, { useEffect, useState, useMemo } from 'react';
import { fetchBookings } from '../api/bookingApi.js';
import { 
  Users, 
  Calendar, 
  Clock, 
  RefreshCw, 
  Search, 
  Scissors, 
  Phone, 
  CheckCircle2, 
  TrendingUp 
} from 'lucide-react';
import './AdminPage.css';

export default function AdminPage() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки списка записей');
    } finally {
      setIsLoading(false);
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = bookings.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = bookings.filter((b) => {
      const time = b.startsAt || b.start_time;
      return time && time.startsWith(todayStr);
    }).length;

    const upcomingCount = bookings.filter((b) => {
      const time = b.startsAt || b.start_time;
      return time && new Date(time) >= new Date();
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
      return cName.includes(q) || cPhone.includes(q) || sName.includes(q);
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

  return (
    <div className="admin-page-container">
      {/* Top Header */}
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Панель управления</h1>
          <p className="admin-subtitle">Обзор записей клиентов и ключевая статистика</p>
        </div>
        <button onClick={loadData} className="refresh-button" disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'spinner' : ''} />
          <span>Обновить данные</span>
        </button>
      </div>

      {error && (
        <div className="admin-error-banner">
          <span>{error}</span>
        </div>
      )}

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
              placeholder="Поиск по имени, телефону или услуге..."
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
                        <div className="service-badge">
                          <Scissors size={13} />
                          <span>{sName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${b.status || 'confirmed'}`}>
                          <CheckCircle2 size={12} />
                          {b.status === 'cancelled' ? 'Отменено' : 'Подтверждено'}
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
    </div>
  );
}
