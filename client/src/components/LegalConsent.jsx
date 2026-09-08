import React from 'react';
import { Link } from 'react-router-dom';
import './LegalConsent.css';

export default function LegalConsent({ checked, onChange, disabled = false, id = 'legal-consent', compact = false }) {
  return (
    <label className={`legal-consent ${compact ? 'legal-consent--compact' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} required />
      <span>
        Я принимаю <Link to="/terms" target="_blank" rel="noreferrer">Пользовательское соглашение</Link>
        {' '}и даю согласие на обработку персональных данных согласно{' '}
        <Link to="/privacy" target="_blank" rel="noreferrer">Политике конфиденциальности</Link>.
      </span>
    </label>
  );
}
