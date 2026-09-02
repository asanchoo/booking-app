CREATE TABLE IF NOT EXISTS master_client_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(master_id, client_phone)
);

CREATE INDEX IF NOT EXISTS idx_master_client_notes_phone
  ON master_client_notes(master_id, client_phone);
