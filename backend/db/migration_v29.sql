-- Migration v29: Deadline on Bugs Incident and QA test cases
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v29.sql
--
-- Optional target date (DATE, no time), picked in the Buat/Edit Bug and Buat/Edit Test Case forms
-- and shown as the "Deadline" column in both tables (same column type as backlog_items.deadline).
-- Nullable and additive: existing rows, the public /report-bug form and CSV imports keep
-- deadline = NULL (shown as "—"). No data is changed.
-- Must run BEFORE the new backend starts — its INSERT/UPDATE statements reference these columns.

ALTER TABLE bugs          ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE qa_test_cases ADD COLUMN IF NOT EXISTS deadline DATE;

SELECT 'Migration v29 selesai.' AS status;
