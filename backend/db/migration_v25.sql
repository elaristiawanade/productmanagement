-- Migration v25: QA test case attachments (images + office/document files)
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v25.sql
--
-- Mirrors bug_attachments / backlog_attachments, but linked to qa_test_cases.
-- ON DELETE CASCADE: deleting a test case removes its attachment rows (same as bugs).
-- Additive and idempotent. Must run BEFORE the new backend serves attachments — the file
-- download endpoint looks the original file name up in this table.

CREATE TABLE IF NOT EXISTS qa_attachments (
  id             SERIAL PRIMARY KEY,
  test_case_id   INTEGER      NOT NULL REFERENCES qa_test_cases(id) ON DELETE CASCADE,
  filename       VARCHAR(255) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  file_size      INTEGER,
  mime_type      VARCHAR(100),
  uploaded_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_attachments ON qa_attachments(test_case_id);

SELECT 'Migration v25 selesai.' AS status;
