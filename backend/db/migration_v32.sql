-- Migration v32: Stage Bugs Incident bisa diatur (configurable) + convert Bug "Improvement" ke Backlog
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v32.sql
--
-- 1) STAGE CONFIGURABLE
--    Sebelumnya Stage hanya 6 nilai tetap di kode (open, in_progress, ready_to_test, reopen, done, improvement).
--    Sekarang daftarnya ada di tabel `bug_stages` dan Super Admin bisa MENAMBAH Stage baru dari halaman
--    Bug Stages (pola yang sama dengan bug_types di migration_v31).
--
--      bug_stages  code        slug stabil (TIDAK pernah berubah) = nilai yang disimpan di bugs.stage
--                  name/color  label dan warna badge; bebas diubah
--                  is_builtin  6 Stage bawaan: tidak bisa dihapus, perilakunya terkunci
--                  is_closed   Stage dianggap selesai: mengisi bugs.closed_at, ikut "Closed/Done disembunyikan",
--                              dihitung di resolution rate (dulu: stage = 'done')
--                  not_late    Deadline tidak pernah merah di Stage ini (dulu: done + ready_to_test)
--                  counts_open dihitung di kartu "Open" dashboard (dulu: open + in_progress + reopen)
--
--    Data awal memuat 6 Stage lama dengan flag yang membuat perilakunya IDENTIK dengan sebelumnya.
--    bugs.stage tetap kolom teks berisi `code`; ditambah FOREIGN KEY ke bug_stages(code) ON DELETE RESTRICT.
--    bug_progress_updates.stage sengaja TANPA foreign key: itu riwayat, dan tetap terbaca walau Stage-nya
--    sudah dihapus.
--
-- 2) TYPE "IMPROVEMENT" BAWAAN
--    Tombol "Buat Backlog" muncul untuk tiket ber-Type `improvement`. Type itu dijamin ada (dan tidak bisa
--    dihapus, namanya boleh diubah). Kalau sudah ada, tidak diubah sama sekali.
--
-- 3) KONVERSI KE BACKLOG
--    bugs.converted_backlog_id = kartu Backlog yang dibuat dari tiket ini (NULL = belum dikonversi).
--    Kolom `backlog_item_id` yang lama TIDAK dipakai: artinya "tiket ini terkait item X", bukan hasil konversi.
--    ON DELETE SET NULL: kalau kartunya dihapus, tiket boleh dikonversi lagi.
--
-- Idempotent. Harus dijalankan SEBELUM backend baru naik: BugController membaca tabel dan kolom ini.

CREATE TABLE IF NOT EXISTS bug_stages (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(50)  NOT NULL UNIQUE,
  name         VARCHAR(50)  NOT NULL,
  color        VARCHAR(20)  NOT NULL DEFAULT '#64748B',
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  is_builtin   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_closed    BOOLEAN      NOT NULL DEFAULT FALSE,
  not_late     BOOLEAN      NOT NULL DEFAULT FALSE,
  counts_open  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO bug_stages (code, name, color, sort_order, is_builtin, is_closed, not_late, counts_open) VALUES
  ('open',          'Open',          '#E5484D', 1, TRUE, FALSE, FALSE, TRUE),
  ('in_progress',   'In Progress',   '#3E63DD', 2, TRUE, FALSE, FALSE, TRUE),
  ('ready_to_test', 'Ready to Test', '#D9891A', 3, TRUE, FALSE, TRUE,  FALSE),
  ('reopen',        'Re-Open',       '#9B51E0', 4, TRUE, FALSE, FALSE, TRUE),
  ('done',          'Done',          '#1F9D55', 5, TRUE, TRUE,  TRUE,  FALSE),
  ('improvement',   'Improvement',   '#0B8FCB', 6, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- Pengaman: kalau ada tiket dengan nilai Stage di luar daftar di atas (data lama), daftarkan dulu sebagai Stage
-- biasa supaya FOREIGN KEY di bawah tidak gagal dan tidak ada tiket yang berubah.
INSERT INTO bug_stages (code, name, color, sort_order, counts_open)
SELECT DISTINCT b.stage, b.stage, '#64748B', 100, TRUE
FROM bugs b
WHERE b.stage IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bug_stages s WHERE s.code = b.stage)
ON CONFLICT (code) DO NOTHING;

-- Kode Stage baru bisa sampai 50 karakter (dulu VARCHAR(30)).
ALTER TABLE bugs                  ALTER COLUMN stage TYPE VARCHAR(50);
ALTER TABLE bug_progress_updates  ALTER COLUMN stage TYPE VARCHAR(50);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bugs_stage_fkey') THEN
    ALTER TABLE bugs ADD CONSTRAINT bugs_stage_fkey
      FOREIGN KEY (stage) REFERENCES bug_stages(code) ON DELETE RESTRICT;
  END IF;
END $$;

-- Type "Improvement" bawaan (pemicu tombol Buat Backlog)
INSERT INTO bug_types (code, name, color, sort_order)
SELECT 'improvement', 'Improvement', '#8B5CF6', COALESCE((SELECT MAX(sort_order) FROM bug_types), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM bug_types WHERE code = 'improvement');

-- Hasil konversi ke Backlog
ALTER TABLE bugs ADD COLUMN IF NOT EXISTS converted_backlog_id INTEGER REFERENCES backlog_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bugs_converted_backlog ON bugs(converted_backlog_id);

SELECT 'Migration v32 selesai.' AS status;
