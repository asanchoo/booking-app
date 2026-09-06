import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Scissors, CalendarCheck, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const { authenticated, role } = useAuth();

  // Determine target path for the single "Личный кабинет" / "Кабинет" button:
  // - If not logged in -> /login
  // - If logged in as admin -> /admin
  // - If logged in as client -> /my-account
  const getAccountLink = () => {
    if (!authenticated) return '/login';
    if (role === 'admin') return '/admin';
    if (role === 'barber') return '/barber';
    return '/my-account';
  };

  const getAccountLabel = () => {
    if (!authenticated) return 'Личный кабинет';
    if (role === 'admin') return 'Админ-панель';
    if (role === 'barber') return 'Кабинет мастера';
    return 'Мои записи';
  };

  const getMobileAccountLabel = () => {
    if (!authenticated) return 'Кабинет';
    if (role === 'admin') return 'Админ';
    if (role === 'barber') return 'Мастер';
    return 'Записи';
  };

  const isAccountActive =
    location.pathname === '/login' ||
    location.pathname === '/my-account' ||
    location.pathname === '/admin' || location.pathname === '/barber';

  const canBook = role !== 'admin' && role !== 'barber';

  return (
    <>
    <header className="navbar-header">
      <div className="navbar-container navbar-desktop">
        <Link to="/" className="navbar-brand">
          <div className="brand-icon">
            <Scissors size={22} className="scissors-icon" />
          </div>
          <span className="brand-name">
            BARBER<span className="brand-accent">SHOP</span>
          </span>
        </Link>

        <nav className="navbar-links">
          {canBook && (
            <Link
              to="/"
              className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
            >
              <CalendarCheck size={18} />
              <span className="nav-label-full">Записаться</span>
              <span className="nav-label-mobile">Запись</span>
            </Link>
          )}

          <Link
            to={getAccountLink()}
            className={`nav-item ${isAccountActive ? 'active' : ''}`}
          >
            {role === 'admin' ? <ShieldCheck size={18} /> : <User size={18} />}
            <span className="nav-label-full">{getAccountLabel()}</span>
            <span className="nav-label-mobile">{getMobileAccountLabel()}</span>
          </Link>
        </nav>
      </div>

      <div className="navbar-mobile">
        <Link to="/" className="navbar-mobile-brand" aria-label="BARBERSHOP — главная">
          <span className="navbar-mobile-mark"><Scissors size={19} /></span>
          <span>BARBER<strong>SHOP</strong></span>
        </Link>
        <Link
          to={getAccountLink()}
          className={`navbar-mobile-account ${isAccountActive ? 'active' : ''}`}
        >
          {role === 'admin' ? <ShieldCheck size={17} /> : <User size={17} />}
          <span>{getMobileAccountLabel()}</span>
        </Link>
      </div>

    </header>
    {canBook && (
      <nav className="customer-mobile-nav" aria-label="Основная навигация">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          <CalendarCheck size={20} />
          <span>Записаться</span>
        </Link>
        <Link to={getAccountLink()} className={isAccountActive ? 'active' : ''}>
          <User size={20} />
          <span>{authenticated ? 'Мои записи' : 'Кабинет'}</span>
        </Link>
      </nav>
    )}
    </>
  );
}
