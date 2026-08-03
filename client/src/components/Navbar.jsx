import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Scissors, ShieldCheck, CalendarCheck } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <div className="brand-icon">
            <Scissors size={22} className="scissors-icon" />
          </div>
          <span className="brand-name">BARBER<span className="brand-accent">SHOP</span></span>
        </Link>

        <nav className="navbar-links">
          <Link 
            to="/" 
            className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
          >
            <CalendarCheck size={18} />
            <span>Записаться</span>
          </Link>

          <Link 
            to="/admin" 
            className={`nav-item ${location.pathname === '/admin' ? 'active' : ''}`}
          >
            <ShieldCheck size={18} />
            <span>Админ-панель</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
