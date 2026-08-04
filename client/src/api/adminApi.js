/**
 * Admin API helpers — all protected endpoints under /api/admin/
 * Every request includes credentials: 'include' for httpOnly JWT cookie.
 */

const BASE = '/api/admin';

async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || data.error || `Ошибка ${res.status}`);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Services ───────────────────────────────────────────────
export function getAdminServices() {
  return request(`${BASE}/services`);
}

export function createService({ name, durationMinutes, priceCents }) {
  return request(`${BASE}/services`, {
    method: 'POST',
    body: JSON.stringify({ name, durationMinutes, priceCents }),
  });
}

export function updateService(id, fields) {
  return request(`${BASE}/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteService(id) {
  return request(`${BASE}/services/${id}`, { method: 'DELETE' });
}

// ─── Barbers ────────────────────────────────────────────────
export function getAdminBarbers() {
  return request(`${BASE}/barbers`);
}

export function createBarber({ name, photoUrl, sortOrder }) {
  return request(`${BASE}/barbers`, {
    method: 'POST',
    body: JSON.stringify({ name, photoUrl, sortOrder }),
  });
}

export function updateBarber(id, fields) {
  return request(`${BASE}/barbers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteBarber(id) {
  return request(`${BASE}/barbers/${id}`, { method: 'DELETE' });
}

export async function uploadBarberPhoto(barberId, file) {
  const formData = new FormData();
  formData.append('photo', file);
  const res = await fetch(`${BASE}/barbers/${barberId}/photo`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Do NOT set Content-Type — browser sets multipart boundary automatically
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.message || data.error || `Ошибка ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// ─── Settings ───────────────────────────────────────────────
export function getSettings() {
  return request(`${BASE}/settings`);
}

export function updateSettings({ workStart, workEnd, slotStepMinutes, workDays }) {
  return request(`${BASE}/settings`, {
    method: 'PUT',
    body: JSON.stringify({ workStart, workEnd, slotStepMinutes, workDays }),
  });
}
