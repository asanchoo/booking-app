import React, { useEffect, useState } from 'react';
import { fetchServices, fetchBarbers, fetchSlots, createBooking } from '../api/bookingApi.js';
import ServiceCard from '../components/ServiceCard.jsx';
import BarberCard from '../components/BarberCard.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import BookingForm from '../components/BookingForm.jsx';
import { generateTelegramLink, checkTelegramStatus, checkClientAuth } from '../api/clientAuthApi.js';
import {
  CheckCircle, AlertCircle, RotateCcw,
  Scissors, X, Loader2, ArrowLeft, Send, ExternalLink,
} from 'lucide-react';
import './CustomerBookingPage.css';

/* ── helpers ─────────────────────────────── */

function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateFull(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function getPrice(s) {
  const p = s.priceCents !== undefined ? s.priceCents / 100 : s.price;
  return Number(p).toLocaleString('ru-RU');
}

function getDuration(s) {
  return s.durationMinutes || s.duration_minutes;
}

/* ── component ───────────────────────────── */

export default function CustomerBookingPage() {
  /* state */
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);

  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [nearestSlotsMap, setNearestSlotsMap] = useState({});

  /* Modal state for step 2 calendar */
  const [modalState, setModalState] = useState({
    isOpen: false,
    barberId: null,
  });
  const [modalSlots, setModalSlots] = useState([]);
  const [loadingModalSlots, setLoadingModalSlots] = useState(false);

  /* Selected slot for booking step */
  const [selectedSlot, setSelectedSlot] = useState(null);

  /* Step source flag: 'quick' or 'modal' */
  const [bookingSource, setBookingSource] = useState(null);

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [clientAuth, setClientAuth] = useState(null);

  /* derived step: 1 = service, 2 = barber/time, 3 = form, 'ok' = success */
  const step = success
    ? 'ok'
    : selectedSlot && selectedBarber
      ? 3
      : selectedService
        ? 2
        : 1;

  /* ── data loading ─────────────────────── */

  useEffect(() => {
    (async () => {
      setLoadingServices(true);
      try {
        const [servicesData, authData] = await Promise.all([
          fetchServices(),
          checkClientAuth().catch(() => ({ authenticated: false })),
        ]);
        setServices(servicesData);
        if (authData?.authenticated) {
          setClientAuth(authData);
        }
      } catch (err) {
        setError(err.message || 'Ошибка загрузки услуг');
      } finally {
        setLoadingServices(false);
      }
    })();
  }, []);

  /* When service is selected → load barbers + top 3 nearest future slots */
  useEffect(() => {
    if (!selectedService) return;

    let cancelled = false;
    (async () => {
      setLoadingBarbers(true);
      setError('');

      try {
        const barbersList = await fetchBarbers();
        if (cancelled) return;
        setBarbers(barbersList);

        const today = toDateStr();
        const end = new Date();
        end.setDate(end.getDate() + 7);
        const toDate = toDateStr(end);
        const now = new Date();

        const results = await Promise.all(
          barbersList.map((b) =>
            fetchSlots(selectedService.id, b.id, today, toDate)
              .then((slots) => ({ barberId: b.id, slots }))
              .catch(() => ({ barberId: b.id, slots: [] })),
          ),
        );
        if (cancelled) return;

        const nearestMap = {};
        results.forEach(({ barberId, slots }) => {
          const futureSlots = (Array.isArray(slots) ? slots : []).filter(
            (s) => new Date(s.startsAt || s.start_time) > now,
          );
          nearestMap[barberId] = futureSlots.slice(0, 3);
        });
        setNearestSlotsMap(nearestMap);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Ошибка загрузки мастеров');
      } finally {
        if (!cancelled) setLoadingBarbers(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedService]);

  /* ── handlers ─────────────────────────── */

  const handleQuickBook = (barber, slot) => {
    setSelectedBarber(barber);
    setSelectedSlot(slot);
    setBookingSource('quick');
  };

  const handleOpenModal = async (barber) => {
    setModalState({
      isOpen: true,
      barberId: barber.id,
    });
    setLoadingModalSlots(true);
    try {
      const from = toDateStr();
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const to = toDateStr(end);
      const data = await fetchSlots(
        selectedService.id, barber.id,
        from, to,
      );
      setModalSlots(Array.isArray(data) ? data : []);
    } catch {
      setModalSlots([]);
    } finally {
      setLoadingModalSlots(false);
    }
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, barberId: null });
  };

  const handleSlotFromModal = (slot) => {
    const barber = barbers.find((b) => b.id === modalState.barberId);
    if (barber) {
      setSelectedBarber(barber);
      setSelectedSlot(slot);
      setBookingSource('modal');
      // Notice: we keep modalState intact (or re-opened) so if user clicks Back on step 3, modal reopens seamlessly!
    }
  };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await createBooking({ ...formData, barberId: selectedBarber.id });
      setSuccess(res);
    } catch (err) {
      if (err.status === 409) {
        setError('Этот слот уже занят. Пожалуйста, выберите другое время.');
        setSelectedSlot(null);
      } else {
        setError(err.message || 'Ошибка при бронировании');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      // Returning to step 2 while preserving modal state if booking came from modal!
      setSelectedSlot(null);
      if (bookingSource === 'quick') {
        setSelectedBarber(null);
        setModalState({ isOpen: false, barberId: null });
      }
      // If source === 'modal', selectedBarber and modalState stay active so modal opens automatically!
    } else if (step === 2) {
      setSelectedService(null);
      setSelectedBarber(null);
      setSelectedSlot(null);
      setModalState({ isOpen: false, barberId: null });
      setBarbers([]);
      setNearestSlotsMap({});
    }
  };

  const resetAll = () => {
    setSuccess(null);
    setSelectedSlot(null);
    setSelectedBarber(null);
    setSelectedService(null);
    setModalState({ isOpen: false, barberId: null });
    setBookingSource(null);
    setBarbers([]);
    setNearestSlotsMap({});
  };

  /* ── render: success ──────────────────── */

  if (step === 'ok') {
    const bk = success.booking || success;
    const phone = bk.clientPhone || bk.customer_phone || bk.phone;

    return <SuccessScreen bk={bk} phone={phone} selectedService={selectedService} selectedBarber={selectedBarber} resetAll={resetAll} />;
  }


  /* ── render: main flow ────────────────── */

  const modalBarber = barbers.find((b) => b.id === modalState.barberId);
  const isModalVisible = step === 2 && modalState.isOpen && modalBarber;

  return (
    <div className="customer-page">
      <div className="cp-wrap">
        {/* Header */}
        <header className="cp-header step-in">
          <p className="cp-tagline">Онлайн запись</p>
          <h1 className="cp-brand">BARBERSHOP</h1>
        </header>

        {/* Progress indicator */}
        <nav className="cp-progress step-in" aria-label="Шаги записи">
          {['Услуга', 'Мастер и время', 'Запись'].map((label, i) => {
            const num = i + 1;
            const isActive = step === num;
            const isDone = typeof step === 'number' && step > num;
            return (
              <React.Fragment key={num}>
                {i > 0 && <div className={`cp-prog-line${isDone ? ' done' : ''}`} />}
                <div className={`cp-prog-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
                  <div className="cp-prog-dot">{isDone ? '✓' : num}</div>
                  <span className="cp-prog-label">{label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Error */}
        {error && (
          <div className="cp-error step-in">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Закрыть"><X size={16} /></button>
          </div>
        )}

        {/* Selected service bar (shown in steps 2 and 3) */}
        {typeof step === 'number' && step >= 2 && (
          <div className="cp-selected-bar step-in">
            <Scissors size={16} className="cp-bar-icon" />
            <span className="cp-bar-name">{selectedService.name}</span>
            <span className="cp-bar-meta">
              {getDuration(selectedService)} мин · {getPrice(selectedService)} ₸
            </span>
            <button className="cp-bar-change" onClick={handleBack}>Изменить</button>
          </div>
        )}

        {/* ── Step 1: Select service ── */}
        {step === 1 && (
          <section className="cp-section step-in">
            <h2 className="cp-heading">Выберите услугу</h2>
            {loadingServices ? (
              <div className="cp-loading">
                <Loader2 size={24} className="spin" />
                <span>Загрузка услуг…</span>
              </div>
            ) : (
              <div className="cp-grid-services">
                {services.map((service, i) => (
                  <div key={service.id} className="card-stagger" style={{ animationDelay: `${i * 60}ms` }}>
                    <ServiceCard
                      service={service}
                      isSelected={false}
                      onSelect={() => setSelectedService(service)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Step 2: Select barber + time ── */}
        {step === 2 && (
          <section className="cp-section step-in">
            <h2 className="cp-heading">Выберите мастера</h2>
            {loadingBarbers ? (
              <div className="cp-loading">
                <Loader2 size={24} className="spin" />
                <span>Загрузка мастеров…</span>
              </div>
            ) : (
              <div className="cp-grid-barbers">
                {barbers.map((barber, i) => (
                  <BarberCard
                    key={barber.id}
                    barber={barber}
                    nearestSlots={nearestSlotsMap[barber.id] || []}
                    modalState={modalState}
                    onQuickBook={handleQuickBook}
                    onOpenModal={handleOpenModal}
                    delay={i * 80}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Modal overlay for Step 2 Calendar ── */}
        {isModalVisible && (
          <div className="cp-modal-backdrop step-in" onClick={handleCloseModal}>
            <div className="cp-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="cp-modal-header">
                <h3>
                  Расписание: <strong>{modalBarber.name}</strong>
                </h3>
                <button
                  className="cp-modal-close"
                  onClick={handleCloseModal}
                  aria-label="Закрыть"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="cp-modal-body">
                {loadingModalSlots ? (
                  <div className="cp-loading sm">
                    <Loader2 size={22} className="spin" />
                    <span>Загрузка доступного времени…</span>
                  </div>
                ) : (
                  <SlotPicker
                    slots={modalSlots}
                    selectedSlot={selectedSlot}
                    onSelectSlot={handleSlotFromModal}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Booking form ── */}
        {step === 3 && (
          <section className="cp-section step-in">
            <button className="cp-back-btn" onClick={handleBack}>
              <ArrowLeft size={18} />
              <span>
                {bookingSource === 'modal'
                  ? `Назад к расписанию (${selectedBarber?.name})`
                  : 'Назад к выбору мастера'}
              </span>
            </button>
            <BookingForm
              service={selectedService}
              barber={selectedBarber}
              slot={selectedSlot}
              onSubmit={handleSubmit}
              isLoading={submitting}
              errorMessage=""
              clientAuth={clientAuth}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function SuccessScreen({ bk, phone, selectedService, selectedBarber, resetAll }) {
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramHint, setTelegramHint] = useState(false);
  const [isTelegramLinked, setIsTelegramLinked] = useState(false);

  useEffect(() => {
    if (!phone) return;
    checkTelegramStatus(phone)
      .then((res) => setIsTelegramLinked(Boolean(res?.linked)))
      .catch(() => setIsTelegramLinked(false));
  }, [phone]);

  const handleLinkTelegram = async () => {
    if (!phone) return;
    setTelegramLoading(true);
    try {
      const { link } = await generateTelegramLink(phone);
      window.open(link, '_blank');
      setTelegramHint(true);
    } catch (err) {
      console.error(err);
    } finally {
      setTelegramLoading(false);
    }
  };

  return (
    <div className="customer-page">
      <div className="cp-wrap cp-center">
        <div className="cp-success step-in">
          <div className="cp-success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="cp-success-title">Вы записаны!</h2>
          <p className="cp-success-sub">Ждём вас в назначенное время</p>

          <div className="cp-success-info">
            {[
              ['Услуга', bk.serviceName || selectedService?.name],
              ['Мастер', bk.barberName || selectedBarber?.name],
              ['Время', fmtDateFull(bk.startsAt || bk.start_time)],
              ['Имя', bk.clientName || bk.customer_name],
              ['Телефон', bk.clientPhone || bk.customer_phone],
            ].map(([label, value]) => (
              <div key={label} className="cp-info-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          {/* Telegram linking banner for guest / quick booking (shown only if not linked) */}
          {!isTelegramLinked && (
            <div style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: '16px',
              padding: '16px 20px',
              marginTop: '20px',
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#0284C7', color: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '2px',
                }}>
                  <Send size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.92rem', fontWeight: '700', color: '#0C4A6E' }}>
                    📱 Привяжите Telegram, чтобы получать уведомления и управлять записью
                  </h4>
                  <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#0369A1', lineHeight: 1.4 }}>
                    Вы сможете просматривать и отменять записи прямо в мессенджере в один клик.
                  </p>

                  <div>
                    <button
                      onClick={handleLinkTelegram}
                      disabled={telegramLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        background: '#0284C7',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {telegramLoading ? <Loader2 size={16} className="spin" /> : (
                        <>
                          <Send size={15} />
                          <span>Привязать Telegram</span>
                          <ExternalLink size={13} />
                        </>
                      )}
                    </button>
                    {telegramHint && (
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '0.78rem', color: '#0284C7', fontWeight: '600' }}>
                        Нажмите Start в открывшемся чате Telegram
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button className="cp-btn-dark" onClick={resetAll} style={{ marginTop: '24px' }}>
            <RotateCcw size={18} />
            <span>Записаться снова</span>
          </button>
        </div>
      </div>
    </div>
  );
}

