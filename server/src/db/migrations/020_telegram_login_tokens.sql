CREATE TABLE IF NOT EXISTS telegram_login_tokens (
  token_hash TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegram_login_tokens_expiry
  ON telegram_login_tokens(expires_at);
