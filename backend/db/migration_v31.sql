-- Migration v31: Type tiket Bugs Incident bisa diatur (configurable)
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v31.sql
--
-- Sebelumnya Type hanya dua nilai tetap (`bug` / `inquiry`, CHECK di migration_v24). Sekarang daftarnya
-- ada di tabel `bug_types` dan diatur Super Admin dari halaman Bug Types (pola yang sama dengan
-- client_statuses di migration_v26).
--
--   bug_types   code  slug stabil (dibuat otomatis dari nama, TIDAK pernah berubah) = nilai yang disimpan di bugs.type
--               name  label yang tampil; bebas diubah
--               color warna badge
--   bugs.type   tetap kolom teks berisi `code`, jadi export/import CSV dan semua query lama tetap jalan.
--               CHECK `bugs_type_check` dihapus dan diganti FOREIGN KEY ke bug_types(code) ON DELETE RESTRICT:
--               Type yang masih dipakai tiket tidak bisa dihapus (controller menjawab 409 dengan pesan jelas).
--
-- Data awal `bug` dan `inquiry` dimasukkan lebih dulu, jadi semua tiket yang sudah ada tetap valid dan
-- tidak ada data yang berubah. `bug` adalah Type bawaan (dipakai form lapor publik dan kolom kosong),
-- sehingga controller menolak menghapusnya (namanya tetap boleh diubah).
-- Idempotent. Harus dijalankan SEBELUM backend baru naik: BugController membaca tabel ini.

CREATE TABLE IF NOT EXISTS bug_types (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,
  name        VARCHAR(50)  NOT NULL,
  color       VARCHAR(20)  NOT NULL DEFAULT '#64748B',
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO bug_types (code, name, color, sort_order) VALUES
  ('bug',     'Bug',                     '#E5484D', 1),
  ('inquiry', 'Inquiry / Clarification', '#0B8FCB', 2)
ON CONFLICT (code) DO NOTHING;

-- bugs.type dulu VARCHAR(20); code baru bisa sampai 50 karakter.
ALTER TABLE bugs ALTER COLUMN type TYPE VARCHAR(50);

ALTER TABLE bugs DROP CONSTRAINT IF EXISTS bugs_type_check;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bugs_type_fkey') THEN
    ALTER TABLE bugs ADD CONSTRAINT bugs_type_fkey
      FOREIGN KEY (type) REFERENCES bug_types(code) ON DELETE RESTRICT;
  END IF;
END $$;

SELECT 'Migration v31 selesai.' AS status;
