import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import './ServiceCard.css';

export default function ServiceCard({ service, isSelected, onSelect }) {
  return (
    <div 
      className={`service-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(service)}
    >
      <div className="service-card-header">
        <h3 className="service-name">{service.name}</h3>
        {isSelected && <CheckCircle2 className="check-icon" size={20} />}
      </div>
      
      <p className="service-description">
        {service.description || 'Профессиональная услуга от опытного мастера.'}
      </p>

      <div className="service-card-footer">
        <div className="service-duration">
          <Clock size={16} />
          <span>{service.durationMinutes || service.duration_minutes} мин</span>
        </div>
        <div className="service-price">
          {(() => {
            const rawPrice = service.priceCents !== undefined ? service.priceCents / 100 : service.price;
            const priceNum = Number(rawPrice);
            return isNaN(priceNum) ? '—' : `${priceNum.toLocaleString('ru-RU')} ₸`;
          })()}
        </div>
      </div>
    </div>
  );
}
