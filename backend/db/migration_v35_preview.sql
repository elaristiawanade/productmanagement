-- Pratinjau migration_v35.sql — READ-ONLY (hanya SELECT, tidak mengubah data apa pun).
-- Jalankan dulu sebelum migration_v35.sql untuk melihat status baru tiap test case:
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v35_preview.sql
-- Aturannya sama dengan migrasi:
--   draft -> draft; active -> dari run terakhir (Pass -> finish, Fail/Blocked -> in_progress, lainnya -> todo);
--   deprecated -> finish. Status yang sudah baru tidak diubah.

CREATE TEMP VIEW v35_map AS
  SELECT tc.id, p.code AS produk, tc.code, tc.title, tc.status AS status_lama, lr.result AS run_terakhir,
         CASE
           WHEN tc.status = 'active' THEN
             CASE lr.result WHEN 'pass' THEN 'finish' WHEN 'fail' THEN 'in_progress'
                            WHEN 'blocked' THEN 'in_progress' ELSE 'todo' END
           WHEN tc.status = 'deprecated' THEN 'finish'
           ELSE tc.status
         END AS status_baru
  FROM qa_test_cases tc
  LEFT JOIN products p ON p.id = tc.product_id
  LEFT JOIN LATERAL (SELECT r.result FROM qa_test_runs r WHERE r.test_case_id = tc.id
                     ORDER BY COALESCE(r.executed_at, r.created_at) DESC, r.id DESC LIMIT 1) lr ON TRUE;

-- A. Ringkasan: berapa test case pindah dari status lama ke status baru
SELECT status_lama, COALESCE(run_terakhir, '(belum di-run)') AS run_terakhir, status_baru, COUNT(*) AS jumlah
FROM v35_map
GROUP BY status_lama, run_terakhir, status_baru
ORDER BY status_lama, status_baru, run_terakhir;

-- B. Rincian test case yang statusnya berubah
SELECT produk, code, title, status_lama, COALESCE(run_terakhir, '(belum di-run)') AS run_terakhir, status_baru
FROM v35_map
WHERE status_lama IS DISTINCT FROM status_baru
ORDER BY produk, code;

-- C. Status di luar daftar yang dikenal (seharusnya kosong; bila ada, statusnya tidak diubah migrasi dan
--    perlu dicek manual)
SELECT produk, code, title, status_lama
FROM v35_map
WHERE status_lama NOT IN ('draft', 'active', 'deprecated', 'todo', 'in_progress', 'in_review', 'finish')
ORDER BY produk, code;

-- D. Sebaran status sesudah migrasi
SELECT status_baru AS status, COUNT(*) AS jumlah FROM v35_map GROUP BY status_baru ORDER BY status_baru;
