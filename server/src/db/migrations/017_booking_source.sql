ALTER TABLE bookings ADD COLUMN booking_source TEXT NOT NULL DEFAULT 'online'
  CHECK (booking_source IN ('online', 'admin'));

CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings(booking_source, created_at);
