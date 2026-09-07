const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function getSalonTimeZone() {
  return process.env.BUSINESS_TIMEZONE || 'Asia/Almaty';
}

// Convert a timezone-free value stored by the booking domain into an absolute
// instant. Date(string) cannot be used here: Vercel runs in UTC while the
// stored value represents the salon's local clock.
export function parseDateTimeInZone(value, timeZone = getSalonTimeZone()) {
  const match = DATETIME_RE.exec(String(value || ''));
  if (!match) return null;

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const utcGuess = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  if (!Number.isFinite(utcGuess)) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });
  let timestamp = utcGuess;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    timestamp += utcGuess - represented;
  }

  const result = new Date(timestamp);
  const finalParts = Object.fromEntries(
    formatter.formatToParts(result)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return Object.entries(desired).every(([key, number]) => finalParts[key] === number) ? result : null;
}

export function formatDateTimeInZone(value, options, locale = 'ru-RU', timeZone = getSalonTimeZone()) {
  const date = value instanceof Date ? value : parseDateTimeInZone(value, timeZone);
  if (!date || !Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${formatDate(date)}T${hours}:${minutes}:${seconds}`;
}

export function parseDateParam(value) {
  const match = DATE_RE.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function parseDateTimeParam(value) {
  const match = DATETIME_RE.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = Number(match[6] ?? 0);
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getSeconds() !== seconds
  ) {
    return null;
  }

  return formatDateTime(date);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMinutesToDateTime(dateTime, minutes) {
  const match = DATETIME_RE.exec(dateTime);
  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  date.setMinutes(date.getMinutes() + minutes);
  return formatDateTime(date);
}

export function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function buildDateTime(date, time) {
  return `${formatDate(date)}T${time}:00`;
}

export function defaultSlotRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    from: formatDate(today),
    to: formatDate(addDays(today, 7)),
  };
}

export function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}
