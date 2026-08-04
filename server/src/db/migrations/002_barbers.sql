-- Migration 002: Add barbers table and barber_id to bookings
CREATE TABLE IF NOT EXISTS barbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  photo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE bookings ADD COLUMN barber_id INTEGER REFERENCES barbers(id);

CREATE INDEX IF NOT EXISTS idx_bookings_barber_starts_at ON bookings (barber_id, starts_at);
