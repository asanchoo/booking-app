import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import './ServiceCard.css';

export default function ServiceCard({ service, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={`service-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(service)}
      aria-pressed={isSelected}
      aria-label={`${service.name}, ${service.durationMinutes || service.duration_minutes} минут`}
    >
      <span className="service-card-header">
        <span className="service-name">{service.name}</span>
        {isSelected && <CheckCircle2 className="check-icon" size={20} />}
      </span>
      
      <span className="service-description">
        {service.description || 'Профессиональная услуга от опытного мастера.'}
      </span>

      <span className="service-card-footer">
        <span className="service-duration">
          <Clock size={16} />
          <span>{service.durationMinutes || service.duration_minutes} мин</span>
        </span>
        <span className="service-price">
          {(() => {
            const rawPrice = service.priceCents !== undefined ? service.priceCents / 100 : service.price;
            const priceNum = Number(rawPrice);
            return isNaN(priceNum) ? '—' : `${priceNum.toLocaleString('ru-RU')} ₸`;
          })()}
        </span>
      </span>
    </button>
  );
}
