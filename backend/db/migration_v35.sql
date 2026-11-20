-- Migration v35: QA Test Case — Assignee (bisa lebih dari satu) + status baru
-- Run once on existing database (back it up first, lihat dulu migration_v35_preview.sql):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v35_preview.sql
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v35.sql
--
-- 1. Tabel penghubung qa_test_case_assignees: satu baris = satu user yang di-assign ke satu test case.
--    Pola sama seperti bug_assignees (v20) dan backlog_item_assignees (v19); assignee pertama ditandai
--    is_primary. Test case tidak punya kolom assignee lama, jadi tidak ada backfill (semua mulai kosong).
--    Menghapus test case / user otomatis menghapus baris penghubungnya (ON DELETE CASCADE).
--
-- 2. Status test case diganti mengikuti status kartu Backlog:
--      draft, active, deprecated  ->  draft, todo, in_progress, in_review, finish
--    Pemetaan data lama:
--      draft                         -> draft (tetap)
--      active + run terakhir Pass     -> finish
--      active + run terakhir Fail     -> in_progress
--      active + run terakhir Blocked  -> in_progress
--      active + belum pernah di-run / Pending / Skip -> todo
--      deprecated                    -> finish
--    "Run terakhir" = urutan yang sama dengan aplikasi: executed_at (bila kosong created_at) terbaru, lalu id.
--    Progress % test case TIDAK berubah (tetap dari hasil run terakhir).
--
-- Additive + idempotent (status yang sudah baru tidak disentuh lagi), satu transaksi.
-- Harus dijalankan SEBELUM backend baru naik: QaController membaca & menulis qa_test_case_assignees,
-- tanpa migrasi daftar / buat / edit test case gagal 500.

BEGIN;

CREATE TABLE IF NOT EXISTS qa_test_case_assignees (
  test_case_id  INTEGER     NOT NULL REFERENCES qa_test_cases(id) ON DELETE CASCADE,
  user_id       INTEGER     NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  is_primary    BOOLEAN     NOT NULL DEFAULT false,
  assigned_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (test_case_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_qa_test_case_assignees_user ON qa_test_case_assignees(user_id);

UPDATE qa_test_cases tc
SET status = CASE (SELECT r.result FROM qa_test_runs r WHERE r.test_case_id = tc.id
                   ORDER BY COALESCE(r.executed_at, r.created_at) DESC, r.id DESC LIMIT 1)
               WHEN 'pass'    THEN 'finish'
               WHEN 'fail'    THEN 'in_progress'
               WHEN 'blocked' THEN 'in_progress'
               ELSE 'todo'
             END
WHERE tc.status = 'active';

UPDATE qa_test_cases SET status = 'finish' WHERE status = 'deprecated';

COMMENT ON COLUMN qa_test_cases.status IS 'draft, todo, in_progress, in_review, finish (sejak migration_v35)';

COMMIT;

-- Sebaran status sesudah migrasi
SELECT status, COUNT(*) AS jumlah FROM qa_test_cases GROUP BY status ORDER BY status;

SELECT 'Migration v35 selesai.' AS status;
