import React, { useState } from 'react';
import { User, Phone, Calendar, Clock, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import './BookingForm.css';

export default function BookingForm({ service, barber, slot, onSubmit, isLoading, errorMessage }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [formError, setFormError] = useState('');

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

    if (!customerPhone.trim() || customerPhone.trim().length < 6) {
      setFormError('Пожалуйста, введите корректный номер телефона');
      return;
    }

    onSubmit({
      serviceId: service.id,
      startsAt: slotTime,
      clientName: customerName.trim(),
      clientPhone: customerPhone.trim(),
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
            } ₽
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
          <label htmlFor="customerPhone">
            <Phone size={16} /> Номер телефона
          </label>
          <input
            id="customerPhone"
            type="tel"
            placeholder="+7 (999) 000-00-00"
            value={customerPhone}
            onChange={(e) => {
              setCustomerPhone(e.target.value);
              if (formError) setFormError('');
            }}
            disabled={isLoading}
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
