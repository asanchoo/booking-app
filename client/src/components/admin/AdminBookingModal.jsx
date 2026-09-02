import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Loader2, Phone, Plus, Scissors, User, X } from 'lucide-react';
import { fetchSlots } from '../../api/bookingApi.js';
import { createAdminBooking, getAdminServices } from '../../api/adminApi.js';

function localDateString(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function AdminBookingModal({ open, barbers = [], onClose, onCreated, onAuthError }) {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [masterId, setMasterId] = useState('');
  const [date, setDate] = useState(localDateString());
  const [slots, setSlots] = useState([]);
  const [startsAt, setStartsAt] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoadingServices(true);
    setError('');
    getAdminServices()
      .then((items) => setServices(items.filter((item) => Number(item.isActive) === 1)))
      .catch((requestError) => {
        if (requestError.status === 401) return onAuthError?.();
        setError(requestError.message || 'Не удалось загрузить услуги');
      })
      .finally(() => setLoadingServices(false));
  }, [open]);

  const selectedService = useMemo(() => services.find((service) => String(service.id) === serviceId), [services, serviceId]);
  const availableMasters = useMemo(() => {
    const activeIds = new Set(barbers.filter((master) => Number(master.isActive) === 1).map((master) => Number(master.id)));
    return (selectedService?.masters || []).filter((master) => activeIds.has(Number(master.id)));
  }, [selectedService, barbers]);

  useEffect(() => {
    setMasterId('');
    setStartsAt('');
    setSlots([]);
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId || !masterId || !date) {
      setSlots([]);
      setStartsAt('');
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setError('');
    setStartsAt('');
    fetchSlots(Number(serviceId), Number(masterId), date, date)
      .then((items) => {
        if (cancelled) return;
        const now = Date.now();
        setSlots(items.filter((slot) => new Date(slot.startsAt || slot.start_time).getTime() > now));
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || 'Не удалось загрузить свободное время'); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [serviceId, masterId, date]);

  const close = () => {
    if (saving) return;
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setServiceId(''); setMasterId(''); setDate(localDateString()); setSlots([]); setStartsAt('');
    setClientName(''); setClientPhone(''); setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!startsAt) return setError('Выберите свободное время');
    setSaving(true);
    setError('');
    try {
      const booking = await createAdminBooking({
        serviceId: Number(serviceId), barberId: Number(masterId), startsAt,
        clientName: clientName.trim(), clientPhone: clientPhone.trim(),
      });
      onCreated(booking);
      resetForm();
      onClose();
    } catch (requestError) {
      if (requestError.status === 401) return onAuthError?.();
      if (requestError.status === 409) {
        setStartsAt('');
        setError('Это время только что заняли. Выберите другой слот.');
      } else setError(requestError.message || 'Не удалось создать запись');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="admin-booking-backdrop" onClick={close}>
      <form className="admin-booking-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <header><div><span><Plus size={18} /></span><div><h2>Новая запись</h2><p>Добавьте клиента после звонка или сообщения</p></div></div><button type="button" onClick={close} aria-label="Закрыть"><X size={18} /></button></header>
        <div className="admin-booking-body">
          {error && <div className="admin-booking-error">{error}</div>}
          <div className="admin-booking-grid">
            <label><span><Scissors size={14} /> Услуга</span><select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={loadingServices}><option value="">{loadingServices ? 'Загрузка…' : 'Выберите услугу'}</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} · {service.durationMinutes} мин.</option>)}</select></label>
            <label><span><User size={14} /> Мастер</span><select required value={masterId} onChange={(event) => setMasterId(event.target.value)} disabled={!serviceId}><option value="">Выберите мастера</option>{availableMasters.map((master) => <option value={master.id} key={master.id}>{master.name}</option>)}</select></label>
          </div>
          <label className="admin-booking-date"><span><CalendarDays size={14} /> Дата</span><input type="date" required min={localDateString()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <div className="admin-booking-slots"><span><Clock3 size={14} /> Свободное время</span>{loadingSlots ? <div className="admin-slots-state"><Loader2 size={16} className="spin" /> Проверяем расписание…</div> : !serviceId || !masterId ? <div className="admin-slots-state">Сначала выберите услугу и мастера</div> : slots.length === 0 ? <div className="admin-slots-state">На эту дату свободного времени нет</div> : <div>{slots.map((slot) => { const value = slot.startsAt || slot.start_time; return <button type="button" key={value} className={startsAt === value ? 'active' : ''} onClick={() => setStartsAt(value)}>{startsAt === value && <Check size={13} />}{new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</button>; })}</div>}</div>
          <div className="admin-booking-grid client-fields">
            <label><span><User size={14} /> Имя клиента</span><input type="text" required minLength="2" maxLength="80" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Например: Алексей" /></label>
            <label><span><Phone size={14} /> Телефон</span><input type="tel" required value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="+7 700 000 00 00" /></label>
          </div>
        </div>
        <footer><button type="button" onClick={close}>Отмена</button><button type="submit" disabled={saving || !startsAt}>{saving ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Создать запись</button></footer>
      </form>
    </div>
  );
}
