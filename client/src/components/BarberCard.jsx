import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import './BarberCard.css';

export default function BarberCard({
  barber,
  nearestSlots = [],
  modalState,
  onQuickBook,
  onOpenModal,
  delay = 0,
}) {
  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatSlotButtonText = (slot, index, allSlots) => {
    const slotTime = slot.startsAt || slot.start_time;
    if (!slotTime) return '';
    const date = new Date(slotTime);
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    if (index === 0) {
      if (isToday) {
        return `Сегодня ${timeStr}`;
      }
      const dayName = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
      return `${dayName} ${timeStr}`;
    }

    // For index 1 and 2: check if same date as previous slot
    const prevSlotTime = allSlots[index - 1].startsAt || allSlots[index - 1].start_time;
    const prevDate = new Date(prevSlotTime);
    const isSameDate =
      date.getDate() === prevDate.getDate() &&
      date.getMonth() === prevDate.getMonth() &&
      date.getFullYear() === prevDate.getFullYear();

    if (isSameDate) {
      return timeStr;
    }

    if (isToday) {
      return `Сегодня ${timeStr}`;
    }

    const dayName = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
    return `${dayName} ${timeStr}`;
  };

  const top3Slots = nearestSlots.slice(0, 3);
  const isModalOpenForThisBarber = modalState?.isOpen && modalState?.barberId === barber.id;

  return (
    <div
      className={`barber-card-v2 ${isModalOpenForThisBarber ? 'active-modal' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="barber-card-top">
        <div className="barber-avatar-wrapper-v2">
          {barber.photoUrl ? (
            <img
              src={barber.photoUrl}
              alt={barber.name}
              className="barber-card-photo-v2"
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
            className="barber-card-initials-v2"
            style={{ display: barber.photoUrl ? 'none' : 'flex' }}
          >
            {getInitials(barber.name)}
          </div>
        </div>

        <div className="barber-info-v2">
          <h3 className="barber-name-v2">{barber.name}</h3>
          <p className="barber-title-v2">Мастер барбершопа</p>
        </div>
      </div>

      <div className="barber-slot-action-v2">
        {top3Slots.length > 0 ? (
          <div className="slots-three-row">
            {top3Slots.map((slot, idx) => (
              <button
                key={slot.startsAt || slot.start_time}
                type="button"
                className="quick-slot-chip"
                onClick={() => onQuickBook(barber, slot)}
                title="Записаться на это время"
              >
                <Clock size={12} />
                <span>{formatSlotButtonText(slot, idx, top3Slots)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="no-slot-badge-v2">
            <span>Нет доступных мест</span>
          </div>
        )}

        <button
          type="button"
          className={`calendar-icon-btn-v2 ${isModalOpenForThisBarber ? 'active' : ''}`}
          onClick={() => onOpenModal(barber)}
          title="Открыть календарь записей"
        >
          <Calendar size={18} />
        </button>
      </div>
    </div>
  );
}
