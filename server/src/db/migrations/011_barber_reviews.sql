CREATE TABLE IF NOT EXISTS barber_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_barber_reviews_barber_id ON barber_reviews(barber_id);
