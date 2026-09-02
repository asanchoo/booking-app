ALTER TABLE bookings ADD COLUMN review_request_sent_at TEXT;

ALTER TABLE barber_reviews ADD COLUMN source TEXT NOT NULL DEFAULT 'website'
  CHECK (source IN ('website', 'telegram'));

CREATE INDEX IF NOT EXISTS idx_bookings_review_request
  ON bookings(attendance_status, review_request_sent_at, ends_at);
