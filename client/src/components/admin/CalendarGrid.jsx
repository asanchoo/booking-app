import React, { useState } from 'react';
import { Clock, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Coffee } from 'lucide-react';

function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(d) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

function formatCompactDate(d) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

export default function CalendarGrid({ barbers = [], bookings = [], timeBlocks = [], selectedBooking, onSelectBooking }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDateInput, setShowDateInput] = useState(false);
  const [mobileBarberId, setMobileBarberId] = useState('');

  const activeBarbers = barbers.filter((b) => b.isActive !== 0);
  const visibleMobileBarberId = activeBarbers.some((b) => String(b.id) === String(mobileBarberId))
    ? String(mobileBarberId)
    : String(activeBarbers[0]?.id || '');
  const currentDateStr = toDateStr(currentDate);

  const getInitials = (name) => {
    if (!name) return 'М';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter bookings by selected date
  const dailyBookings = bookings.filter((b) => {
    const startsAt = b.startsAt || b.start_time;
    if (!startsAt) return false;
    return startsAt.startsWith(currentDateStr);
  });

  const getBookingForSlot = (barberId, timeSlot) => {
    return dailyBookings.find((b) => {
      if (b.barberId !== barberId && b.barber_id !== barberId) return false;
      const startsAt = b.startsAt || b.start_time;
      if (!startsAt) return false;
      const bTime = startsAt.split('T')[1]?.slice(0, 5);
      return bTime === timeSlot;
    });
  };

  const getBlockForSlot = (barberId, timeSlot) => {
    const slotStart = new Date(`${currentDateStr}T${timeSlot}:00`);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60000);
    return timeBlocks.find((block) => block.masterId === barberId && new Date(block.startsAt) < slotEnd && new Date(block.endsAt) > slotStart);
  };

  const isToday = toDateStr(new Date()) === currentDateStr;

  return (
    <div className="calendar-grid-container">
      {/* Date Navigation Bar */}
      <div className="calendar-date-nav">
        <div className="date-nav-left">
          <button
            className="date-nav-btn"
            onClick={() => setCurrentDate(addDays(currentDate, -1))}
            title="Предыдущий день"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="date-nav-label">
            <span className="date-nav-text">{formatDisplayDate(currentDate)}</span>
            <span className="date-nav-text compact">{formatCompactDate(currentDate)}</span>
            {isToday && <span className="today-badge">Сегодня</span>}
          </div>

          <button
            className="date-nav-btn"
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
            title="Следующий день"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="date-nav-right">
          <div className="date-picker-wrapper">
            <button
              className="date-nav-btn calendar-icon-btn"
              onClick={() => setShowDateInput(!showDateInput)}
              title="Выбрать дату"
            >
              <CalendarIcon size={16} />
            </button>
            {showDateInput && (
              <input
                type="date"
                className="floating-date-input"
                value={currentDateStr}
                onChange={(e) => {
                  if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setCurrentDate(new Date(y, m - 1, d));
                    setShowDateInput(false);
                  }
                }}
                onBlur={() => setTimeout(() => setShowDateInput(false), 150)}
                autoFocus
              />
            )}
          </div>
          <button
            className="date-nav-btn today-btn"
            onClick={() => setCurrentDate(new Date())}
            disabled={isToday}
          >
            Сегодня
          </button>
        </div>
      </div>

      {/* On phones, one selected master is easier to scan than a compressed table. */}
      {activeBarbers.length > 0 && (
        <label className="mobile-master-picker">
          <span>Расписание мастера</span>
          <select value={visibleMobileBarberId} onChange={(event) => setMobileBarberId(event.target.value)}>
            {activeBarbers.map((barber) => <option key={barber.id} value={String(barber.id)}>{barber.name}</option>)}
          </select>
        </label>
      )}

      {/* Grid */}
      <div className="calendar-grid-wrapper" role="region" aria-label="Расписание всех мастеров" tabIndex="0">
        <div className="calendar-grid-table">
          {/* Header row */}
          <div className="grid-header-row">
            <div className="grid-corner-cell">
              <Clock size={14} />
              <span>Время</span>
            </div>
            {activeBarbers.map((b) => (
              <div key={b.id} className={`grid-barber-header ${String(b.id) !== visibleMobileBarberId ? 'mobile-hidden' : ''}`}>
                <div className="grid-barber-avatar">
                  {b.photoUrl ? (
                    <img
                      src={b.photoUrl}
                      alt={b.name}
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
                    className="grid-barber-initials"
                    style={{ display: b.photoUrl ? 'none' : 'flex' }}
                  >
                    {getInitials(b.name)}
                  </div>
                </div>
                <div className="grid-barber-name-info">
                  <span className="grid-barber-name">{b.name}</span>
                  <span className="grid-barber-role">Мастер</span>
                </div>
              </div>
            ))}
          </div>

          {/* Grid body rows */}
          <div className="grid-body">
            {TIME_SLOTS.map((timeSlot) => (
              <div key={timeSlot} className="grid-row">
                <div className="grid-time-cell">
                  <span>{timeSlot}</span>
                </div>
                {activeBarbers.map((b) => {
                  const booking = getBookingForSlot(b.id, timeSlot);
                  const timeBlock = getBlockForSlot(b.id, timeSlot);
                  const isSelected = selectedBooking && selectedBooking.id === booking?.id;

                  return (
                    <div
                      key={`${b.id}-${timeSlot}`}
                      className={`grid-slot-cell ${String(b.id) !== visibleMobileBarberId ? 'mobile-hidden' : ''} ${booking ? 'has-booking' : timeBlock ? 'has-time-block' : 'empty'}`}
                    >
                      {booking && (
                        <div
                          className={`booking-card-block ${booking.status || 'confirmed'} ${isSelected ? 'selected' : ''}`}
                          onClick={() => onSelectBooking(booking)}
                        >
                          <div className="card-block-top">
                            <span className="client-title">{booking.clientName || booking.customer_name}</span>
                            <span className="service-sub">{booking.serviceName || booking.service_name}</span>
                          </div>
                          <div className="card-block-time">
                            <Clock size={11} />
                            <span>{timeSlot}</span>
                          </div>
                        </div>
                      )}
                      {!booking && timeBlock && (
                        <div className="master-time-block" title={`${timeBlock.reason || 'Недоступно'}: ${timeBlock.startsAt} — ${timeBlock.endsAt}`}>
                          <Coffee size={12} />
                          <span>{timeBlock.reason || 'Недоступно'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
