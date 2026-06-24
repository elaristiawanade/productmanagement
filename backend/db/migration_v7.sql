-- Migration v7: Repoint backlog_items.feature_id → product_roadmap(id)
-- Feature dropdown in Backlog now reads from product_roadmap (created in Products > Roadmap tab)
--
-- SAFE: existing feature_id values (which pointed to features table) are set to NULL first
-- because those IDs are not valid product_roadmap IDs. Users will need to re-link
-- backlog items to roadmap features after this migration.
--
-- Run once on production:
--   docker exec pt_postgres psql -U postgres -d product_tracker -f /path/to/migration_v7.sql
-- Or via psql:
--   psql -U postgres -d product_tracker -f migration_v7.sql

-- Step 1: Clear existing feature_id values (old FK pointed to features table, now obsolete)
UPDATE backlog_items SET feature_id = NULL WHERE feature_id IS NOT NULL;

-- Step 2: Drop old FK constraint (references features table)
ALTER TABLE backlog_items
  DROP CONSTRAINT IF EXISTS backlog_items_feature_id_fkey;

-- Step 3: Add new FK to product_roadmap
ALTER TABLE backlog_items
  ADD CONSTRAINT backlog_items_feature_id_fkey
  FOREIGN KEY (feature_id) REFERENCES product_roadmap(id) ON DELETE SET NULL;

SELECT 'Migration v7 selesai. feature_id lama di-reset ke NULL.' AS status;
