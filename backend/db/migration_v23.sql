-- Migration v23: Link Bugs Incident and QA test cases to a Product Feature
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v23.sql
--
-- `feature_id` points at the `features` table (Products → Features tab, codes like BMTFT-1),
-- NOT at product_roadmap — backlog_items.feature_id was repointed to product_roadmap in v7,
-- so the two are unrelated despite the shared column name.
--
-- Nullable and additive: existing bugs / test cases keep feature_id = NULL (shown as "—").
-- ON DELETE SET NULL: deleting a feature never deletes the bugs / test cases linked to it.
-- Must run BEFORE the new backend starts — its INSERT/UPDATE statements reference these columns.

ALTER TABLE bugs          ADD COLUMN IF NOT EXISTS feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL;
ALTER TABLE qa_test_cases ADD COLUMN IF NOT EXISTS feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bugs_feature     ON bugs(feature_id);
CREATE INDEX IF NOT EXISTS idx_qa_tc_feature    ON qa_test_cases(feature_id);

SELECT 'Migration v23 selesai.' AS status;
