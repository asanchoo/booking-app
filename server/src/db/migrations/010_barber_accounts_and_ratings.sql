CREATE TABLE IF NOT EXISTS barber_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER NOT NULL UNIQUE REFERENCES barbers(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_ratings (
  phone TEXT PRIMARY KEY,
  rating REAL NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_rating_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  delta REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (booking_id, event_type)
);

ALTER TABLE bookings ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (attendance_status IN ('pending', 'attended', 'no_show'));

CREATE INDEX IF NOT EXISTS idx_barber_accounts_username ON barber_accounts(username);
CREATE INDEX IF NOT EXISTS idx_client_rating_events_phone ON client_rating_events(phone);
