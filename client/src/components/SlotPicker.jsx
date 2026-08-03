import React, { useMemo } from 'react';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
import './SlotPicker.css';

export default function SlotPicker({ slots = [], selectedSlot, onSelectSlot }) {
  const safeSlots = Array.isArray(slots) ? slots : [];

  // Group slots by date YYYY-MM-DD
  const groupedSlots = useMemo(() => {
    const groups = {};
    safeSlots.forEach((slot) => {
      const slotTime = slot.startsAt || slot.start_time;
      if (!slotTime) return;
      const dateStr = slotTime.split('T')[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(slot);
    });
    return groups;
  }, [safeSlots]);

  const dates = Object.keys(groupedSlots);

  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const todayStr = new Date().toISOString().split('T')[0];
    
    const dayName = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date);
    const monthName = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
    
    const isToday = dateString === todayStr;

    return {
      dayName: dayName.toUpperCase(),
      monthName,
      isToday,
    };
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  if (slots.length === 0) {
    return (
      <div className="no-slots-message">
        <Calendar size={36} className="empty-icon" />
        <p>К сожалению, доступных слотов на ближайшие дни нет.</p>
      </div>
    );
  }

  return (
    <div className="slot-picker-container">
      <h3 className="section-title">
        <Clock size={20} className="title-icon" />
        Выберите удобное время
      </h3>

      <div className="days-grid">
        {dates.map((dateStr) => {
          const daySlots = groupedSlots[dateStr];
          const { dayName, monthName, isToday } = formatDateHeader(dateStr);

          return (
            <div key={dateStr} className="day-column">
              <div className={`day-header ${isToday ? 'today' : ''}`}>
                <span className="day-name">{isToday ? 'Сегодня' : dayName}</span>
                <span className="day-date">{monthName}</span>
              </div>

              <div className="slots-list">
                {daySlots.map((slot) => {
                  const slotTime = slot.startsAt || slot.start_time;
                  const selectedTime = selectedSlot ? (selectedSlot.startsAt || selectedSlot.start_time) : null;
                  const isSelected = selectedTime === slotTime;
                  return (
                    <button
                      key={slotTime}
                      className={`slot-button ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectSlot(slot)}
                    >
                      {formatTime(slotTime)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
