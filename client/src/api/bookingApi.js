/**
  * API helper for BarberShop Backend
  */

export async function fetchServices() {
  const res = await fetch('/api/services');
  if (!res.ok) {
    throw new Error('Не удалось загрузить список услуг');
  }
  return res.json();
}

export async function fetchSlots(serviceId, from, to) {
  const params = new URLSearchParams();
  if (serviceId) params.append('serviceId', serviceId);
  if (from) params.append('from', from);
  if (to) params.append('to', to);

  const res = await fetch(`/api/slots?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Не удалось загрузить слоты для записи');
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.slots || []);
}

export async function createBooking(bookingData) {
  // Support both camelCase and snake_case inputs
  const payload = {
    serviceId: bookingData.serviceId || bookingData.service_id,
    startsAt: bookingData.startsAt || bookingData.start_time,
    clientName: bookingData.clientName || bookingData.customer_name,
    clientPhone: bookingData.clientPhone || bookingData.customer_phone,
  };

  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || 'Ошибка при создании записи');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchBookings() {
  const res = await fetch('/api/bookings');
  if (!res.ok) {
    throw new Error('Не удалось загрузить список записей администратора');
  }
  return res.json();
}
