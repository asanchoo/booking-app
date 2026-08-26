import React, { useState, useEffect } from 'react';
import { User, Phone, Calendar, Clock, AlertTriangle, ArrowRight, Loader2, Lock } from 'lucide-react';
import './BookingForm.css';

export default function BookingForm({ service, barber, slot, onSubmit, isLoading, errorMessage, clientAuth }) {
  const isClientLoggedIn = Boolean(clientAuth?.authenticated && clientAuth?.phone);

  const [customerName, setCustomerName] = useState(clientAuth?.name || '');
  const [customerPhone, setCustomerPhone] = useState(clientAuth?.phone || '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (clientAuth?.name && !customerName) {
      setCustomerName(clientAuth.name);
    }
    if (clientAuth?.phone) {
      setCustomerPhone(clientAuth.phone);
    }
  }, [clientAuth]);

  const slotTime = slot ? (slot.startsAt || slot.start_time) : null;

  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim()) {
      setFormError('Пожалуйста, введите ваше имя');
      return;
    }

    const finalPhone = isClientLoggedIn ? clientAuth.phone : customerPhone.trim();

    if (!finalPhone || finalPhone.length < 6) {
      setFormError('Пожалуйста, введите корректный номер телефона');
      return;
    }

    onSubmit({
      serviceId: service.id,
      startsAt: slotTime,
      clientName: customerName.trim(),
      clientPhone: finalPhone,
    });
  };

  return (
    <div className="booking-form-card glass-panel animate-fade-in">
      <h3 className="form-title">Детали вашей записи</h3>

      <div className="summary-box">
        <div className="summary-item">
          <span className="summary-label">Услуга:</span>
          <span className="summary-value highlight">{service.name}</span>
        </div>
        {barber && (
          <div className="summary-item">
            <span className="summary-label">Мастер:</span>
            <span className="summary-value barber-summary-value">
              <div className="summary-barber-avatar">
                {barber.photoUrl ? (
                  <img
                    src={barber.photoUrl}
                    alt={barber.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  className="summary-barber-initials"
                  style={{ display: barber.photoUrl ? 'none' : 'flex' }}
                >
                  {getInitials(barber.name)}
                </div>
              </div>
              <span>{barber.name}</span>
            </span>
          </div>
        )}
        <div className="summary-item">
          <span className="summary-label">Длительность & Цена:</span>
          <span className="summary-value">
            {service.durationMinutes || service.duration_minutes} мин / {
              service.priceCents !== undefined ? service.priceCents / 100 : service.price
            } ₸
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Время визита:</span>
          <span className="summary-value date-value">
            <Calendar size={16} />
            {formatDate(slotTime)}
          </span>
        </div>
      </div>

      {(formError || errorMessage) && (
        <div className="error-banner animate-fade-in">
          <AlertTriangle size={18} />
          <span>{formError || errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="booking-form" noValidate>
        <div className="input-group">
          <label htmlFor="customerName">
            <User size={16} /> Ваше имя
          </label>
          <input
            id="customerName"
            type="text"
            placeholder="Например, Александр"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              if (formError) setFormError('');
            }}
            disabled={isLoading}
          />
        </div>

        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label htmlFor="customerPhone" style={{ margin: 0 }}>
              <Phone size={16} /> Номер телефона
            </label>
            {isClientLoggedIn && (
              <span style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> Аккаунт
              </span>
            )}
          </div>

          <input
            id="customerPhone"
            type="tel"
            placeholder="Введите номер телефона"
            value={isClientLoggedIn ? clientAuth.phone : customerPhone}
            onChange={(e) => {
              if (!isClientLoggedIn) {
                setCustomerPhone(e.target.value);
                if (formError) setFormError('');
              }
            }}
            disabled={isLoading || isClientLoggedIn}
            readOnly={isClientLoggedIn}
            style={
              isClientLoggedIn
                ? {
                    background: '#F4F4F5',
                    color: '#18181B',
                    cursor: 'not-allowed',
                    borderColor: '#E4E4E7',
                    fontWeight: '600',
                  }
                : {}
            }
          />
        </div>

        <button 
          type="submit" 
          className="submit-button" 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="spinner" />
              <span>Записываем...</span>
            </>
          ) : (
            <>
              <span>Подтвердить запись</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
