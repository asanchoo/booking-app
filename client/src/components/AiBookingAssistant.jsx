import React, { useEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, ExternalLink, Loader2, LockKeyhole, MessageCircle, Send, ShieldCheck, Sparkles, UserPlus, X } from 'lucide-react';
import { confirmAiBooking, fetchAiStatus, sendAiMessage } from '../api/aiApi.js';
import { registerClient } from '../api/clientAuthApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import './AiBookingAssistant.css';

const welcome = {
  role: 'assistant',
  content: 'Здравствуйте! Помогу выбрать услугу и найти удобное время для записи. С чего начнём?',
  actions: [
    { type: 'reply', label: 'Посмотреть услуги', message: 'Покажи услуги и цены' },
    { type: 'reply', label: 'Найти время на завтра', message: 'Хочу записаться завтра' },
  ],
};

function formatSlot(startsAt) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(startsAt));
}

export default function AiBookingAssistant() {
  const { authenticated, role, userInfo, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [bookingContext, setBookingContext] = useState({ serviceId: null, serviceName: null, masterId: null, masterName: null, date: null });
  const [proposal, setProposal] = useState(null);
  const [form, setForm] = useState({ clientName: '', clientPhone: '' });
  const [bookingState, setBookingState] = useState({ loading: false, error: '', result: null });
  const [accountForm, setAccountForm] = useState({ password: '', confirmPassword: '' });
  const [accountState, setAccountState] = useState({ loading: false, error: '', exists: false });
  const endRef = useRef(null);

  useEffect(() => { fetchAiStatus().then(setStatus).catch(() => setStatus({ provider: 'demo' })); }, []);
  useEffect(() => {
    if (authenticated && role === 'client') {
      setForm((current) => ({
        clientName: current.clientName || userInfo?.name || '',
        clientPhone: current.clientPhone || userInfo?.phone || '',
      }));
    }
  }, [authenticated, role, userInfo]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, proposal]);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function sendMessage(text, contextOverride = bookingContext) {
    const content = text.trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setProposal(null);

    const timeMatch = content.match(/\b(\d{1,2})[\s:.](\d{2})\b/);
    const recentSlots = [...messages].reverse().find((message) => message.actions?.some((action) => action.type === 'booking_slot'))?.actions || [];
    if (timeMatch) {
      const requestedTime = `${String(Number(timeMatch[1])).padStart(2, '0')}:${timeMatch[2]}`;
      const matchedSlot = recentSlots.find((action) => action.booking?.startsAt?.slice(11, 16) === requestedTime);
      if (matchedSlot) {
        setProposal(matchedSlot.booking);
        setMessages((current) => [...current, { role: 'assistant', content: 'Проверьте детали и подтвердите запись в форме ниже.' }]);
        return;
      }
    }

    setLoading(true);
    try {
      const history = nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })).slice(-12);
      const response = await sendAiMessage(history, contextOverride);
      if (response.context) setBookingContext(response.context);
      setMessages((current) => [...current, { role: 'assistant', content: response.message, actions: response.actions || [], provider: response.provider }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message || 'AI-помощник временно недоступен.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    setBookingState({ loading: true, error: '', result: null });
    try {
      const result = await confirmAiBooking({ ...proposal, ...form });
      setBookingState({ loading: false, error: '', result });
      setMessages((current) => [...current, { role: 'assistant', content: `Готово! Запись №${result.id} создана. Ждём вас ${formatSlot(result.startsAt)}. Ниже можно подключить Telegram-напоминания.` }]);
      setProposal(null);
    } catch (error) {
      setBookingState({ loading: false, error: error.message, result: null });
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    const { password, confirmPassword } = accountForm;
    setAccountState({ loading: false, error: '', exists: false });
    if (password.length < 6 || password.length > 72) {
      setAccountState({ loading: false, error: 'Пароль должен содержать от 6 до 72 символов.', exists: false });
      return;
    }
    if (password !== confirmPassword) {
      setAccountState({ loading: false, error: 'Пароли не совпадают.', exists: false });
      return;
    }
    setAccountState({ loading: true, error: '', exists: false });
    try {
      await registerClient({ phone: form.clientPhone, name: form.clientName, password });
      await login(form.clientPhone, password);
    } catch (error) {
      setAccountState({ loading: false, error: error.message || 'Не удалось создать личный кабинет.', exists: error.status === 409 });
    }
  }

  return (
    <div className="ai-assistant">
      {open && (
        <section className="ai-panel" role="dialog" aria-label="AI-помощник по записи">
          <header className="ai-panel__header">
            <span className="ai-panel__icon"><Sparkles size={20} /></span>
            <div><strong>{status?.provider === 'fallback' ? 'Быстрый подбор' : 'AI-консьерж'}</strong><small><i /> {status?.provider === 'gemini' ? 'Gemini AI' : (status?.provider === 'openai' ? 'OpenAI' : 'Резервный режим')} · онлайн</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть AI-помощника"><ChevronDown size={22} /></button>
          </header>

          <div className="ai-panel__privacy"><ShieldCheck size={15} /> Контакты не отправляются AI. Запись — только после подтверждения.</div>
          <div className="ai-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`ai-message ai-message--${message.role}`} key={`${message.role}-${index}`}>
                {message.role === 'assistant' && <Bot size={17} />}
                <div>
                  <p>{message.content}</p>
                  {!!message.actions?.length && (
                    <div className="ai-actions">
                      {message.actions.map((action, actionIndex) => (
                        <button key={`${action.label}-${actionIndex}`} type="button" onClick={() => {
                          if (action.type === 'booking_slot') {
                            setBookingState({ loading: false, error: '', result: null });
                            setProposal(action.booking);
                          } else {
                            const nextContext = { ...bookingContext, ...(action.selection || {}) };
                            setBookingContext(nextContext);
                            sendMessage(action.message, nextContext);
                          }
                        }}>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="ai-message ai-message--assistant"><Bot size={17} /><div className="ai-thinking"><span /><span /><span /></div></div>}

            {proposal && (
              <form className="ai-confirm" onSubmit={submitBooking}>
                <div className="ai-confirm__title"><Check size={18} /> Подтвердите запись</div>
                <dl>
                  <div><dt>Услуга</dt><dd>{proposal.serviceName}</dd></div>
                  <div><dt>Мастер</dt><dd>{proposal.masterName}</dd></div>
                  <div><dt>Время</dt><dd>{formatSlot(proposal.startsAt)}</dd></div>
                </dl>
                <label>Ваше имя<input required maxLength="80" value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} placeholder="Алексей" /></label>
                <label>Телефон<input required inputMode="tel" maxLength="24" value={form.clientPhone} onChange={(event) => setForm({ ...form, clientPhone: event.target.value })} placeholder="+7 700 000 00 00" /></label>
                {bookingState.error && <p className="ai-confirm__error">{bookingState.error}</p>}
                <button className="ai-confirm__submit" disabled={bookingState.loading} type="submit">
                  {bookingState.loading ? <Loader2 className="spinner" size={18} /> : <Check size={18} />} Подтвердить запись
                </button>
                <button className="ai-confirm__cancel" type="button" onClick={() => setProposal(null)}>Выбрать другое время</button>
              </form>
            )}
            {bookingState.result && (
              <>
                {!authenticated && (
                  <form className="ai-account-card" onSubmit={createAccount}>
                    <div className="ai-account-card__heading"><span><UserPlus size={18} /></span><div><strong>Сохраните запись в личном кабинете</strong><p>Номер и запись уже привязаны. Придумайте пароль, чтобы переносить и отменять визиты.</p></div></div>
                    <label><LockKeyhole size={13} /> Пароль<input type="password" minLength="6" maxLength="72" autoComplete="new-password" required value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} placeholder="От 6 символов" /></label>
                    <label><LockKeyhole size={13} /> Повторите пароль<input type="password" minLength="6" maxLength="72" autoComplete="new-password" required value={accountForm.confirmPassword} onChange={(event) => setAccountForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Повторите пароль" /></label>
                    {accountState.error && <p className="ai-account-card__error">{accountState.error}</p>}
                    {accountState.exists && <a className="ai-account-card__login" href="/login">У меня уже есть аккаунт — войти</a>}
                    <button type="submit" disabled={accountState.loading}>{accountState.loading ? <Loader2 size={16} className="spinner" /> : <UserPlus size={16} />} Создать кабинет</button>
                    <small>После создания вы сразу войдёте и увидите эту запись.</small>
                  </form>
                )}
                <div className="ai-telegram-card">
                  <span><Send size={19} /></span>
                  <div>
                    <strong>{bookingState.result.telegram?.linked ? 'Telegram уже привязан' : 'Получайте напоминания в Telegram'}</strong>
                    <p>{bookingState.result.telegram?.linked
                      ? 'Бот пришлёт напоминание и позволит управлять записью.'
                      : 'Привяжите Telegram к номеру записи — бот напомнит о визите и после услуги попросит оставить оценку.'}</p>
                    {bookingState.result.telegram?.link && (
                      <a href={bookingState.result.telegram.link} target="_blank" rel="noreferrer">
                        Привязать Telegram <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
            <div ref={endRef} />
          </div>

          <form className="ai-input" onSubmit={(event) => { event.preventDefault(); sendMessage(input); }}>
            <input aria-label="Сообщение AI-помощнику" maxLength="1200" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Например: стрижка завтра…" />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Отправить"><Send size={19} /></button>
          </form>
        </section>
      )}
      <button className={`ai-launcher ${open ? 'ai-launcher--open' : ''}`} type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Закрыть AI-помощника' : 'Открыть AI-помощника'}>
        {open ? <X size={23} /> : <MessageCircle size={24} />}<span>{open ? 'Закрыть' : 'Подобрать запись с AI'}</span>
      </button>
    </div>
  );
}
