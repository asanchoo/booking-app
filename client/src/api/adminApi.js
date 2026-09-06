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

export function createService({ name, description, durationMinutes, priceCents, masterIds }) {
  return request(`${BASE}/services`, {
    method: 'POST',
    body: JSON.stringify({ name, description, durationMinutes, priceCents, masterIds }),
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

export function getAdminMasterTimeBlocks() {
  return request(`${BASE}/barbers/time-blocks`);
}

export function createBarber({ name, photoUrl, specialty }) {
  return request(`${BASE}/barbers`, {
    method: 'POST',
    body: JSON.stringify({ name, photoUrl, specialty }),
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

export function createBarberAccount(id, { username, password }) {
  return request(`${BASE}/barbers/${id}/account`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ─── Reviews ───────────────────────────────────────────────
export function getAdminReviews() {
  return request(`${BASE}/reviews`);
}

export function setReviewCommentVisibility(id, hidden) {
  return request(`${BASE}/reviews/${id}/visibility`, {
    method: 'PATCH',
    body: JSON.stringify({ hidden }),
  });
}

// ─── Bookings ──────────────────────────────────────────────
export function createAdminBooking(payload) {
  return request(`${BASE}/bookings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function cancelAdminBooking(id) {
  return request(`${BASE}/bookings/${id}/cancel`, { method: 'POST' });
}

export function rescheduleAdminBooking(id, newStartsAt) {
  return request(`${BASE}/bookings/${id}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ newStartsAt }),
  });
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
