-- Migration v22: User presence (online / away / offline dot on avatars)
-- Run once on existing database:
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v22.sql
--
-- Kept out of `users` on purpose: users has a BEFORE UPDATE trigger that bumps updated_at,
-- and a heartbeat every ~30s would make that column meaningless.
--
-- Each open Product Tracker tab sends a heartbeat:
--   last_seen_at   = any heartbeat (a tab is open)
--   last_active_at = heartbeat from a visible tab with recent user activity
-- The API derives the status when reading (see PresenceController):
--   online  = last_active_at within ~75s
--   away    = a tab is open, but hidden or idle
--   offline = no heartbeat for ~150s (tab closed) or no row (logged out / never seen)

CREATE TABLE IF NOT EXISTS user_presence (
  user_id         INTEGER    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at    TIMESTAMP  NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMP
);

SELECT 'Migration v22 selesai.' AS status;
