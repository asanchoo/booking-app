import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock3, Loader2, RefreshCw, X } from 'lucide-react';
import { fetchSlots } from '../../api/bookingApi.js';
import { rescheduleAdminBooking } from '../../api/adminApi.js';

function localDateString(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function AdminRescheduleModal({ booking, onClose, onUpdated, onAuthError }) {
  const [date, setDate] = useState(localDateString());
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!booking) return;
    const currentDate = new Date(booking.startsAt);
    setDate(currentDate.getTime() > Date.now() ? localDateString(currentDate) : localDateString());
    setSelectedSlot('');
    setError('');
  }, [booking]);

  useEffect(() => {
    if (!booking || !date) return;
    let cancelled = false;
    setLoading(true);
    setSelectedSlot('');
    fetchSlots(booking.serviceId, booking.barberId, date, date)
      .then((items) => {
        if (!cancelled) setSlots(items.filter((slot) => new Date(slot.startsAt || slot.start_time).getTime() > Date.now()));
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || 'Не удалось загрузить свободное время'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [booking, date]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedSlot) return setError('Выберите новое время');
    setSaving(true);
    setError('');
    try {
      const updated = await rescheduleAdminBooking(booking.id, selectedSlot);
      onUpdated(updated);
      onClose();
    } catch (requestError) {
      if (requestError.status === 401) return onAuthError?.();
      if (requestError.status === 409) {
        setSelectedSlot('');
        setError('Это время уже заняли. Выберите другой слот.');
      } else setError(requestError.message || 'Не удалось перенести запись');
    } finally {
      setSaving(false);
    }
  };

  if (!booking) return null;
  return <div className="admin-booking-backdrop" onClick={() => !saving && onClose()}><form className="admin-booking-modal admin-reschedule-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header><div><span><RefreshCw size={18} /></span><div><h2>Перенести запись</h2><p>{booking.clientName} · {booking.serviceName} · {booking.barberName}</p></div></div><button type="button" onClick={onClose}><X size={18} /></button></header><div className="admin-booking-body">{error && <div className="admin-booking-error">{error}</div>}<label className="admin-booking-date"><span><CalendarDays size={14} /> Новая дата</span><input type="date" min={localDateString()} value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="admin-booking-slots"><span><Clock3 size={14} /> Доступное время</span>{loading ? <div className="admin-slots-state"><Loader2 size={16} className="spin" /> Проверяем расписание…</div> : slots.length === 0 ? <div className="admin-slots-state">На эту дату свободного времени нет</div> : <div>{slots.map((slot) => { const value = slot.startsAt || slot.start_time; return <button type="button" key={value} className={selectedSlot === value ? 'active' : ''} onClick={() => setSelectedSlot(value)}>{selectedSlot === value && <Check size={13} />}{new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</button>; })}</div>}</div></div><footer><button type="button" onClick={onClose}>Отмена</button><button type="submit" disabled={saving || !selectedSlot}>{saving ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} Перенести</button></footer></form></div>;
}
