-- Migration v10: C-Level Dashboard (Leader Notes, Leader Task, My Task)
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v10.sql

-- ─── USERS.DEPARTMENT ───────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(20);
COMMENT ON COLUMN users.department IS 'HC, Sales, PMG, IT, Finance, Product — scopes C-Level Dashboard visibility';

-- Default mapping from existing role to department (developer/qa -> IT, po/manager -> PMG).
-- HC/Sales/Finance/Product have no matching system role and must be assigned manually by an admin.
UPDATE users u SET department = 'IT'
  FROM roles r WHERE r.id = u.role_id AND r.name IN ('developer', 'qa') AND u.department IS NULL;
UPDATE users u SET department = 'PMG'
  FROM roles r WHERE r.id = u.role_id AND r.name IN ('po', 'manager') AND u.department IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- ─── NEW ROLES: SME & COMMISSIONER ──────────────────────────────────────────
-- Cross-functional write access to Leader Notes / Leader Task (see PMG/section 2.2 of the PRD).

INSERT INTO roles (name, display_name, permissions)
  SELECT 'sme', 'SME', '{"manage_leader_notes": true, "manage_leader_tasks": true}'
  WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'sme');
INSERT INTO roles (name, display_name, permissions)
  SELECT 'commissioner', 'Commissioner', '{"manage_leader_notes": true, "manage_leader_tasks": true}'
  WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'commissioner');

-- ─── LEADER NOTES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leader_notes (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department       VARCHAR(20) NOT NULL,
  note_date        DATE      NOT NULL,
  goals_this_week  TEXT      NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, department, note_date)
);

CREATE INDEX IF NOT EXISTS idx_leader_notes_dept_date ON leader_notes(department, note_date DESC);
CREATE INDEX IF NOT EXISTS idx_leader_notes_user_date ON leader_notes(user_id, note_date);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_leader_notes_updated') THEN
    CREATE TRIGGER trg_leader_notes_updated
      BEFORE UPDATE ON leader_notes
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── LEADER TASKS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leader_tasks (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(20)  NOT NULL UNIQUE,
  title          TEXT         NOT NULL,
  department     VARCHAR(20)  NOT NULL,
  priority       VARCHAR(20)  NOT NULL DEFAULT 'medium',  -- critical, high, medium, low
  status         VARCHAR(30)  NOT NULL DEFAULT 'backlog', -- backlog, todo, in_progress, in_review, done, blocked
  assignee_id    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  parent_id      INTEGER      REFERENCES leader_tasks(id) ON DELETE SET NULL,
  notes          TEXT,
  deadline       DATE,
  source_note_id INTEGER      REFERENCES leader_notes(id) ON DELETE SET NULL,
  created_by     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leader_tasks_department ON leader_tasks(department);
CREATE INDEX IF NOT EXISTS idx_leader_tasks_status      ON leader_tasks(status);
CREATE INDEX IF NOT EXISTS idx_leader_tasks_assignee    ON leader_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_leader_tasks_parent      ON leader_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_leader_tasks_deadline    ON leader_tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_leader_tasks_source_note ON leader_tasks(source_note_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_leader_tasks_updated') THEN
    CREATE TRIGGER trg_leader_tasks_updated
      BEFORE UPDATE ON leader_tasks
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── LEADER TASK ATTACHMENTS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leader_task_attachments (
  id              SERIAL PRIMARY KEY,
  leader_task_id  INTEGER      NOT NULL REFERENCES leader_tasks(id) ON DELETE CASCADE,
  filename        VARCHAR(255) NOT NULL,
  original_name   VARCHAR(255) NOT NULL,
  file_size       INTEGER,
  mime_type       VARCHAR(100),
  uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leader_task_attachments ON leader_task_attachments(leader_task_id);

-- ─── LEADER TASK ACTIVITIES (comments + change log) ─────────────────────────

CREATE TABLE IF NOT EXISTS leader_task_activities (
  id              SERIAL PRIMARY KEY,
  leader_task_id  INTEGER      NOT NULL REFERENCES leader_tasks(id) ON DELETE CASCADE,
  user_id         INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(20)  NOT NULL DEFAULT 'comment', -- comment | change_log
  content         TEXT         NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leader_task_activities ON leader_task_activities(leader_task_id, created_at);

SELECT 'Migration v10 selesai.' AS status;
