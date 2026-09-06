import React from 'react';
import { Calendar, Clock, Star } from 'lucide-react';
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

  const slotDateKey = (slot) => {
    const slotTime = slot.startsAt || slot.start_time;
    if (!slotTime) return '';
    const date = new Date(slotTime);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const formatSlotDate = (slot) => {
    const date = new Date(slot.startsAt || slot.start_time);
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
    if (isToday) return 'Сегодня';
    return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  };

  const formatSlotTime = (slot) => new Date(slot.startsAt || slot.start_time)
    .toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const top3Slots = nearestSlots.slice(0, 3);
  const slotGroups = top3Slots.reduce((groups, slot) => {
    const key = slotDateKey(slot);
    const current = groups.find((group) => group.key === key);
    if (current) current.slots.push(slot);
    else groups.push({ key, label: formatSlotDate(slot), slots: [slot] });
    return groups;
  }, []);
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
          <p className="barber-title-v2">Мастер салона</p>
          <span className="barber-public-rating"><Star size={13} fill="currentColor" /> {Number(barber.rating || 5).toFixed(1)} <small>({barber.reviewCount || 0})</small></span>
        </div>
      </div>

      {barber.latestReviewComment && (
        <div className="barber-latest-review">
          <span>Последний отзыв{barber.latestReviewAuthor ? ` · ${barber.latestReviewAuthor}` : ''}</span>
          <p>«{barber.latestReviewComment}»</p>
        </div>
      )}

      <div className="barber-slot-action-v2">
        {top3Slots.length > 0 ? (
          <div className="slots-three-row">
            {slotGroups.map((group) => (
              <div className="quick-slot-group" key={group.key}>
                <span className="quick-slot-date">{group.label}</span>
                <div className="quick-slot-times">
                  {group.slots.map((slot) => (
                    <button
                      key={slot.startsAt || slot.start_time}
                      type="button"
                      className="quick-slot-chip"
                      onClick={() => onQuickBook(barber, slot)}
                      title={`Записаться: ${group.label}, ${formatSlotTime(slot)}`}
                    >
                      <Clock size={12} />
                      <span>{formatSlotTime(slot)}</span>
                    </button>
                  ))}
                </div>
              </div>
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
