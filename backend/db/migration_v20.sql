-- Migration v20: Multi-assignee support for Bugs Incident
-- Run once on existing database:
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v20.sql
--
-- Same pattern as migration_v19 (backlog_items): bugs.assigned_to is KEPT as the
-- "primary" assignee so every existing query/view that reads assigned_to /
-- assigned_to_name / assigned_to_email keeps working unchanged. The new join
-- table holds the full assignee set (including the primary, flagged via
-- is_primary) and is used for the assignee list, notifications, and filters.

CREATE TABLE IF NOT EXISTS bug_assignees (
  bug_id       INTEGER     NOT NULL REFERENCES bugs(id)  ON DELETE CASCADE,
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_primary   BOOLEAN     NOT NULL DEFAULT false,
  assigned_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bug_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bug_assignees_user ON bug_assignees(user_id);

-- Backfill: every existing single assignee becomes the primary assignee.
INSERT INTO bug_assignees (bug_id, user_id, is_primary)
SELECT id, assigned_to, true
FROM bugs
WHERE assigned_to IS NOT NULL
ON CONFLICT (bug_id, user_id) DO NOTHING;

SELECT 'Migration v20 selesai.' AS status;
