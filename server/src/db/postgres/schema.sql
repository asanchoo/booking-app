CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE TABLE IF NOT EXISTS barbers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  photo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES services(id),
  barber_id BIGINT REFERENCES barbers(id),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  reminder_3h_sent INTEGER NOT NULL DEFAULT 0,
  reminder_1h_sent INTEGER NOT NULL DEFAULT 0,
  client_confirmed_at TEXT,
  attendance_status TEXT NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending', 'attended', 'no_show')),
  review_request_sent_at TEXT,
  booking_source TEXT NOT NULL DEFAULT 'online' CHECK (booking_source IN ('online', 'admin')),
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK (ai_assisted IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_service_starts_at ON bookings(service_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_barber_starts_at ON bookings(barber_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_source ON bookings(booking_source, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_review_request ON bookings(attendance_status, review_request_sent_at, ends_at);

CREATE TABLE IF NOT EXISTS business_settings (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1))
);

CREATE TABLE IF NOT EXISTS telegram_linking_codes (
  code TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_links (
  phone TEXT PRIMARY KEY,
  chat_id BIGINT UNIQUE
);

CREATE TABLE IF NOT EXISTS barber_accounts (
  id BIGSERIAL PRIMARY KEY,
  barber_id BIGINT NOT NULL UNIQUE REFERENCES barbers(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_barber_accounts_username_lower ON barber_accounts(lower(username));

CREATE TABLE IF NOT EXISTS client_ratings (
  phone TEXT PRIMARY KEY,
  rating DOUBLE PRECISION NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE TABLE IF NOT EXISTS client_rating_events (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  booking_id BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  delta DOUBLE PRECISION NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  UNIQUE (booking_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_client_rating_events_phone ON client_rating_events(phone);

CREATE TABLE IF NOT EXISTS barber_reviews (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  barber_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'telegram')),
  comment_hidden INTEGER NOT NULL DEFAULT 0 CHECK (comment_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE INDEX IF NOT EXISTS idx_barber_reviews_barber_id ON barber_reviews(barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_reviews_moderation ON barber_reviews(comment_hidden, created_at);

CREATE TABLE IF NOT EXISTS service_masters (
  service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  master_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, master_id)
);
CREATE INDEX IF NOT EXISTS idx_service_masters_master_id ON service_masters(master_id);

CREATE TABLE IF NOT EXISTS master_time_blocks (
  id BIGSERIAL PRIMARY KEY,
  master_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_master_time_blocks_range ON master_time_blocks(master_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS master_client_notes (
  id BIGSERIAL PRIMARY KEY,
  master_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  UNIQUE(master_id, client_phone)
);
CREATE INDEX IF NOT EXISTS idx_master_client_notes_phone ON master_client_notes(master_id, client_phone);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  tools_used TEXT NOT NULL DEFAULT '[]',
  success INTEGER NOT NULL DEFAULT 1 CHECK (success IN (0, 1)),
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created_at ON ai_interactions(created_at);

CREATE TABLE IF NOT EXISTS telegram_login_tokens (
  token_hash TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_telegram_login_tokens_expiry ON telegram_login_tokens(expires_at);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE TABLE IF NOT EXISTS telegram_flow_states (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled_job_leases (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
