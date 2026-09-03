import React, { useEffect, useState } from 'react';
import { CalendarClock, Clock, User, Scissors, Phone, X, CheckCircle, AlertCircle, Ban, Loader2 } from 'lucide-react';

export default function AppointmentDetailsPanel({ booking, onClose, onReschedule, onCancel }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => { setConfirmCancel(false); setActionError(''); }, [booking?.id]);
  if (!booking) return null;

  const startsAt = booking.startsAt || booking.start_time;
  const endsAt = booking.endsAt || booking.end_time;
  const cName = booking.clientName || booking.customer_name || 'Не указано';
  const cPhone = booking.clientPhone || booking.customer_phone || 'Не указан';
  const sName = booking.serviceName || booking.service_name || 'Услуга';
  const bName = booking.barberName || booking.barber_name || 'Мастер не назначен';
  const status = booking.status || 'confirmed';
  const canManage = status === 'confirmed' && new Date(startsAt).getTime() > Date.now();

  const cancel = async () => {
    setCancelling(true);
    setActionError('');
    try {
      await onCancel(booking);
      setConfirmCancel(false);
    } catch (error) {
      setActionError(error.message || 'Не удалось отменить запись');
    } finally {
      setCancelling(false);
    }
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatTimeOnly = (isoStr) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name) => {
    if (!name) return 'К';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = () => {
    if (status === 'cancelled') {
      return (
        <span className="details-status-badge cancelled">
          <Ban size={14} /> Отменено
        </span>
      );
    }
    const now = new Date();
    if (startsAt && new Date(startsAt) < now) {
      return (
        <span className="details-status-badge completed">
          <CheckCircle size={14} /> Завершена
        </span>
      );
    }
    return (
      <span className="details-status-badge confirmed">
        <CheckCircle size={14} /> Подтверждена
      </span>
    );
  };

  return (
    <aside className="appointment-details-panel step-in">
      <div className="panel-header">
        <h3>Детали записи #{booking.id}</h3>
        <button className="close-panel-btn" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>
      </div>

      <div className="panel-body">
        {/* Client Profile Header */}
        <div className="client-profile-box">
          <div className="client-avatar-large">
            {getInitials(cName)}
          </div>
          <div className="client-main-info">
            <h4 className="client-name">{cName}</h4>
            <div className="client-phone-row">
              <Phone size={14} />
              <span>{cPhone}</span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="status-container">
          <span className="status-label">Статус записи</span>
          {getStatusBadge()}
        </div>

        {/* Detailed Info Cards */}
        <div className="info-cards-stack">
          <div className="info-card">
            <div className="info-icon">
              <Clock size={16} />
            </div>
            <div className="info-content">
              <span className="info-title">Время сеанса</span>
              <span className="info-val">{formatDateTime(startsAt)}</span>
              {endsAt && <span className="info-sub">До {formatTimeOnly(endsAt)}</span>}
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">
              <Scissors size={16} />
            </div>
            <div className="info-content">
              <span className="info-title">Выбранная услуга</span>
              <span className="info-val">{sName}</span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">
              <User size={16} />
            </div>
            <div className="info-content">
              <span className="info-title">Мастер</span>
              <span className="info-val">{bName}</span>
            </div>
          </div>
        </div>

        {canManage && <div className="admin-booking-actions-panel"><button onClick={() => onReschedule(booking)}><CalendarClock size={15} /> Перенести</button><button className="danger" onClick={() => setConfirmCancel(true)}><Ban size={15} /> Отменить</button></div>}
        {confirmCancel && <div className="admin-cancel-confirm"><AlertCircle size={18} /><div><strong>Отменить запись?</strong><p>Клиент получит уведомление в Telegram, если он его привязал.</p><span>{actionError}</span><div><button onClick={() => setConfirmCancel(false)} disabled={cancelling}>Назад</button><button onClick={cancel} disabled={cancelling}>{cancelling ? <Loader2 size={14} className="spin" /> : <Ban size={14} />} Да, отменить</button></div></div></div>}
      </div>
    </aside>
  );
}
