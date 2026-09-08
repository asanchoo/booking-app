ALTER TABLE otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created
  ON otp_codes(phone, id DESC);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  reset_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset_at
  ON rate_limit_buckets(reset_at);

UPDATE barbers SET name = trim(name) WHERE name <> trim(name);

UPDATE services
SET description = CASE name
  WHEN 'Стрижка' THEN 'Стрижка с учётом формы лица и индивидуальных пожеланий.'
  WHEN 'Борода' THEN 'Оформление бороды, точные контуры и аккуратная укладка.'
  WHEN 'Стрижка + борода' THEN 'Комплексная стрижка и профессиональное оформление бороды.'
  ELSE description
END
WHERE trim(description) = '';
