const BASE = '/api/barber';

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Ошибка ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const getBarberProfile = () => request(`${BASE}/me`);
export const getBarberBookings = () => request(`${BASE}/bookings`);
export const getMasterReviews = () => request(`${BASE}/reviews`);
export const markBookingAttendance = (bookingId, attendanceStatus) => request(`${BASE}/bookings/${bookingId}/attendance`, { method: 'POST', body: JSON.stringify({ attendanceStatus }) });
export const getMasterTimeBlocks = () => request(`${BASE}/time-blocks`);
export const createMasterTimeBlock = (payload) => request(`${BASE}/time-blocks`, { method: 'POST', body: JSON.stringify(payload) });
export const deleteMasterTimeBlock = (id) => request(`${BASE}/time-blocks/${id}`, { method: 'DELETE' });
export const saveMasterClientNote = (phone, note) => request(`${BASE}/clients/${encodeURIComponent(phone)}/note`, { method: 'PUT', body: JSON.stringify({ note }) });
