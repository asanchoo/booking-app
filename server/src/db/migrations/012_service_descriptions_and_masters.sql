ALTER TABLE services ADD COLUMN description TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS service_masters (
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  master_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, master_id)
);

CREATE INDEX IF NOT EXISTS idx_service_masters_master_id ON service_masters(master_id);

-- Existing services remain available to the current active masters after the upgrade.
INSERT OR IGNORE INTO service_masters (service_id, master_id)
SELECT s.id, b.id
FROM services s
CROSS JOIN barbers b
WHERE s.is_active = 1 AND b.is_active = 1;
