const BASE_AUTH = '/api/client-auth';
const BASE_MY_BOOKINGS = '/api/my-bookings';

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
    const error = new Error(data.error || data.message || `Ошибка ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

/**
 * Register new client
 * @param {Object} data { phone, password, name }
 */
export function registerClient({ phone, password, name }) {
  return request(`${BASE_AUTH}/register`, {
    method: 'POST',
    body: JSON.stringify({ phone, password, name }),
  });
}

/**
 * Send Telegram OTP Code for password reset
 * @param {string} phone
 */
export function sendForgotPasswordCode(phone) {
  return request(`${BASE_AUTH}/forgot-password/send-code`, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/**
 * Reset client password with Telegram OTP Code
 * @param {Object} data { phone, code, newPassword }
 */
export function resetForgotPassword({ phone, code, newPassword }) {
  return request(`${BASE_AUTH}/forgot-password/reset`, {
    method: 'POST',
    body: JSON.stringify({ phone, code, newPassword }),
  });
}

/**
 * Generate Telegram linking code/url
 */
export function generateTelegramLink() {
  return request(`${BASE_AUTH}/telegram/generate-link`, {
    method: 'POST',
  });
}

/**
 * Check the current client's Telegram linking status
 */
export function checkTelegramStatus() {
  return request(`${BASE_AUTH}/telegram/status`);
}

/**
 * Check client authentication status
 */
export function checkClientAuth() {
  return request(`${BASE_AUTH}/me`);
}

/**
 * Logout client
 */
export function logout() {
  return request(`${BASE_AUTH}/logout`, {
    method: 'POST',
  });
}

/**
 * Cancel a client's own booking
 * @param {number} bookingId
 */
export function cancelMyBooking(bookingId) {
  return request(`/api/my-bookings/${bookingId}/cancel`, {
    method: 'POST',
  });
}

export function createBarberReview(bookingId, { rating, comment = '' }) {
  return request(`/api/my-bookings/${bookingId}/review`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  });
}

/**
 * Fetch client's booking history
 */
export function fetchMyBookings() {
  return request(BASE_MY_BOOKINGS);
}

/**
 * Reschedule a booking
 * @param {number} bookingId
 * @param {string} newStartsAt
 */
export function rescheduleBooking(bookingId, newStartsAt) {
  return request(`/api/bookings/${bookingId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ newStartsAt }),
  });
}
