-- Migration v21: Module x Action permission matrix for Roles & Permissions
-- Run once on existing database:
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v21.sql
--
-- Replaces the flat permissions JSONB map (e.g. {"manage_backlog": true}) with a
-- nested module->action map (e.g. {"backlog": {"create": true, "update": true}}).
-- Every role below is set to produce EXACTLY the same effective access it has
-- today (derived from the hardcoded role-name checks in every controller/page,
-- not from the old flat JSONB data, which was mostly dead/unread by any code
-- path) -- see the migration mapping table in the plan doc for the full
-- derivation. The one deliberate exception is `sme` -> c_level.access: sme's
-- old data (manage_leader_notes/manage_leader_tasks) was never actually read
-- by any code, so sme has never had real C-Level access; this migration
-- grants it for real, as a conscious bug fix, not a silent side effect.
--
-- This is a full OVERWRITE of each named role's `permissions` column. Safe to
-- run once; re-running after an admin has edited a role's permissions via the
-- UI will clobber those edits back to this baseline.

UPDATE roles SET permissions = '{
  "backlog":     {"create": true, "update": true, "delete": true, "update_assigned": true},
  "epics":       {"create": true, "update": true, "delete": true},
  "features":    {"create": true, "update": true, "delete": true},
  "products":    {"create": true, "update": true, "delete": true},
  "roadmap":     {"create": true, "update": true, "delete": true},
  "sprints":     {"create": true, "update": true, "delete": true},
  "qa":          {"create": true, "update": true, "run": true, "delete": true},
  "bugs":        {"access": true},
  "c_level":     {"access": true},
  "standup":     {"edit_any": true, "import": true},
  "import":      {"run": true},
  "users":       {"create": true, "update": true, "reset_password": true, "deactivate": true, "delete": true},
  "roles":       {"create": true, "update": true, "delete": true},
  "departments": {"create": true, "update": true, "delete": true},
  "settings":    {"update": true}
}'::jsonb WHERE name = 'super_admin';

UPDATE roles SET permissions = '{
  "backlog":  {"create": true, "update": true, "delete": true},
  "epics":    {"create": true, "update": true, "delete": true},
  "features": {"create": true, "update": true, "delete": true},
  "products": {"create": true, "update": true},
  "roadmap":  {"create": true, "update": true, "delete": true},
  "sprints":  {"create": true, "update": true, "delete": true},
  "qa":       {"create": true, "update": true, "run": true},
  "standup":  {"edit_any": true, "import": true},
  "import":   {"run": true},
  "users":    {"create": true, "update": true}
}'::jsonb WHERE name = 'manager';

UPDATE roles SET permissions = '{
  "backlog":  {"create": true, "update": true, "delete": true},
  "epics":    {"create": true, "update": true, "delete": true},
  "features": {"create": true, "update": true, "delete": true},
  "products": {"update": true},
  "roadmap":  {"create": true, "update": true},
  "sprints":  {"create": true, "update": true, "delete": true},
  "qa":       {"create": true, "update": true},
  "standup":  {"edit_any": true},
  "import":   {"run": true}
}'::jsonb WHERE name = 'po';

UPDATE roles SET permissions = '{
  "backlog": {"create": true, "update": true, "update_assigned": true},
  "epics":   {"create": true, "update": true, "delete": true}
}'::jsonb WHERE name = 'developer';

UPDATE roles SET permissions = '{
  "backlog": {"create": true, "update": true},
  "qa":      {"create": true, "update": true, "run": true, "delete": true},
  "bugs":    {"access": true}
}'::jsonb WHERE name = 'qa';

UPDATE roles SET permissions = '{
  "c_level": {"access": true}
}'::jsonb WHERE name = 'sme';

UPDATE roles SET permissions = '{
  "c_level": {"access": true}
}'::jsonb WHERE name = 'commissioner';

SELECT 'Migration v21 selesai.' AS status;
