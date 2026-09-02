import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  MessageSquareText,
  Send,
  Star,
} from 'lucide-react';
import { getAdminReviews, setReviewCommentVisibility } from '../../api/adminApi.js';

function formatDate(value) {
  if (!value) return '';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(normalized));
}

export default function AdminReviews({ onAuthError }) {
  const [data, setData] = useState({ reviews: [], summary: {}, distribution: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [masterId, setMasterId] = useState('all');
  const [rating, setRating] = useState('all');
  const [source, setSource] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getAdminReviews());
    } catch (requestError) {
      if (requestError.status === 401) return onAuthError?.();
      setError(requestError.message || 'Не удалось загрузить отзывы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const masters = useMemo(() => {
    const unique = new Map();
    data.reviews.forEach((review) => unique.set(review.masterId, review.masterName));
    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [data.reviews]);

  const filteredReviews = useMemo(() => data.reviews.filter((review) => (
    (masterId === 'all' || String(review.masterId) === masterId)
    && (rating === 'all' || String(review.rating) === rating)
    && (source === 'all' || review.source === source)
  )), [data.reviews, masterId, rating, source]);

  const toggleVisibility = async (review) => {
    setUpdatingId(review.id);
    setError('');
    try {
      const result = await setReviewCommentVisibility(review.id, !review.commentHidden);
      setData((current) => ({
        ...current,
        reviews: current.reviews.map((item) => item.id === review.id
          ? { ...item, commentHidden: result.commentHidden }
          : item),
        summary: {
          ...current.summary,
          hiddenComments: Math.max(0, Number(current.summary.hiddenComments || 0) + (result.commentHidden ? 1 : -1)),
        },
      }));
    } catch (requestError) {
      if (requestError.status === 401) return onAuthError?.();
      setError(requestError.message || 'Не удалось изменить видимость отзыва');
    } finally {
      setUpdatingId(null);
    }
  };

  const summary = data.summary || {};
  const total = Number(summary.total || 0);

  if (loading) return <div className="admin-reviews-loading"><Loader2 className="spin" size={22} /> Загружаем отзывы…</div>;

  return (
    <div className="admin-reviews-page">
      {error && <div className="admin-error-banner"><span>{error}</span></div>}

      <div className="reviews-summary-grid">
        <article><Star size={20} fill="currentColor" /><span>Средняя оценка</span><strong>{total ? Number(summary.averageRating).toFixed(2) : '—'}</strong><small>{total} оценок</small></article>
        <article><MessageSquareText size={20} /><span>С комментарием</span><strong>{Number(summary.withComment || 0)}</strong><small>Полезная обратная связь</small></article>
        <article><Send size={20} /><span>Из Telegram</span><strong>{Number(summary.fromTelegram || 0)}</strong><small>Оставили через бота</small></article>
        <article><EyeOff size={20} /><span>Скрытые тексты</span><strong>{Number(summary.hiddenComments || 0)}</strong><small>Оценки продолжают учитываться</small></article>
      </div>

      <section className="reviews-workspace">
        <div className="reviews-toolbar">
          <div><h2>Отзывы клиентов</h2><p>Управляйте публикацией текста, не меняя оценку клиента.</p></div>
          <div className="reviews-filters">
            <select value={masterId} onChange={(event) => setMasterId(event.target.value)} aria-label="Фильтр по мастеру">
              <option value="all">Все мастера</option>
              {masters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}
            </select>
            <select value={rating} onChange={(event) => setRating(event.target.value)} aria-label="Фильтр по оценке">
              <option value="all">Все оценки</option>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} звёзд</option>)}
            </select>
            <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Фильтр по источнику">
              <option value="all">Все источники</option>
              <option value="telegram">Telegram</option>
              <option value="website">Сайт</option>
            </select>
          </div>
        </div>

        <div className="reviews-content-grid">
          <aside className="reviews-distribution">
            <h3>Распределение</h3>
            {[5, 4, 3, 2, 1].map((value) => {
              const count = Number(data.distribution?.[value] || 0);
              const width = total ? `${Math.round((count / total) * 100)}%` : '0%';
              return <div className="review-distribution-row" key={value}><span>{value} <Star size={12} fill="currentColor" /></span><div><i style={{ width }} /></div><strong>{count}</strong></div>;
            })}
          </aside>

          <div className="reviews-list">
            {filteredReviews.length === 0 ? (
              <div className="reviews-empty"><MessageSquareText size={28} /><h3>Отзывов пока нет</h3><p>Они появятся после завершённых визитов и оценок клиентов.</p></div>
            ) : filteredReviews.map((review) => (
              <article className={`admin-review-card ${review.commentHidden ? 'is-hidden' : ''}`} key={review.id}>
                <div className="admin-review-top">
                  <div className="admin-review-avatar">{String(review.clientName || 'К').trim().charAt(0).toUpperCase()}</div>
                  <div className="admin-review-client"><strong>{review.clientName || 'Клиент'}</strong><span>{review.serviceName} · {review.masterName}</span></div>
                  <div className="admin-review-rating">{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={15} fill={value <= review.rating ? 'currentColor' : 'none'} className={value <= review.rating ? 'filled' : ''} />)}</div>
                </div>
                {review.comment ? <p className="admin-review-comment">{review.comment}</p> : <p className="admin-review-comment empty">Клиент оставил только оценку без комментария.</p>}
                <div className="admin-review-footer">
                  <span className={`review-source ${review.source}`}>{review.source === 'telegram' ? <Send size={13} /> : <Globe2 size={13} />}{review.source === 'telegram' ? 'Telegram' : 'Сайт'}</span>
                  <time>{formatDate(review.createdAt)}</time>
                  {review.comment && <button disabled={updatingId === review.id} onClick={() => toggleVisibility(review)}>{updatingId === review.id ? <Loader2 className="spin" size={14} /> : review.commentHidden ? <Eye size={14} /> : <EyeOff size={14} />}{review.commentHidden ? 'Вернуть на сайт' : 'Скрыть текст'}</button>}
                </div>
                {review.commentHidden && <div className="review-hidden-notice"><EyeOff size={13} /> Текст скрыт с публичной страницы, оценка сохранена.</div>}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
