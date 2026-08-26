import React, { useState } from 'react';
import { Search, Phone, Scissors, Clock, CheckCircle2, User, Eye } from 'lucide-react';

export default function AppointmentsTable({
  bookings = [],
  isLoading = false,
  searchQuery = '',
  onSearchChange,
  onSelectBooking,
  selectedBookingId,
}) {
  const [statusFilter, setStatusFilter] = useState('all');

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusInfo = (b) => {
    if (b.status === 'cancelled') {
      return { label: 'Отменено', className: 'cancelled' };
    }
    const time = b.startsAt || b.start_time;
    if (!time) {
      return { label: 'Завершена', className: 'completed' };
    }
    const now = new Date();
    if (b.status === 'confirmed' && new Date(time) >= now) {
      return { label: 'Предстоящая', className: 'confirmed' };
    }
    return { label: 'Завершена', className: 'completed' };
  };

  const filteredBookings = bookings.filter((b) => {
    const statusInfo = getStatusInfo(b);
    if (statusFilter === 'confirmed' && statusInfo.className !== 'confirmed') return false;
    if (statusFilter === 'completed' && statusInfo.className !== 'completed') return false;
    if (statusFilter === 'cancelled' && statusInfo.className !== 'cancelled') return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cName = (b.clientName || b.customer_name || '').toLowerCase();
    const cPhone = (b.clientPhone || b.customer_phone || '').toLowerCase();
    const sName = (b.serviceName || b.service_name || '').toLowerCase();
    const bName = (b.barberName || b.barber_name || '').toLowerCase();
    return cName.includes(q) || cPhone.includes(q) || sName.includes(q) || bName.includes(q);
  });

  return (
    <div className="saas-table-card">
      <div className="table-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск по клиенту, телефону, услуге или мастеру..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {[
            { id: 'all', label: 'Все' },
            { id: 'confirmed', label: 'Предстоящие' },
            { id: 'completed', label: 'Завершённые' },
            { id: 'cancelled', label: 'Отменённые' },
          ].map((f) => (
            <button
              key={f.id}
              className={`filter-btn ${statusFilter === f.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="table-loading">
          <span>Загрузка списка записей...</span>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="empty-table-state">
          <p>{searchQuery ? 'Записи по вашему запросу не найдены' : 'Записей в этой категории пока нет'}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Дата и Время</th>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Мастер</th>
                <th>Услуга</th>
                <th>Статус</th>
                <th>Действия</th>
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
                const isSelected = selectedBookingId === b.id;

                return (
                  <tr
                    key={b.id}
                    className={isSelected ? 'selected-row' : ''}
                    onClick={() => onSelectBooking(b)}
                  >
                    <td>
                      <div className="date-cell">
                        <span className="date-main">{formatDate(time)}</span>
                        <span className="time-sub">
                          <Clock size={12} /> {formatTime(time)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="client-cell">
                        <span className="client-name">{cName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="phone-cell">
                        <Phone size={13} />
                        <span>{cPhone}</span>
                      </div>
                    </td>
                    <td>
                      <div className="barber-cell">
                        <User size={13} />
                        <span>{bName}</span>
                      </div>
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
                    <td>
                      <button
                        className="btn-view-details"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBooking(b);
                        }}
                        title="Просмотреть детали"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
