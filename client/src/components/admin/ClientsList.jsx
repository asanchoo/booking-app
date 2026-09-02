import React from 'react';
import { Phone, Star } from 'lucide-react';

export default function ClientsList({ bookings = [], onSelectClientBooking }) {
  // Aggregate clients by phone or name
  const clientsMap = {};
  bookings.forEach((b) => {
    const phone = b.clientPhone || b.customer_phone || 'no-phone';
    const name = b.clientName || b.customer_name || 'Клиент';
    const key = `${name}-${phone}`;

    if (!clientsMap[key]) {
      clientsMap[key] = {
        name,
        phone,
        rating: Number(b.clientRating || 5),
        bookings: [],
      };
    }
    clientsMap[key].bookings.push(b);
  });

  const clientsList = Object.values(clientsMap);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="clients-list-section">
      <div className="section-header">
        <h2 className="section-title">База клиентов ({clientsList.length})</h2>
      </div>

      {clientsList.length === 0 ? (
        <div className="empty-table-state">
          <p>Список клиентов пока пуст</p>
        </div>
      ) : (
        <div className="clients-grid">
          {clientsList.map((client) => {
            const lastBooking = client.bookings[client.bookings.length - 1];
            return (
              <div key={`${client.name}-${client.phone}`} className="client-card">
                <div className="client-card-top">
                  <div className="client-avatar">{getInitials(client.name)}</div>
                  <div className="client-meta">
                    <h3 className="client-card-name">{client.name}</h3>
                    <div className="client-card-phone">
                      <Phone size={13} />
                      <span>{client.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="client-card-stats">
                  <div className="stat-pill">
                    <span>Записей: {client.bookings.length}</span>
                  </div>
                  <div className="stat-pill" title="Рейтинг надёжности клиента">
                    <Star size={13} fill="currentColor" />
                    <span>{client.rating.toFixed(2)}</span>
                  </div>
                </div>

                {lastBooking && (
                  <div
                    className="last-booking-preview"
                    onClick={() => onSelectClientBooking(lastBooking)}
                    title="Посмотреть последнюю запись"
                  >
                    <span className="preview-label">Последний визит:</span>
                    <span className="preview-val">
                      {lastBooking.serviceName || lastBooking.service_name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
