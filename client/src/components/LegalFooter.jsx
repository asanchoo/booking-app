import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './LegalFooter.css';

export default function LegalFooter() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/barber')) return null;
  return (
    <footer className="legal-footer">
      <span>© {new Date().getFullYear()} BarberShop</span>
      <nav aria-label="Правовая информация">
        <Link to="/privacy">Конфиденциальность</Link>
        <Link to="/terms">Условия использования</Link>
      </nav>
    </footer>
  );
}
