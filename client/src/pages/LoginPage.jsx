import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Lock, User, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Заполните логин и пароль');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/admin');
    } catch (err) {
      setError(err.message === 'Invalid credentials' ? 'Неверный логин или пароль' : (err.message || 'Ошибка входа'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card glass-panel animate-fade-in">
        <div className="login-icon-wrapper">
          <Lock size={32} />
        </div>
        <h1 className="login-title">Вход в панель админа</h1>
        <p className="login-subtitle">Доступ только для владельцев и менеджеров</p>

        {error && (
          <div className="login-error-banner animate-fade-in">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="login-username">
              <User size={16} /> Логин
            </label>
            <input
              id="login-username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="login-password">
              <KeyRound size={16} /> Пароль
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
                <Loader2 size={18} className="spinner" />
                <span>Входим...</span>
              </>
            ) : (
              <span>Войти</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
