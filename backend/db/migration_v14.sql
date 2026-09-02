-- Migration v14: Bug activities (comments + change log for Bugs Incident)
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v14.sql
--
-- Mirrors leader_task_activities, but linked to bugs instead of leader_tasks.

CREATE TABLE IF NOT EXISTS bug_activities (
  id              SERIAL PRIMARY KEY,
  bug_id          INTEGER      NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  user_id         INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(20)  NOT NULL DEFAULT 'comment', -- comment | change_log
  content         TEXT         NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_activities ON bug_activities(bug_id, created_at);

SELECT 'Migration v14 selesai.' AS status;
