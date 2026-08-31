-- Migration v12: Bugs Incident module
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v12.sql
--
-- Adds a standalone bug/incident tracker with a staged fix-progress history log,
-- separate from qa_test_runs.bug_reference (which stays a free-text field).
-- Module access is gated by the `access_bugs` permission (default-granted to the
-- `qa` role only; super_admin bypasses everything via PermissionHelper).

-- ─── BUGS ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bugs (
  id                 SERIAL PRIMARY KEY,
  backlog_item_id    INTEGER      REFERENCES backlog_items(id) ON DELETE SET NULL, -- optional link
  product_id         INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code               VARCHAR(20)  NOT NULL,                  -- BUG-001 per product
  title              VARCHAR(200) NOT NULL,
  description        TEXT,
  steps_to_reproduce TEXT,
  severity           VARCHAR(20)  NOT NULL DEFAULT 'medium',  -- critical, high, medium, low
  priority           VARCHAR(20)  NOT NULL DEFAULT 'medium',  -- critical, high, medium, low
  stage              VARCHAR(30)  NOT NULL DEFAULT 'open',    -- open, in_progress, fixed, verified, closed
  reported_by        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  assigned_to        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── BUG PROGRESS UPDATES (fix-progress history log) ────────────────────────

CREATE TABLE IF NOT EXISTS bug_progress_updates (
  id           SERIAL PRIMARY KEY,
  bug_id       INTEGER      NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  stage        VARCHAR(30)  NOT NULL DEFAULT 'open',   -- open, in_progress, fixed, verified, closed
  note         TEXT,
  updated_by   INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bugs_backlog     ON bugs(backlog_item_id);
CREATE INDEX IF NOT EXISTS idx_bugs_product     ON bugs(product_id);
CREATE INDEX IF NOT EXISTS idx_bugs_stage       ON bugs(stage);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned    ON bugs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bug_progress_bug ON bug_progress_updates(bug_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bugs_updated') THEN
    CREATE TRIGGER trg_bugs_updated
      BEFORE UPDATE ON bugs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── PERMISSIONS: Bugs Incident module ──────────────────────────────────────
-- New `access_bugs` permission, default-granted only to the `qa` role. Super Admin
-- already bypasses all checks via PermissionHelper. Grantable to other roles later
-- via Users & Roles → Roles & Permissions.

UPDATE roles SET permissions = permissions || '{"access_bugs": true}'::jsonb WHERE name = 'qa';

SELECT 'Migration v12 selesai.' AS status;
