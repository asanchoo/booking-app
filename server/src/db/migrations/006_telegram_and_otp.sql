ALTER TABLE clients ADD COLUMN telegram_chat_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_telegram_chat_id ON clients(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS telegram_linking_codes (
  code TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
