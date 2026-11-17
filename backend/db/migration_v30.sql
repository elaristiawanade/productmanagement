-- Migration v30: Progress % snapshot on Standup entries
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v30.sql
--
-- Progress % is derived everywhere in the app (Backlog, My Task, Products, QA) and needs no column.
-- Standup is the exception: it is a record of one day, so the author's work progress is stamped
-- when the standup of today is saved and then kept as it was that day.
-- Nullable and additive: existing standups, standups imported from Excel and backdated standups keep
-- progress = NULL (shown as "—"). No data is changed.
-- Must run BEFORE the new backend starts — the Standup list/create/update statements reference this column.

ALTER TABLE standups ADD COLUMN IF NOT EXISTS progress SMALLINT;
-- How the percent was made: JSON status -> number of items, e.g. {"done":1,"in_review":1,"in_progress":1}
ALTER TABLE standups ADD COLUMN IF NOT EXISTS progress_detail TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'standups_progress_check') THEN
    ALTER TABLE standups ADD CONSTRAINT standups_progress_check CHECK (progress IS NULL OR progress BETWEEN 0 AND 100);
  END IF;
END $$;

SELECT 'Migration v30 selesai.' AS status;
