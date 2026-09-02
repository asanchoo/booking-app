ALTER TABLE barber_reviews ADD COLUMN comment_hidden INTEGER NOT NULL DEFAULT 0
  CHECK (comment_hidden IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_barber_reviews_moderation
  ON barber_reviews(comment_hidden, created_at);
