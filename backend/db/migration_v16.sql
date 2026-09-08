-- Migration v16: Bugs Incident stage simplification + closed_at tracking
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v16.sql
--
-- Simplifies the bug stage flow from 5 stages to 4:
--   open, in_progress, fixed, verified, closed  →  open, in_progress, ready_to_test, done
-- ("fixed" is renamed to "ready_to_test" to signal QA the fix is ready to be tested;
--  "verified" and "closed" are merged into a single "done" stage.)
--
-- Also adds bugs.closed_at, auto-set whenever a bug's stage is moved to 'done'.

-- ─── closed_at column ────────────────────────────────────────────────────────

ALTER TABLE bugs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- Backfill closed_at for bugs already resolved under the old stage names, using
-- the timestamp of their most recent progress update into that stage (falling
-- back to updated_at if no progress history exists).

UPDATE bugs b
SET closed_at = COALESCE(
  (SELECT MAX(bp.created_at) FROM bug_progress_updates bp
   WHERE bp.bug_id = b.id AND bp.stage IN ('verified', 'closed')),
  b.updated_at
)
WHERE b.stage IN ('verified', 'closed');

-- ─── Stage remap ─────────────────────────────────────────────────────────────

UPDATE bugs SET stage = 'ready_to_test' WHERE stage = 'fixed';
UPDATE bugs SET stage = 'done' WHERE stage IN ('verified', 'closed');

UPDATE bug_progress_updates SET stage = 'ready_to_test' WHERE stage = 'fixed';
UPDATE bug_progress_updates SET stage = 'done' WHERE stage IN ('verified', 'closed');

-- ─── Column comments (documentation only, matches migration_v12 style) ──────

COMMENT ON COLUMN bugs.stage IS 'open, in_progress, ready_to_test, done';
COMMENT ON COLUMN bug_progress_updates.stage IS 'open, in_progress, ready_to_test, done';

SELECT 'Migration v16 selesai.' AS status;
