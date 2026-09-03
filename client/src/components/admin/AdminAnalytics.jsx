import React, { useMemo, useState } from 'react';
import { CalendarCheck2, CircleAlert, Scissors, TrendingUp, UserCheck, Users, Wallet } from 'lucide-react';

const money = (cents) => `${Math.round(Number(cents || 0) / 100).toLocaleString('ru-RU')} ₸`;
const dayKey = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export default function AdminAnalytics({ bookings = [] }) {
  const [period, setPeriod] = useState('30');

  const analytics = useMemo(() => {
    const now = new Date();
    const days = period === 'all' ? null : Number(period);
    const cutoff = days ? new Date(now.getTime() - days * 86400000) : null;
    const scoped = bookings.filter((booking) => {
      const startsAt = new Date(booking.startsAt || booking.start_time);
      return Number.isFinite(startsAt.getTime()) && (!cutoff || startsAt >= cutoff) && startsAt <= now;
    });
    const attended = scoped.filter((booking) => booking.attendanceStatus === 'attended' && booking.status !== 'cancelled');
    const noShows = scoped.filter((booking) => booking.attendanceStatus === 'no_show').length;
    const cancelled = scoped.filter((booking) => booking.status === 'cancelled').length;
    const pendingPast = scoped.filter((booking) => booking.status === 'confirmed' && booking.attendanceStatus === 'pending').length;
    const revenueCents = attended.reduce((sum, booking) => sum + Number(booking.servicePriceCents || 0), 0);
    const attendanceBase = attended.length + noShows;

    const serviceMap = new Map();
    const masterMap = new Map();
    attended.forEach((booking) => {
      const serviceName = booking.serviceName || 'Услуга';
      const service = serviceMap.get(serviceName) || { name: serviceName, visits: 0, revenueCents: 0 };
      service.visits += 1;
      service.revenueCents += Number(booking.servicePriceCents || 0);
      serviceMap.set(serviceName, service);

      const masterName = booking.barberName || 'Мастер не указан';
      const master = masterMap.get(masterName) || { name: masterName, visits: 0, revenueCents: 0 };
      master.visits += 1;
      master.revenueCents += Number(booking.servicePriceCents || 0);
      masterMap.set(masterName, master);
    });

    const chartDays = Math.min(days || 30, 30);
    const daily = Array.from({ length: chartDays }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (chartDays - index - 1));
      return { key: dayKey(date), date, revenueCents: 0, visits: 0 };
    });
    const dailyMap = new Map(daily.map((item) => [item.key, item]));
    attended.forEach((booking) => {
      const item = dailyMap.get(dayKey(new Date(booking.startsAt || booking.start_time)));
      if (item) { item.visits += 1; item.revenueCents += Number(booking.servicePriceCents || 0); }
    });

    return {
      total: scoped.length, attended: attended.length, noShows, cancelled, pendingPast, revenueCents,
      attendanceRate: attendanceBase ? Math.round((attended.length / attendanceBase) * 100) : 0,
      averageCheck: attended.length ? Math.round(revenueCents / attended.length) : 0,
      services: [...serviceMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 5),
      masters: [...masterMap.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5),
      daily,
      maxDailyRevenue: Math.max(1, ...daily.map((item) => item.revenueCents)),
    };
  }, [bookings, period]);

  return <div className="admin-analytics-page">
    <div className="analytics-period-bar"><div><h2>Показатели бизнеса</h2><p>Фактическая выручка считается только по клиентам, отмеченным как пришедшие.</p></div><div>{[['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней'], ['all', 'Всё время']].map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{label}</button>)}</div></div>

    <div className="analytics-metrics-grid">
      <article><Wallet size={20} /><span>Фактическая выручка</span><strong>{money(analytics.revenueCents)}</strong><small>{analytics.attended} оплаченных визитов</small></article>
      <article><TrendingUp size={20} /><span>Средний чек</span><strong>{money(analytics.averageCheck)}</strong><small>На завершённый визит</small></article>
      <article><UserCheck size={20} /><span>Посещаемость</span><strong>{analytics.attendanceRate}%</strong><small>{analytics.noShows} неявок</small></article>
      <article><CircleAlert size={20} /><span>Требуют отметки</span><strong>{analytics.pendingPast}</strong><small>Прошедшие записи без результата</small></article>
    </div>

    <section className="analytics-revenue-card"><div className="analytics-section-heading"><div><h3>Динамика выручки</h3><p>Последние {analytics.daily.length} дней выбранного периода</p></div><strong>{money(analytics.revenueCents)}</strong></div><div className="analytics-chart">{analytics.daily.map((item, index) => <div className="analytics-chart-column" key={item.key} title={`${item.date.toLocaleDateString('ru-RU')}: ${money(item.revenueCents)}, визитов: ${item.visits}`}><span>{item.revenueCents > 0 ? money(item.revenueCents) : ''}</span><i style={{ height: `${Math.max(item.revenueCents ? 8 : 2, Math.round((item.revenueCents / analytics.maxDailyRevenue) * 100))}%` }} /><small>{index === 0 || index === analytics.daily.length - 1 || analytics.daily.length <= 7 ? item.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}</small></div>)}</div></section>

    <div className="analytics-rankings-grid">
      <section><div className="analytics-section-heading"><div><h3><Scissors size={17} /> Популярные услуги</h3><p>По завершённым визитам</p></div></div>{analytics.services.length === 0 ? <div className="analytics-empty">Недостаточно завершённых визитов</div> : analytics.services.map((service, index) => <div className="analytics-ranking-row" key={service.name}><b>{index + 1}</b><span><strong>{service.name}</strong><small>{service.visits} визитов</small></span><em>{money(service.revenueCents)}</em></div>)}</section>
      <section><div className="analytics-section-heading"><div><h3><Users size={17} /> Загрузка мастеров</h3><p>По фактической выручке</p></div></div>{analytics.masters.length === 0 ? <div className="analytics-empty">Недостаточно завершённых визитов</div> : analytics.masters.map((master, index) => <div className="analytics-ranking-row" key={master.name}><b>{index + 1}</b><span><strong>{master.name}</strong><small>{master.visits} визитов</small></span><em>{money(master.revenueCents)}</em></div>)}</section>
    </div>

    <div className="analytics-quality-strip"><div><CalendarCheck2 size={18} /><span>Записей в периоде</span><strong>{analytics.total}</strong></div><div><UserCheck size={18} /><span>Пришли</span><strong>{analytics.attended}</strong></div><div><CircleAlert size={18} /><span>Не пришли</span><strong>{analytics.noShows}</strong></div><div><CircleAlert size={18} /><span>Отменены</span><strong>{analytics.cancelled}</strong></div></div>
  </div>;
}
