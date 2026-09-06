import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  checkClientAuth,
  fetchMyBookings,
  checkTelegramStatus,
  generateTelegramLink,
  cancelMyBooking,
  rescheduleBooking,
  createBarberReview,
} from '../api/clientAuthApi.js';
import { fetchSlots } from '../api/bookingApi.js';
import SlotPicker from '../components/SlotPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Calendar,
  Clock,
  User,
  LogOut,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Sparkles,
  Send,
  ExternalLink,
  XCircle,
  X,
  CalendarClock,
  Star,
  Timer,
  ArrowRight,
} from 'lucide-react';
import './AdminPage.css';
import './MyBookingsPage.css';

// ─── Reschedule Modal ────────────────────────────────────────────────────────
function RescheduleModal({ booking, clientPhone, onConfirm, onClose, isLoading }) {
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    if (!booking) return;
    setLoadingSlots(true);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const fromStr = `${year}-${month}-${day}`;

    const nextWeek = new Date(today.getTime() + 14 * 86400 * 1000);
    const y2 = nextWeek.getFullYear();
    const m2 = String(nextWeek.getMonth() + 1).padStart(2, '0');
    const d2 = String(nextWeek.getDate()).padStart(2, '0');
    const toStr = `${y2}-${m2}-${d2}`;

    fetchSlots(booking.serviceId, booking.barberId, fromStr, toStr)
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [booking]);

  if (!booking) return null;

  const startsAt = booking.startsAt || booking.start_time;
  const currentSlotTimeStr = selectedSlot ? (selectedSlot.startsAt || selectedSlot.start_time) : null;

  const formattedSelectedDate = currentSlotTimeStr
    ? new Intl.DateTimeFormat('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(currentSlotTimeStr))
    : '';

  return (
    <div
      className="client-sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      <div
        className="client-sheet-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '28px 28px 24px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: '#F4F4F5',
            border: 'none',
            borderRadius: '8px',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#71717A',
          }}
        >
          <X size={16} />
        </button>

        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '14px',
          background: '#FEF3C7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
        }}>
          <CalendarClock size={24} color="#D97706" />
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: '800', color: '#18181B' }}>
          Перенос записи
        </h2>

        <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#52525B' }}>
          <strong>{booking.serviceName || `Услуга #${booking.serviceId}`}</strong> · Мастер: {booking.barberName || 'Мастер'}
        </p>

        {loadingSlots ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px', color: '#71717A' }}>
            <Loader2 size={22} className="spin" />
            <span>Загрузка свободных слотов...</span>
          </div>
        ) : (
          <SlotPicker
            slots={slots}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => setSelectedSlot(slot)}
          />
        )}

        {selectedSlot && (
          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '12px',
            padding: '12px 16px',
            marginTop: '18px',
            fontSize: '0.88rem',
            color: '#92400E',
          }}>
            Новое время: <strong>{formattedSelectedDate}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '12px',
              background: '#F4F4F5',
              border: '1px solid #E4E4E7',
              color: '#52525B',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
          <button
            onClick={() => selectedSlot && onConfirm(selectedSlot)}
            disabled={isLoading || !selectedSlot}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '12px',
              background: !selectedSlot ? '#D4D4D8' : isLoading ? '#D97706' : '#C5A55A',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: (!selectedSlot || isLoading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="spin" />
                <span>Переносим...</span>
              </>
            ) : (
              'Подтвердить перенос'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmation Cancel Modal ───────────────────────────────────────────────
function CancelModal({ booking, onConfirm, onClose, isLoading }) {
  if (!booking) return null;

  const startsAt = booking.startsAt || booking.start_time;
  const dateStr = startsAt
    ? new Date(startsAt).toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';
  const timeStr = startsAt
    ? new Date(startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className="client-sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      <div
        className="client-sheet-modal client-sheet-modal-compact"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '28px 28px 24px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: '#F4F4F5',
            border: 'none',
            borderRadius: '8px',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#71717A',
          }}
        >
          <X size={16} />
        </button>

        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '14px',
          background: '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <XCircle size={26} color="#DC2626" />
        </div>

        <h2 style={{ margin: '0 0 10px', fontSize: '1.1rem', fontWeight: '800', color: '#18181B' }}>
          Отменить запись?
        </h2>

        <p style={{ margin: '0 0 6px', fontSize: '0.9rem', color: '#52525B', lineHeight: 1.5 }}>
          Вы уверены, что хотите отменить запись:
        </p>

        <div style={{
          background: '#F4F4F5',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '22px',
          fontSize: '0.88rem',
          color: '#18181B',
          lineHeight: 1.6,
        }}>
          <strong>💈 {booking.serviceName || `Услуга #${booking.serviceId}`}</strong>
          {booking.barberName && (
            <div style={{ color: '#52525B' }}>✂️ Мастер: {booking.barberName}</div>
          )}
          {startsAt && (
            <div style={{ color: '#52525B' }}>
              📅 {dateStr}, {timeStr}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '12px',
              background: '#F4F4F5',
              border: '1px solid #E4E4E7',
              color: '#52525B',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '12px',
              background: isLoading ? '#F87171' : '#DC2626',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              transition: 'background 0.15s',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="spin" />
                <span>Отмена...</span>
              </>
            ) : (
              'Да, отменить'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const isSuccess = type === 'success';
  return (
    <div className="client-toast" style={{
      position: 'fixed',
      bottom: '28px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 2000,
      background: isSuccess ? '#18181B' : '#DC2626',
      color: '#FFFFFF',
      padding: '13px 22px',
      borderRadius: '16px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '0.9rem',
      fontWeight: '600',
      whiteSpace: 'nowrap',
      animation: 'slideUp 0.25s ease',
    }}>
      {isSuccess ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
      <span>{message}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyBookingsPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Telegram state
  const [isTelegramLinked, setIsTelegramLinked] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramHint, setTelegramHint] = useState(false);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const loadTelegramStatus = useCallback(async () => {
    try {
      const res = await checkTelegramStatus();
      setIsTelegramLinked(Boolean(res?.linked));
    } catch {
      setIsTelegramLinked(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const auth = await checkClientAuth();
        if (!auth.authenticated) {
          navigate('/login');
          return;
        }
        const phone = auth.phone || '';
        setClientPhone(phone);
        setClientName(auth.name || '');
        setAuthChecked(true);

        const [bookingsData] = await Promise.all([
          fetchMyBookings(),
          loadTelegramStatus(),
        ]);
        setBookings(bookingsData || []);
      } catch (err) {
        if (err.status === 401) {
          navigate('/login');
        } else {
          setError(err.message || 'Ошибка загрузки записей');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [navigate, loadTelegramStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Refetch Telegram status when window regains focus
  useEffect(() => {
    const handleFocus = () => loadTelegramStatus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadTelegramStatus, clientPhone]);

  const handleLinkTelegram = async () => {
    if (!clientPhone) return;
    setTelegramLoading(true);
    setError('');
    try {
      const { link } = await generateTelegramLink();
      window.open(link, '_blank');
      setTelegramHint(true);
    } catch (err) {
      setError(err.message || 'Не удалось сгенерировать ссылку для Telegram');
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  };

  // ─── Cancel flow ─────────────────────────────────────────────────────────
  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await cancelMyBooking(cancelTarget.id);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancelTarget.id ? { ...b, status: 'cancelled' } : b
        )
      );
      setCancelTarget(null);
      showToast('Запись успешно отменена');
    } catch (err) {
      setCancelTarget(null);
      showToast(err.message || 'Не удалось отменить запись', 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  // ─── Reschedule flow ──────────────────────────────────────────────────────
  const handleRescheduleConfirm = async (selectedSlot) => {
    if (!rescheduleTarget || !selectedSlot) return;
    const newStartsAt = selectedSlot.startsAt || selectedSlot.start_time;

    setRescheduleLoading(true);
    try {
      const updated = await rescheduleBooking(rescheduleTarget.id, newStartsAt);
      setBookings((prev) =>
        prev.map((b) => (b.id === rescheduleTarget.id ? { ...b, ...updated } : b))
      );
      setRescheduleTarget(null);
      showToast('Запись успешно перенесена');
    } catch (err) {
      if (err.status === 409) {
        showToast('Выбранный слот уже занят', 'error');
      } else {
        showToast(err.message || 'Не удалось перенести запись', 'error');
      }
    } finally {
      setRescheduleLoading(false);
    }
  };

  const openReview = (booking) => {
    setReviewTarget(booking);
    setReviewRating(5);
    setReviewComment('');
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!reviewTarget) return;
    setReviewLoading(true);
    try {
      await createBarberReview(reviewTarget.id, { rating: reviewRating, comment: reviewComment.trim() });
      setBookings((current) => current.map((item) => item.id === reviewTarget.id ? { ...item, hasReview: true } : item));
      setReviewTarget(null);
      showToast('Спасибо за ваш отзыв!');
    } catch (err) {
      showToast(err.message || 'Не удалось сохранить отзыв', 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  // ─── Formatters ───────────────────────────────────────────────────────────
  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(isoString));
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusInfo = (b) => {
    if (b.status === 'cancelled') return { label: 'Отменено', className: 'cancelled' };
    const time = b.startsAt || b.start_time;
    if (!time) return { label: 'Завершена', className: 'completed' };
    if (b.status === 'confirmed' && new Date(time) >= new Date()) return { label: 'Предстоящая', className: 'confirmed' };
    return { label: 'Завершена', className: 'completed' };
  };

  const isUpcoming = (b) => {
    const time = b.startsAt || b.start_time;
    return b.status === 'confirmed' && time && new Date(time) >= new Date();
  };

  const formatPhoneDisplay = (raw) => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11) {
      return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
    }
    return raw;
  };

  if (!authChecked || isLoading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7F3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#71717A' }}>
          <Loader2 size={24} className="spin" />
          <span>Загрузка данных личного кабинета...</span>
        </div>
      </div>
    );
  }

  const upcomingBookings = bookings
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.startsAt || a.start_time) - new Date(b.startsAt || b.start_time));
  const pastBookings = bookings.filter((b) => !isUpcoming(b));
  const nextBooking = upcomingBookings[0] || null;
  const getCountdown = (booking) => {
    if (!booking) return '';
    const distance = new Date(booking.startsAt || booking.start_time).getTime() - nowMs;
    if (distance <= 0) return 'Визит уже начинается';
    const totalMinutes = Math.ceil(distance / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `Через ${days} дн. ${hours} ч.`;
    if (hours > 0) return `Через ${hours} ч. ${minutes} мин.`;
    return `Через ${minutes} мин.`;
  };

  return (
    <>
      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => !cancelLoading && setCancelTarget(null)}
          isLoading={cancelLoading}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          clientPhone={clientPhone}
          onConfirm={handleRescheduleConfirm}
          onClose={() => !rescheduleLoading && setRescheduleTarget(null)}
          isLoading={rescheduleLoading}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {reviewTarget && (
        <div className="client-review-backdrop" onClick={() => !reviewLoading && setReviewTarget(null)}>
          <form className="client-review-modal" onSubmit={handleReviewSubmit} onClick={(event) => event.stopPropagation()}>
            <div className="client-review-header">
              <div><span><Star size={19} /></span><div><h2>Как прошёл визит?</h2><p>{reviewTarget.serviceName} · мастер {reviewTarget.barberName || 'не указан'}</p></div></div>
              <button type="button" onClick={() => setReviewTarget(null)}><X size={18} /></button>
            </div>
            <div className="client-review-body">
              <p>Ваша оценка</p>
              <div className="client-review-stars" role="radiogroup" aria-label="Оценка мастера">
                {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" role="radio" aria-checked={reviewRating === rating} aria-label={`${rating} из 5`} className={rating <= reviewRating ? 'active' : ''} onClick={() => setReviewRating(rating)}><Star size={30} fill="currentColor" /></button>)}
              </div>
              <strong>{reviewRating === 5 ? 'Отлично!' : reviewRating === 4 ? 'Очень хорошо' : reviewRating === 3 ? 'Хорошо' : reviewRating === 2 ? 'Можно лучше' : 'Плохо'}</strong>
              <label htmlFor="review-comment">Комментарий <span>необязательно</span></label>
              <textarea id="review-comment" rows="4" maxLength="500" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Расскажите, что вам понравилось или что можно улучшить" />
              <small>{reviewComment.length}/500</small>
            </div>
            <div className="client-review-actions"><button type="button" onClick={() => setReviewTarget(null)}>Позже</button><button type="submit" disabled={reviewLoading}>{reviewLoading ? <Loader2 size={16} className="spin" /> : <Star size={16} />} Отправить отзыв</button></div>
          </form>
        </div>
      )}

      <div className="client-dashboard" style={{ minHeight: 'calc(100vh - 73px)', background: '#F8F7F3', padding: '32px 20px 80px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div className="client-dashboard-inner" style={{ maxWidth: '800px', margin: '0 auto' }}>

          {/* Profile Card Header */}
          <div className="client-profile-card" style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '24px 28px',
            border: '1px solid rgba(0, 0, 0, 0.07)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #C5A55A, #B89540)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(197, 165, 90, 0.25)',
              }}>
                <Phone size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#18181B', margin: '0 0 4px 0' }}>
                  {clientName ? `Здравствуйте, ${clientName}` : 'Личный кабинет'}
                </h1>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#71717A', fontWeight: '500' }}>
                  Номер: <strong>{formatPhoneDisplay(clientPhone)}</strong>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link
                to="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: '#18181B',
                  color: '#FFF',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                <PlusCircle size={16} />
                <span>Новая запись</span>
              </Link>

              <button
                onClick={handleLogout}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
                title="Выйти"
              >
                <LogOut size={16} />
                <span>Выйти</span>
              </button>
            </div>
          </div>

          {/* Telegram Linking Card */}
          <div className="client-telegram-card" style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            padding: '20px 24px',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            marginBottom: '28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: isTelegramLinked ? '#F0FDF4' : '#EFF6FF',
                color: isTelegramLinked ? '#16A34A' : '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 2px', fontSize: '0.98rem', fontWeight: '700', color: '#18181B' }}>
                  Telegram-уведомления
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#71717A' }}>
                  {isTelegramLinked
                    ? 'Уведомления о записях и сброс пароля привязаны к Telegram'
                    : 'Привяжите бот для получения напоминаний и лёгкого сброса пароля'}
                </p>
              </div>
            </div>

            {isTelegramLinked ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                color: '#16A34A',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: '700',
              }}>
                <CheckCircle2 size={16} /> Telegram подключен
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <button
                  onClick={handleLinkTelegram}
                  disabled={telegramLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '12px',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.88rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {telegramLoading ? <Loader2 size={16} className="spin" /> : (
                    <>
                      <Send size={16} />
                      <span>Привязать Telegram</span>
                      <ExternalLink size={14} />
                    </>
                  )}
                </button>
                {telegramHint && (
                  <span style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: '600' }}>
                    Нажмите Start в открывшемся чате
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              padding: '14px 18px',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {nextBooking && (
            <section className="client-next-visit">
              <div className="client-next-topline">
                <span><Sparkles size={15} /> Следующий визит</span>
                <strong><Timer size={16} /> {getCountdown(nextBooking)}</strong>
              </div>
              <div className="client-next-body">
                <div>
                  <p className="client-next-date">{formatDate(nextBooking.startsAt || nextBooking.start_time)} · {formatTime(nextBooking.startsAt || nextBooking.start_time)}</p>
                  <h2>{nextBooking.serviceName || `Услуга #${nextBooking.serviceId}`}</h2>
                  <p className="client-next-master"><User size={16} /> Мастер: <strong>{nextBooking.barberName || 'Не указан'}</strong></p>
                  <div className="client-next-badges">
                    <span className="ready"><CheckCircle2 size={13} /> Запись подтверждена</span>
                    <span className={isTelegramLinked ? 'ready' : 'attention'}><Send size={13} /> Telegram {isTelegramLinked ? 'подключён' : 'не подключён'}</span>
                  </div>
                </div>
                <div className="client-next-actions">
                  <button onClick={() => setRescheduleTarget(nextBooking)}><CalendarClock size={16} /> Перенести</button>
                  <button className="danger" onClick={() => setCancelTarget(nextBooking)}><XCircle size={16} /> Отменить</button>
                </div>
              </div>
            </section>
          )}

          {/* Upcoming Bookings */}
          <div className="client-bookings-section" style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#18181B', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#C5A55A" />
              <span>Предстоящие записи ({upcomingBookings.length})</span>
            </h2>

            {upcomingBookings.length === 0 ? (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '36px 24px',
                textAlign: 'center',
                border: '1px dashed rgba(0,0,0,0.1)',
                color: '#71717A',
              }}>
                <Calendar size={32} color="#A1A1AA" style={{ margin: '0 auto 12px' }} />
                <p style={{ margin: '0 0 16px', fontSize: '0.95rem' }}>У вас нет предстоящих записей</p>
                <Link
                  to="/"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#C5A55A',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    textDecoration: 'none',
                  }}
                >
                  Выбрать услугу и записаться →
                </Link>
              </div>
            ) : (
              <div className="client-bookings-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {upcomingBookings.map((b) => {
                  const startsAt = b.startsAt || b.start_time;
                  const price = b.servicePriceCents ? (b.servicePriceCents / 100).toLocaleString('ru-RU') : null;

                  return (
                    <div
                      className="client-booking-card"
                      key={b.id}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '20px 24px',
                        border: '1px solid rgba(0,0,0,0.07)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#F0FDF4',
                            color: '#16A34A',
                            border: '1px solid #BBF7D0',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                          }}>
                            <CheckCircle2 size={12} /> Предстоящая
                          </span>
                          {b.clientConfirmedAt && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#F0F9FF',
                              color: '#0369A1',
                              border: '1px solid #BAE6FD',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                            }}>
                              ✅ Подтверждено
                            </span>
                          )}
                          {price && (
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#C5A55A' }}>
                              {price} ₸
                            </span>
                          )}
                        </div>

                        <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: '700', color: '#18181B' }}>
                          {b.serviceName || `Услуга #${b.serviceId}`}
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', color: '#71717A', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={14} color="#C5A55A" />
                            <strong style={{ color: '#18181B' }}>{formatDate(startsAt)}</strong>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={14} color="#C5A55A" />
                            <strong style={{ color: '#18181B' }}>{formatTime(startsAt)}</strong>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <User size={14} />
                            <span>Мастер: <strong>{b.barberName || 'Не указан'}</strong></span>
                          </span>
                        </div>
                      </div>

                      {/* Buttons: Reschedule & Cancel */}
                      <div className="client-booking-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => setRescheduleTarget(b)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 15px',
                            borderRadius: '12px',
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            color: '#D97706',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <CalendarClock size={15} />
                          Перенести
                        </button>

                        <button
                          onClick={() => setCancelTarget(b)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 15px',
                            borderRadius: '12px',
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            color: '#DC2626',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <XCircle size={15} />
                          Отменить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past / Cancelled Bookings */}
          {pastBookings.length > 0 && (
            <div className="client-history-section">
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#71717A', marginBottom: '16px' }}>
                История визитов ({pastBookings.length})
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.9 }}>
                {pastBookings.map((b) => {
                  const startsAt = b.startsAt || b.start_time;
                  const statusInfo = getStatusInfo(b);

                  return (
                    <div
                      className="client-history-card"
                      key={b.id}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '14px',
                        padding: '16px 20px',
                        border: '1px solid rgba(0,0,0,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: '700', color: '#18181B' }}>
                          {b.serviceName || `Услуга #${b.serviceId}`}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', color: '#71717A', fontSize: '0.82rem' }}>
                          <span>{formatDate(startsAt)} в {formatTime(startsAt)}</span>
                          <span>Мастер: {b.barberName || 'Не указан'}</span>
                        </div>
                      </div>
                      {b.attendanceStatus === 'attended' && !b.hasReview && (
                        <button onClick={() => openReview(b)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', background: '#FFFBEB', border: '1px solid #FDE68A', color: '#A16207', fontWeight: '700', cursor: 'pointer' }}>
                          <Star size={15} /> Оценить мастера
                        </button>
                      )}

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: statusInfo.className === 'cancelled' ? '#FEF2F2' : '#F4F4F5',
                        color: statusInfo.className === 'cancelled' ? '#DC2626' : '#71717A',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
