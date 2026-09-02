CREATE TABLE IF NOT EXISTS master_time_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_master_time_blocks_range
  ON master_time_blocks(master_id, starts_at, ends_at);
