import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import './SlotPicker.css';

export default function SlotPicker({ slots = [], selectedSlot, onSelectSlot }) {
  const safeSlots = Array.isArray(slots) ? slots : [];

  // Get local YYYY-MM-DD string
  const getLocalDateStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateStr();
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);

  // Group slots by local date YYYY-MM-DD
  const groupedSlots = useMemo(() => {
    const groups = {};
    safeSlots.forEach((slot) => {
      const slotTime = slot.startsAt || slot.start_time;
      if (!slotTime) return;
      // Parse ISO or local ISO format into Date
      const date = new Date(slotTime);
      const dateStr = getLocalDateStr(date);
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(slot);
    });
    return groups;
  }, [safeSlots]);

  // Current day slots
  const currentDaySlots = groupedSlots[selectedDateStr] || [];

  const formatDateHeader = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
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

  const { dayName, monthName, isToday } = formatDateHeader(selectedDateStr);

  return (
    <div className="slot-picker-container">
      <div className="slot-picker-header">
        <h3 className="section-title">
          <Clock size={20} className="title-icon" />
          <span>Выберите время ({isToday ? 'Сегодня' : `${dayName}, ${monthName}`})</span>
        </h3>

        <div className="date-picker-wrapper">
          <CalendarIcon size={18} className="date-picker-icon" />
          <input
            type="date"
            className="date-picker-input"
            value={selectedDateStr}
            min={todayStr}
            onChange={(e) => setSelectedDateStr(e.target.value)}
          />
        </div>
      </div>

      {currentDaySlots.length === 0 ? (
        <div className="no-slots-message">
          <CalendarIcon size={36} className="empty-icon" />
          <p>
            {isToday
              ? 'На сегодня свободных слотов больше нет. Выберите другую дату в календаре.'
              : `На ${monthName} свободных слотов нет. Выберите другую дату.`}
          </p>
        </div>
      ) : (
        <div className="single-day-slots">
          {currentDaySlots.map((slot) => {
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
      )}
    </div>
  );
}
