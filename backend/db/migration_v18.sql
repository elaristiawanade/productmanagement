-- Migration v18: Public Bug Report (unauthenticated bug submission)
-- Run once on existing database:
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v18.sql
--
-- Adds reporter identity fields for bugs submitted through the new unauthenticated
-- public report form (POST /api/public/bugs). `reported_by` stays NULL for these
-- rows (no `users` account exists for an anonymous reporter); reporter_name /
-- reporter_email capture the plain-text identity instead.

ALTER TABLE bugs ADD COLUMN IF NOT EXISTS reporter_name  VARCHAR(150);
ALTER TABLE bugs ADD COLUMN IF NOT EXISTS reporter_email VARCHAR(150);

SELECT 'Migration v18 selesai.' AS status;
