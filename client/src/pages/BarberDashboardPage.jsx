import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Camera, CheckCircle2, ChevronDown, CircleAlert, Clock3, Coffee, Loader2, LogOut, MessageSquareText, NotebookPen, Phone, Plus, Save, Send, Star, Timer, Trash2, Users, X } from 'lucide-react';
import { createMasterTimeBlock, deleteMasterTimeBlock, getBarberBookings, getBarberProfile, getMasterReviews, getMasterTimeBlocks, markBookingAttendance, saveMasterClientNote, uploadOwnMasterPhoto } from '../api/barberApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import './BarberDashboardPage.css';

const formatDateTime = (value) => new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const localDay = (value) => new Date(value).toDateString();
const toDateTimeInput = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function BarberDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('today');
  const [timeBlocks, setTimeBlocks] = useState([]);
  const [reviewData, setReviewData] = useState({ reviews: [], summary: {}, distribution: {} });
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [blockFormOpen, setBlockFormOpen] = useState(false);
  const [blockStartsAt, setBlockStartsAt] = useState('');
  const [blockEndsAt, setBlockEndsAt] = useState('');
  const [blockReason, setBlockReason] = useState('Перерыв');
  const [blockSaving, setBlockSaving] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteValue, setNoteValue] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const photoInputRef = useRef(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [profileData, bookingsData, blocksData, reviewsData] = await Promise.all([getBarberProfile(), getBarberBookings(), getMasterTimeBlocks(), getMasterReviews()]);
      setProfile(profileData);
      setBookings(bookingsData);
      setTimeBlocks(blocksData);
      setReviewData(reviewsData);
    } catch (err) {
      if (err.status === 401) navigate('/login');
      else setError(err.message || 'Не удалось загрузить записи');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const activeBookings = useMemo(() => bookings.filter((booking) => booking.status !== 'cancelled'), [bookings]);
  const nextBooking = useMemo(() => activeBookings.find((booking) => booking.attendanceStatus === 'pending' && new Date(booking.endsAt) >= new Date()) || null, [activeBookings]);
  const visibleBookings = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 86400000);
    return bookings.filter((booking) => {
      const startsAt = new Date(booking.startsAt);
      if (filter === 'today') return localDay(startsAt) === localDay(now);
      if (filter === 'week') return startsAt >= now && startsAt <= weekEnd;
      return true;
    });
  }, [bookings, filter]);

  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    const todayBookings = activeBookings.filter((booking) => localDay(booking.startsAt) === today);
    return {
      today: todayBookings.length,
      pending: todayBookings.filter((booking) => booking.attendanceStatus === 'pending').length,
      attended: todayBookings.filter((booking) => booking.attendanceStatus === 'attended').length,
    };
  }, [activeBookings]);
  const masterReviewSummary = reviewData.summary || {};
  const displayedReviews = reviewsExpanded ? reviewData.reviews : reviewData.reviews.slice(0, 3);

  const updateAttendance = async (bookingId, attendanceStatus) => {
    setUpdatingId(bookingId);
    setError('');
    try {
      const result = await markBookingAttendance(bookingId, attendanceStatus);
      setBookings((current) => current.map((booking) => booking.id === bookingId ? { ...booking, attendanceStatus: result.attendanceStatus, clientRating: result.clientRating ?? booking.clientRating } : booking));
    } catch (err) {
      setError(err.message || 'Не удалось обновить статус');
    } finally {
      setUpdatingId(null);
    }
  };
  const handleLogout = async () => { await logout(); navigate('/login'); };
  const changeProfilePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Выберите фотографию в формате JPEG, PNG или WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер фотографии не должен превышать 5 МБ');
      return;
    }
    setPhotoSaving(true);
    try {
      const updated = await uploadOwnMasterPhoto(file);
      setProfile((current) => ({ ...current, ...updated }));
    } catch (err) {
      setError(err.message || 'Не удалось обновить фотографию');
    } finally {
      setPhotoSaving(false);
    }
  };
  const openBlockForm = () => {
    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setBlockStartsAt(toDateTimeInput(start));
    setBlockEndsAt(toDateTimeInput(end));
    setBlockReason('Перерыв');
    setBlockFormOpen(true);
  };
  const applyQuickDuration = (minutes, reason) => {
    const start = blockStartsAt ? new Date(blockStartsAt) : new Date();
    setBlockStartsAt(toDateTimeInput(start));
    setBlockEndsAt(toDateTimeInput(new Date(start.getTime() + minutes * 60000)));
    setBlockReason(reason);
  };
  const createTimeBlock = async (event) => {
    event.preventDefault();
    setBlockSaving(true);
    setError('');
    try {
      const created = await createMasterTimeBlock({ startsAt: blockStartsAt, endsAt: blockEndsAt, reason: blockReason });
      setTimeBlocks((current) => [...current, created].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
      setBlockFormOpen(false);
      setBlockStartsAt('');
      setBlockEndsAt('');
      setBlockReason('Перерыв');
    } catch (err) {
      setError(err.message || 'Не удалось создать перерыв');
    } finally {
      setBlockSaving(false);
    }
  };
  const removeTimeBlock = async (blockId) => {
    setError('');
    try {
      await deleteMasterTimeBlock(blockId);
      setTimeBlocks((current) => current.filter((block) => block.id !== blockId));
    } catch (err) {
      setError(err.message || 'Не удалось удалить перерыв');
    }
  };
  const openClientNote = (booking) => {
    setNoteTarget(booking);
    setNoteValue(booking.clientNote || '');
  };
  const saveClientNote = async (event) => {
    event.preventDefault();
    if (!noteTarget) return;
    setNoteSaving(true);
    setError('');
    try {
      const result = await saveMasterClientNote(noteTarget.clientPhone, noteValue);
      setBookings((current) => current.map((booking) => booking.clientPhone === noteTarget.clientPhone ? { ...booking, clientNote: result.note } : booking));
      setNoteTarget(null);
    } catch (err) {
      setError(err.message || 'Не удалось сохранить заметку');
    } finally {
      setNoteSaving(false);
    }
  };
  if (loading) return <div className="barber-page-state"><Loader2 className="spin" /> Загрузка кабинета…</div>;

  return (
    <div className="barber-dashboard">
      <header className="barber-dashboard-header">
        <div className="barber-profile-heading">
          <button type="button" className="barber-profile-photo" onClick={() => !photoSaving && photoInputRef.current?.click()} aria-label="Изменить фотографию профиля" disabled={photoSaving}>
            {profile?.photoUrl ? <img src={profile.photoUrl} alt={`Фотография мастера ${profile.name}`} /> : <span>{String(profile?.name || 'М').charAt(0).toUpperCase()}</span>}
            <i>{photoSaving ? <Loader2 size={17} className="spin" /> : <Camera size={17} />}</i>
          </button>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={changeProfilePhoto} hidden />
          <div><p className="barber-dashboard-kicker">Рабочий кабинет</p><h1>{profile?.name || 'Мастер'}</h1><button type="button" className="barber-change-photo" onClick={() => photoInputRef.current?.click()} disabled={photoSaving}>{photoSaving ? 'Загружаем…' : 'Изменить фотографию'}</button></div>
        </div>
        <button className="barber-logout" onClick={handleLogout}><LogOut size={16} /> Выйти</button>
      </header>

      {error && <div className="barber-error">{error}</div>}

      {nextBooking && (
        <section className="barber-next-client">
          <div className="barber-next-label"><Timer size={16} /> Следующий клиент</div>
          <div className="barber-next-content">
            <div><time>{formatDateTime(nextBooking.startsAt)}</time><h2>{nextBooking.clientName}</h2><p>{nextBooking.serviceName}</p></div>
            <div className="barber-next-contact"><a href={`tel:${nextBooking.clientPhone}`}><Phone size={16} /> {nextBooking.clientPhone}</a><span><Star size={14} fill="currentColor" /> Рейтинг клиента {Number(nextBooking.clientRating || 5).toFixed(2)}</span></div>
          </div>
        </section>
      )}

      <section className="barber-metrics">
        <div><Clock3 size={20} /><span>Сегодня</span><strong>{metrics.today}</strong></div>
        <div><Users size={20} /><span>Ожидают</span><strong>{metrics.pending}</strong></div>
        <div><CheckCircle2 size={20} /><span>Пришли</span><strong>{metrics.attended}</strong></div>
      </section>

      <section className="barber-feedback-panel">
        <div className="barber-feedback-heading">
          <div><span><MessageSquareText size={18} /></span><div><h2>Моя оценка</h2><p>Отзывы клиентов после завершённых визитов</p></div></div>
          <div className="barber-score"><Star size={19} fill="currentColor" /><strong>{Number(masterReviewSummary.total || 0) ? Number(masterReviewSummary.averageRating).toFixed(2) : '—'}</strong><small>{Number(masterReviewSummary.total || 0)} отзывов</small></div>
        </div>
        {Number(masterReviewSummary.total || 0) === 0 ? (
          <div className="barber-feedback-empty"><Star size={24} /><div><strong>Оценок пока нет</strong><p>После визита клиент получит просьбу оценить услугу на сайте или в Telegram.</p></div></div>
        ) : (
          <>
            <div className="barber-feedback-overview">
              <div className="barber-rating-bars">
                {[5, 4, 3, 2, 1].map((value) => {
                  const count = Number(reviewData.distribution?.[value] || 0);
                  const width = `${Math.round((count / Number(masterReviewSummary.total)) * 100)}%`;
                  return <div key={value}><span>{value}<Star size={11} fill="currentColor" /></span><i><b style={{ width }} /></i><small>{count}</small></div>;
                })}
              </div>
              <div className="barber-feedback-facts"><div><MessageSquareText size={16} /><span>С комментарием</span><strong>{Number(masterReviewSummary.withComment || 0)}</strong></div><div><Send size={16} /><span>Из Telegram</span><strong>{Number(masterReviewSummary.fromTelegram || 0)}</strong></div></div>
            </div>
            <div className="barber-reviews-list">
              {displayedReviews.map((review) => <article key={review.id} className={review.commentHidden ? 'hidden-publicly' : ''}>
                <div><span className="barber-review-avatar">{String(review.clientName || 'К').charAt(0).toUpperCase()}</span><span><strong>{review.clientName || 'Клиент'}</strong><small>{review.serviceName} · {new Date(`${String(review.createdAt).replace(' ', 'T')}Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small></span><span className="barber-review-stars">{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={13} fill={value <= review.rating ? 'currentColor' : 'none'} className={value <= review.rating ? 'active' : ''} />)}</span></div>
                <p>{review.comment || 'Клиент оставил оценку без комментария.'}</p>
                <footer><span className={review.source === 'telegram' ? 'telegram' : 'website'}>{review.source === 'telegram' ? <Send size={12} /> : <MessageSquareText size={12} />}{review.source === 'telegram' ? 'Telegram' : 'Сайт'}</span>{review.commentHidden && <small>Комментарий скрыт с публичной страницы</small>}</footer>
              </article>)}
            </div>
            {reviewData.reviews.length > 3 && <button className="barber-reviews-toggle" onClick={() => setReviewsExpanded((current) => !current)}>{reviewsExpanded ? 'Свернуть отзывы' : `Показать все · ${reviewData.reviews.length}`}<ChevronDown size={15} className={reviewsExpanded ? 'rotated' : ''} /></button>}
          </>
        )}
      </section>

      <section className="barber-blocks-panel">
        <div className="barber-blocks-heading">
          <div><Coffee size={19} /><div><h2>Перерывы и недоступное время</h2><p>В это время клиенты не смогут записаться.</p></div></div>
          <button onClick={openBlockForm}><Plus size={16} /> Добавить перерыв</button>
        </div>
        {timeBlocks.length === 0 && <p className="barber-blocks-empty">Ближайших перерывов нет — расписание полностью открыто.</p>}
        {timeBlocks.length > 0 && <div className="barber-block-list">{timeBlocks.map((block) => <div key={block.id}><span><strong>{block.reason || 'Недоступно'}</strong><small>{formatDateTime(block.startsAt)} — {new Date(block.endsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small></span><button title="Удалить перерыв" onClick={() => removeTimeBlock(block.id)}><Trash2 size={15} /></button></div>)}</div>}
      </section>

      {blockFormOpen && (
        <div className="barber-block-modal-backdrop" onClick={() => !blockSaving && setBlockFormOpen(false)}>
          <form className="barber-block-modal" onSubmit={createTimeBlock} onClick={(event) => event.stopPropagation()}>
            <div className="barber-block-modal-header"><div><span><Coffee size={17} /></span><div><h2>Добавить перерыв</h2><p>Свободные слоты внутри интервала исчезнут для клиентов.</p></div></div><button type="button" onClick={() => setBlockFormOpen(false)}><X size={18} /></button></div>
            <div className="barber-quick-blocks"><span>Быстрый выбор</span><div><button type="button" onClick={() => applyQuickDuration(30, 'Короткий перерыв')}>30 минут</button><button type="button" onClick={() => applyQuickDuration(60, 'Обед')}>Обед · 1 час</button><button type="button" onClick={() => applyQuickDuration(120, 'Личное время')}>2 часа</button></div></div>
            <div className="barber-block-fields"><label>Начало<input type="datetime-local" required value={blockStartsAt} onChange={(event) => setBlockStartsAt(event.target.value)} /></label><label>Окончание<input type="datetime-local" required value={blockEndsAt} onChange={(event) => setBlockEndsAt(event.target.value)} /></label></div>
            <label className="barber-block-reason">Причина<input type="text" maxLength="100" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} placeholder="Например: обед" /></label>
            <div className="barber-block-modal-actions"><button type="button" onClick={() => setBlockFormOpen(false)}>Отмена</button><button type="submit" disabled={blockSaving}>{blockSaving ? <Loader2 size={15} className="spin" /> : <Coffee size={15} />} Сохранить перерыв</button></div>
          </form>
        </div>
      )}

      <section className="barber-bookings-panel">
        <div className="barber-panel-heading">
          <div><h2>Моё расписание</h2><span>{visibleBookings.length}</span></div>
          <div className="barber-filter-tabs">
            {[['today', 'Сегодня'], ['week', '7 дней'], ['all', 'Все']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
        </div>
        {visibleBookings.length === 0 ? <p className="barber-empty"><CalendarDays size={22} /> Записей за выбранный период нет.</p> : (
          <div className="barber-booking-list">
            {visibleBookings.map((booking) => {
              const canMarkAttended = new Date(booking.startsAt).getTime() - Date.now() <= 2 * 60 * 60 * 1000;
              const canMarkNoShow = new Date(booking.endsAt).getTime() <= Date.now();
              return <article className={`barber-booking-card ${booking.status === 'cancelled' ? 'cancelled' : ''}`} key={booking.id}>
                <div className="barber-booking-main"><div className="barber-booking-time">{formatDateTime(booking.startsAt)}</div><h3>{booking.clientName}</h3><p>{booking.serviceName} · <a href={`tel:${booking.clientPhone}`}>{booking.clientPhone}</a></p>{booking.clientNote && <p className="barber-client-note"><NotebookPen size={13} /> {booking.clientNote}</p>}<span className="barber-rating"><Star size={14} fill="currentColor" /> {Number(booking.clientRating || 5).toFixed(2)}</span></div>
                <div className="barber-booking-actions">
                  <button className="barber-note-button" onClick={() => openClientNote(booking)}><NotebookPen size={15} /> {booking.clientNote ? 'Изменить заметку' : 'Добавить заметку'}</button>
                  {booking.status === 'cancelled' ? <span className="barber-status cancelled">Отменена</span>
                    : booking.attendanceStatus === 'attended' ? <span className="barber-status attended">Клиент пришёл</span>
                    : booking.attendanceStatus === 'no_show' ? <span className="barber-status no-show">Не пришёл</span>
                    : <><button title={canMarkAttended ? '' : 'Доступно за 2 часа до визита'} disabled={updatingId === booking.id || !canMarkAttended} onClick={() => updateAttendance(booking.id, 'attended')} className="barber-attendance attend"><CheckCircle2 size={15} /> Пришёл</button><button title={canMarkNoShow ? '' : 'Доступно после окончания записи'} disabled={updatingId === booking.id || !canMarkNoShow} onClick={() => updateAttendance(booking.id, 'no_show')} className="barber-attendance no-show"><CircleAlert size={15} /> Не пришёл</button></>}
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      {noteTarget && (
        <div className="barber-block-modal-backdrop" onClick={() => !noteSaving && setNoteTarget(null)}>
          <form className="barber-note-modal" onSubmit={saveClientNote} onClick={(event) => event.stopPropagation()}>
            <div className="barber-block-modal-header"><div><span><NotebookPen size={17} /></span><div><h2>Заметка о клиенте</h2><p>{noteTarget.clientName} · {noteTarget.clientPhone}</p></div></div><button type="button" onClick={() => setNoteTarget(null)}><X size={18} /></button></div>
            <div className="barber-note-body"><label htmlFor="master-client-note">Предпочтения и важные детали</label><textarea id="master-client-note" maxLength="500" rows="6" value={noteValue} onChange={(event) => setNoteValue(event.target.value)} placeholder="Например: предпочитает короткие виски, чувствительная кожа…" /><span>{noteValue.length}/500</span><p>Заметку видите только вы. Она появится во всех будущих записях этого клиента.</p></div>
            <div className="barber-block-modal-actions"><button type="button" onClick={() => setNoteTarget(null)}>Отмена</button><button type="submit" disabled={noteSaving}>{noteSaving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Сохранить</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
