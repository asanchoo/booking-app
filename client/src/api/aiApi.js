async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Не удалось выполнить запрос');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function fetchAiStatus() {
  return readJson(await fetch('/api/ai/status'));
}

export async function sendAiMessage(messages, context = {}) {
  return readJson(await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  }));
}

export async function confirmAiBooking(booking) {
  return readJson(await fetch('/api/ai/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...booking, confirmed: true }),
  }));
}
