-- Migration v24: Ticket type on Bugs Incident (bug vs inquiry/clarification)
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v24.sql
--
-- A ticket is either a real 'bug' or an 'inquiry' (a report that is unclear and needs
-- clarification before it can be treated as a bug). This is independent of `stage`
-- (stage 'improvement' = idea/feedback, unrelated to type).
--
-- NOT NULL DEFAULT 'bug': every existing row, and every INSERT that does not mention the
-- column (e.g. the public /report-bug form), becomes a regular bug — nothing changes for them.
-- Must run BEFORE the new backend starts — its INSERT/UPDATE statements reference this column.

ALTER TABLE bugs ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'bug';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bugs_type_check') THEN
    ALTER TABLE bugs ADD CONSTRAINT bugs_type_check CHECK (type IN ('bug', 'inquiry'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bugs_type ON bugs(type);

SELECT 'Migration v24 selesai.' AS status;
