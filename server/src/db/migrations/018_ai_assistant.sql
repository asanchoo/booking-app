ALTER TABLE bookings ADD COLUMN ai_assisted INTEGER NOT NULL DEFAULT 0
  CHECK (ai_assisted IN (0, 1));

CREATE TABLE IF NOT EXISTS ai_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  tools_used TEXT NOT NULL DEFAULT '[]',
  success INTEGER NOT NULL DEFAULT 1 CHECK (success IN (0, 1)),
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_created_at ON ai_interactions(created_at);
