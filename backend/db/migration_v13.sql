-- Migration v13: Bug attachments (image upload for Bugs Incident)
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v13.sql
--
-- Mirrors backlog_attachments, but linked to bugs instead of backlog_items.

CREATE TABLE IF NOT EXISTS bug_attachments (
  id             SERIAL PRIMARY KEY,
  bug_id         INTEGER      NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  filename       VARCHAR(255) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  file_size      INTEGER,
  mime_type      VARCHAR(100),
  uploaded_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_attachments ON bug_attachments(bug_id);

SELECT 'Migration v13 selesai.' AS status;
