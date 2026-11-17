-- Migration v28: hak akses "Export MD" (paket data produk dalam satu file Markdown untuk AI)
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v28.sql
--
-- Tombol "Export MD" di Products hanya tampil untuk role dengan permission export.md. Super Admin
-- selalu bisa (bypass). Migrasi ini memberi akses default ke Manager, Product Owner, dan QA
-- Engineer; role lain bisa dicentang lewat Users & Roles -> Roles & Permissions (modul "Export MD").
--
-- Permission DIGABUNGKAN ke roles.permissions dengan operator jsonb `||` (pola v26), jadi edit
-- permission yang sudah dibuat admin lewat UI tidak hilang. Idempotent.
--
-- OPSIONAL dan aman dijalankan kapan saja: tidak ada tabel/kolom baru dan backend tidak berubah.
-- Tanpa migrasi ini fitur tetap jalan, hanya Super Admin yang melihat tombolnya sampai role lain
-- dicentang manual. Isi file export tetap mengikuti hak akses data akun pengekspor.

UPDATE roles SET permissions = COALESCE(permissions, '{}'::jsonb)
  || '{"export": {"md": true}}'::jsonb
  WHERE name IN ('super_admin', 'manager', 'po', 'qa');

SELECT 'Migration v28 selesai.' AS status;
