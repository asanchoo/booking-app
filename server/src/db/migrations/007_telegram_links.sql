CREATE TABLE IF NOT EXISTS telegram_links (
  phone TEXT PRIMARY KEY,
  chat_id INTEGER UNIQUE
);

-- Transfer existing links from clients table if any
INSERT OR IGNORE INTO telegram_links (phone, chat_id)
SELECT phone, telegram_chat_id
FROM clients
WHERE telegram_chat_id IS NOT NULL;

-- Clean up index and column from clients table
DROP INDEX IF EXISTS idx_clients_telegram_chat_id;
ALTER TABLE clients DROP COLUMN telegram_chat_id;
