import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { registerClient, sendForgotPasswordCode, resetForgotPassword } from '../api/clientAuthApi.js';
import { Scissors, User, KeyRound, AlertCircle, Loader2, ArrowLeft, CheckCircle2, Phone } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  // Modes: 'login' | 'register' | 'forgot_step1' | 'forgot_step2'
  const [mode, setMode] = useState('login');

  // Login form state
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');

  // Register form state
  const [regPhone, setRegPhone] = useState('+7 ');
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Forgot password state
  const [forgotPhone, setForgotPhone] = useState('+7 ');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Helper phone mask for +7 (XXX) XXX-XX-XX
  const formatPhone = (input) => {
    let digits = input.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (!digits.startsWith('7')) digits = '7' + digits;
    digits = digits.slice(0, 11);

    let formatted = '+7';
    if (digits.length > 1) formatted += ' (' + digits.substring(1, 4);
    if (digits.length >= 4) formatted += ') ' + digits.substring(4, 7);
    if (digits.length >= 7) formatted += '-' + digits.substring(7, 9);
    if (digits.length >= 9) formatted += '-' + digits.substring(9, 11);
    return formatted;
  };

  const clearMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  // 1. Submit Login (Admin or Client)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!loginField.trim() || !password.trim()) {
      setError('Введите телефон/логин и пароль');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(loginField.trim(), password);
      if (res?.role === 'admin') {
        navigate('/admin');
      } else if (res?.role === 'barber') {
        navigate('/barber');
      } else {
        navigate('/my-account');
      }
    } catch (err) {
      setError(err.message === 'Invalid credentials' ? 'Неверный логин или пароль' : (err.message || 'Ошибка входа'));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Submit Register (Client)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    const cleanDigits = regPhone.replace(/\D/g, '');
    if (cleanDigits.length < 11) {
      setError('Введите корректный номер телефона (11 цифр)');
      return;
    }
    if (!regName.trim()) {
      setError('Введите ваше имя');
      return;
    }
    if (regPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    try {
      await registerClient({
        phone: regPhone,
        name: regName.trim(),
        password: regPassword,
      });

      // Auto-login after registration
      const res = await login(regPhone, regPassword);
      if (res?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/my-account');
      }
    } catch (err) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Forgot Password - Step 1: Send Telegram code
  const handleForgotStep1Submit = async (e) => {
    e.preventDefault();
    clearMessages();

    const cleanDigits = forgotPhone.replace(/\D/g, '');
    if (cleanDigits.length < 11) {
      setError('Введите полный номер телефона (11 цифр)');
      return;
    }

    setIsLoading(true);
    try {
      await sendForgotPasswordCode(forgotPhone);
      setSuccessMsg(`Код подтверждения отправлен в ваш Telegram!`);
      setMode('forgot_step2');
    } catch (err) {
      setError(err.message || 'Telegram не привязан, обратитесь в поддержку');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Forgot Password - Step 2: Reset password
  const handleForgotStep2Submit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (forgotCode.trim().length !== 4) {
      setError('Введите 4-значный код из Telegram');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setError('Новый пароль должен быть не менее 6 символов');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    try {
      await resetForgotPassword({
        phone: forgotPhone,
        code: forgotCode.trim(),
        newPassword: forgotNewPassword,
      });
      setSuccessMsg('Пароль успешно изменён! Теперь вы можете войти.');
      setMode('login');
      setLoginField(forgotPhone);
      setPassword('');
    } catch (err) {
      setError(err.message || 'Неверный или истёкший код');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand-mark">
          <div className="login-icon-wrapper">
            <Scissors size={26} />
          </div>
          <span className="login-brand-name">
            BARBER<span className="login-brand-accent">SHOP</span>
          </span>
        </div>

        {/* Dynamic Titles */}
        {mode === 'login' && (
          <>
            <h1 className="login-title">Вход в аккаунт</h1>
          </>
        )}
        {mode === 'register' && (
          <>
            <h1 className="login-title">Регистрация</h1>
            <p className="login-subtitle">Создайте личный кабинет для управления записями</p>
          </>
        )}
        {(mode === 'forgot_step1' || mode === 'forgot_step2') && (
          <>
            <h1 className="login-title">Восстановление пароля</h1>
            <p className="login-subtitle">
              {mode === 'forgot_step1'
                ? 'Код подтверждения будет отправлен в ваш Telegram'
                : `Введите код из Telegram и новый пароль`}
            </p>
          </>
        )}

        <div className="login-divider" />

        {/* Alert banners */}
        {error && (
          <div className="login-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#16A34A',
            padding: '11px 14px',
            borderRadius: '10px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            fontSize: '0.85rem',
            textAlign: 'left'
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ═══ MODE 1: LOGIN ═══ */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="login-field">
                <User size={14} /> Телефон или логин
              </label>
              <input
                id="login-field"
                type="text"
                placeholder="Введите телефон или логин"
                value={loginField}
                onChange={(e) => setLoginField(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="input-group">
              <label htmlFor="login-password">
                <KeyRound size={14} /> Пароль
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={17} className="spinner" />
                  <span>Входим...</span>
                </>
              ) : (
                <span>Войти</span>
              )}
            </button>

            {/* Links below Login Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('forgot_step1'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717A',
                  fontSize: '0.84rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Забыли пароль?
              </button>

              <div style={{ fontSize: '0.86rem', color: '#71717A', marginTop: '4px' }}>
                Нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('register'); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#C5A55A',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  Зарегистрироваться
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ═══ MODE 2: REGISTER ═══ */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="reg-phone">
                <Phone size={14} /> Номер телефона
              </label>
              <input
                id="reg-phone"
                type="tel"
                placeholder="Введите номер телефона"
                value={regPhone}
                onChange={(e) => setRegPhone(formatPhone(e.target.value))}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label htmlFor="reg-name">
                <User size={14} /> Ваше имя
              </label>
              <input
                id="reg-name"
                type="text"
                placeholder="Алексей"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label htmlFor="reg-pass">
                <KeyRound size={14} /> Пароль (от 6 символов)
              </label>
              <input
                id="reg-pass"
                type="password"
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label htmlFor="reg-confirm-pass">
                <KeyRound size={14} /> Подтверждение пароля
              </label>
              <input
                id="reg-confirm-pass"
                type="password"
                placeholder="••••••••"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={17} className="spinner" />
                  <span>Создание аккаунта...</span>
                </>
              ) : (
                <span>Зарегистрироваться</span>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.86rem', color: '#71717A' }}>
              Уже есть аккаунт?{' '}
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#C5A55A',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Войти
              </button>
            </div>
          </form>
        )}

        {/* ═══ MODE 3: FORGOT STEP 1 (Phone) ═══ */}
        {mode === 'forgot_step1' && (
          <form onSubmit={handleForgotStep1Submit} className="login-form">
            <div className="input-group">
              <label htmlFor="forgot-phone">
                <Phone size={14} /> Номер телефона
              </label>
              <input
                id="forgot-phone"
                type="tel"
                placeholder="Введите номер телефона"
                value={forgotPhone}
                onChange={(e) => setForgotPhone(formatPhone(e.target.value))}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={17} className="spinner" />
                  <span>Отправка кода...</span>
                </>
              ) : (
                <span>Получить код в Telegram</span>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                className="login-back-link"
                style={{ margin: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Вернуться ко входу
              </button>
            </div>
          </form>
        )}

        {/* ═══ MODE 4: FORGOT STEP 2 (Code & New Password) ═══ */}
        {mode === 'forgot_step2' && (
          <form onSubmit={handleForgotStep2Submit} className="login-form">
            <div className="input-group">
              <label htmlFor="forgot-code">
                <KeyRound size={14} /> Код из Telegram (4 цифры)
              </label>
              <input
                id="forgot-code"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={forgotCode}
                onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                disabled={isLoading}
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.25rem', fontWeight: 'bold' }}
              />
            </div>

            <div className="input-group">
              <label htmlFor="forgot-new-pass">
                <KeyRound size={14} /> Новый пароль
              </label>
              <input
                id="forgot-new-pass"
                type="password"
                placeholder="••••••••"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label htmlFor="forgot-confirm-pass">
                <KeyRound size={14} /> Подтвердите новый пароль
              </label>
              <input
                id="forgot-confirm-pass"
                type="password"
                placeholder="••••••••"
                value={forgotConfirmPassword}
                onChange={(e) => setForgotConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading || forgotCode.length !== 4}>
              {isLoading ? (
                <>
                  <Loader2 size={17} className="spinner" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <span>Сменить пароль и войти</span>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('forgot_step1'); }}
                className="login-back-link"
                style={{ margin: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Изменить номер
              </button>

              <button
                type="button"
                onClick={handleForgotStep1Submit}
                className="login-back-link"
                style={{ margin: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#C5A55A', fontWeight: '600' }}
                disabled={isLoading}
              >
                Отправить код снова
              </button>
            </div>
          </form>
        )}

        <a href="/" className="login-back-link" style={{ marginTop: '24px' }}>
          ← Вернуться к онлайн-записи
        </a>
      </div>
    </div>
  );
}
