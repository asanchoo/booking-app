ALTER TABLE clients ADD COLUMN legal_consent_at TEXT;
ALTER TABLE clients ADD COLUMN legal_version TEXT;
ALTER TABLE bookings ADD COLUMN legal_consent_at TEXT;
ALTER TABLE bookings ADD COLUMN legal_version TEXT;
