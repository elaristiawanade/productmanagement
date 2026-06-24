-- Migration v7: Repoint backlog_items.feature_id → product_roadmap(id)
-- Feature dropdown in Backlog now reads from product_roadmap (created in Products > Roadmap tab)
-- Run once:
--   psql -U postgres -d product_tracker -f migration_v7.sql

-- Drop old FK (references features table)
ALTER TABLE backlog_items
  DROP CONSTRAINT IF EXISTS backlog_items_feature_id_fkey;

-- Add new FK to product_roadmap
ALTER TABLE backlog_items
  ADD CONSTRAINT backlog_items_feature_id_fkey
  FOREIGN KEY (feature_id) REFERENCES product_roadmap(id) ON DELETE SET NULL;

SELECT 'Migration v7 selesai.' AS status;
