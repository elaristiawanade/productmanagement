-- Migration v9: Month Release Target (roadmap) + feature-as-roadmap flag
-- Run once on existing database:
--   psql -U postgres -d product_tracker -f migration_v9.sql

ALTER TABLE features ADD COLUMN IF NOT EXISTS is_roadmap_item BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE product_roadmap ADD COLUMN IF NOT EXISTS month_release_target DATE;
ALTER TABLE product_roadmap ADD COLUMN IF NOT EXISTS source_feature_id INTEGER REFERENCES features(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_roadmap_source_feature ON product_roadmap(source_feature_id);
CREATE INDEX IF NOT EXISTS idx_features_is_roadmap    ON features(is_roadmap_item);

SELECT 'Migration v9 selesai.' AS status;
