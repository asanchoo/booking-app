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

export async function fetchBarbers(serviceId) {
  const query = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : '';
  const res = await fetch(`/api/barbers${query}`);
  if (!res.ok) {
    throw new Error('Не удалось загрузить список мастеров');
  }
  return res.json();
}

export async function fetchSlots(serviceId, barberId, from, to) {
  const params = new URLSearchParams();
  if (serviceId) params.append('serviceId', serviceId);
  if (barberId) params.append('barberId', barberId);
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
    barberId: bookingData.barberId || bookingData.barber_id,
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
  const res = await fetch('/api/bookings', {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.error || 'Не удалось загрузить список записей администратора');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function loginAdmin(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    // Unified endpoint accepts "login" field (admin username or client phone)
    body: JSON.stringify({ login: username, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || 'Ошибка входа');
    error.status = res.status;
    throw error;
  }

  return data;
}


export async function logoutAdmin() {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

export async function checkAuthStatus() {
  const res = await fetch('/api/auth/me', {
    credentials: 'include',
  });
  if (!res.ok) return { authenticated: false };
  return res.json();
}
