-- Migration v19: Multi-assignee support for backlog items
-- Run once on existing database:
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v19.sql
--
-- Adds a join table so a backlog item (task/story/epic/bug/incident) can have
-- more than one assignee. backlog_items.assignee_id is KEPT as the "primary"
-- assignee — every existing query/view that reads assignee_id / assignee_name /
-- assignee_color / assignee_email keeps working unchanged. The join table holds
-- the full assignee set (including the primary, flagged via is_primary) and is
-- used for My Tasks, list filtering, the update_assigned permission check, and
-- assignment notifications.

CREATE TABLE IF NOT EXISTS backlog_item_assignees (
  backlog_item_id  INTEGER     NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
  user_id          INTEGER     NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  is_primary       BOOLEAN     NOT NULL DEFAULT false,
  assigned_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (backlog_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_backlog_item_assignees_user ON backlog_item_assignees(user_id);

-- Backfill: every existing single assignee becomes the primary assignee.
INSERT INTO backlog_item_assignees (backlog_item_id, user_id, is_primary)
SELECT id, assignee_id, true
FROM backlog_items
WHERE assignee_id IS NOT NULL
ON CONFLICT (backlog_item_id, user_id) DO NOTHING;

SELECT 'Migration v19 selesai.' AS status;
