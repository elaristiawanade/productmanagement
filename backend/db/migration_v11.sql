-- Migration v11: Data-driven departments + many-to-many user assignment
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v11.sql
--
-- Replaces the hardcoded department list (HC, Sales, PMG, IT, Finance, Product) that used
-- to live in DepartmentHelper.java / CLevel.jsx / Users.jsx with a real `departments` table,
-- and replaces the single `users.department` column with a many-to-many `user_departments`
-- join table (same pattern as `user_products`) so one user can belong to more than one division.

-- ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departments (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(20)  NOT NULL UNIQUE,   -- stable identifier, also used in leader_tasks.code prefix source
  name         VARCHAR(100) NOT NULL,
  code_prefix  VARCHAR(10)  NOT NULL,          -- e.g. 'SLS' -> leader_tasks.code 'SLS-001'
  color        VARCHAR(20)  NOT NULL DEFAULT '#64748B',
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO departments (code, name, code_prefix, color, sort_order) VALUES
  ('HC',      'HC',      'HC',  '#E11D48', 1),
  ('Sales',   'Sales',   'SLS', '#EA580C', 2),
  ('PMG',     'PMG',     'PMG', '#C026D3', 3),
  ('IT',      'IT',      'IT',  '#0284C7', 4),
  ('Finance', 'Finance', 'FIN', '#0D9488', 5),
  ('Product', 'Product', 'PRD', '#4D7C0F', 6)
ON CONFLICT (code) DO NOTHING;

-- ─── USER_DEPARTMENTS (many-to-many, mirrors user_products) ─────────────────

CREATE TABLE IF NOT EXISTS user_departments (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments(user_id);

-- Migrate existing single-department assignments (users.department, added in migration_v10)
-- into the new join table.
INSERT INTO user_departments (user_id, department_id)
  SELECT u.id, d.id FROM users u
  JOIN departments d ON d.code = u.department
  WHERE u.department IS NOT NULL
ON CONFLICT DO NOTHING;

-- ─── leader_notes / leader_tasks: validate department against the new table ─

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leader_notes_department') THEN
    ALTER TABLE leader_notes
      ADD CONSTRAINT fk_leader_notes_department FOREIGN KEY (department) REFERENCES departments(code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leader_tasks_department') THEN
    ALTER TABLE leader_tasks
      ADD CONSTRAINT fk_leader_tasks_department FOREIGN KEY (department) REFERENCES departments(code);
  END IF;
END $$;

-- ─── Drop the old single-value column ────────────────────────────────────────

ALTER TABLE users DROP COLUMN IF EXISTS department;

SELECT 'Migration v11 selesai.' AS status;
