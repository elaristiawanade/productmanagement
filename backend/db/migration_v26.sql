-- Migration v26: Client Management (daftar bank/klien pemakai produk internal)
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v26.sql
--
-- Tabel baru (semuanya additive + idempotent, tidak mengubah tabel lama):
--   client_statuses  status client yang bisa diatur dari halaman Client Settings
--                    (Approaching / Declined / Active / Sunset / Deactivated sebagai data awal)
--   clients          satu baris = satu kontrak (bank_name TIDAK unik: kalau satu bank punya
--                    beberapa kontrak, tambahkan baris baru secara manual)
--   client_products  produk internal yang dipakai client (many-to-many, mirror user_products)
--   client_comments  riwayat catatan update per client (siapa, kapan, isi)
--
-- Permission: modul baru `clients` (access/create/update/delete) DIGABUNGKAN ke roles.permissions
-- dengan operator jsonb `||`, BUKAN ditimpa seperti v21, supaya edit permission yang sudah dibuat
-- admin lewat UI tidak hilang. Role lain tidak mendapat akses (bisa diatur di Users & Roles).
--
-- Harus dijalankan SEBELUM backend baru naik: endpoint /api/clients membaca tabel-tabel ini.

-- ─── CLIENT STATUSES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_statuses (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,   -- slug stabil, dibuat otomatis dari nama
  name        VARCHAR(50)  NOT NULL,
  color       VARCHAR(20)  NOT NULL DEFAULT '#64748B',
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO client_statuses (code, name, color, sort_order) VALUES
  ('approaching',  'Approaching',  '#D9891A', 1),
  ('declined',    'Declined',     '#E5484D', 2),
  ('active',      'Active',       '#1F9D55', 3),
  ('sunset',      'Sunset',       '#E8740F', 4),
  ('deactivated', 'Deactivated',  '#7C8494', 5)
ON CONFLICT (code) DO NOTHING;

-- ─── CLIENTS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id             SERIAL PRIMARY KEY,
  bank_name      VARCHAR(150) NOT NULL,
  city           VARCHAR(100),
  -- RESTRICT: status yang masih dipakai tidak bisa dihapus (controller menjawab 409 dengan pesan jelas)
  status_id      INTEGER      NOT NULL REFERENCES client_statuses(id) ON DELETE RESTRICT,
  contract_no    VARCHAR(100),
  revenue        NUMERIC(18,2) CHECK (revenue IS NULL OR revenue >= 0),   -- nilai per kontrak, Rupiah
  contract_start DATE,
  contract_end   DATE,
  -- PIC tim inhouse (default-nya Product Owner produk, bisa diganti). SET NULL: hapus user permanen tidak gagal
  pic_id         INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_by     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT clients_contract_dates_check
    CHECK (contract_start IS NULL OR contract_end IS NULL OR contract_end >= contract_start)
);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status_id);
CREATE INDEX IF NOT EXISTS idx_clients_pic    ON clients(pic_id);

-- ─── CLIENT_PRODUCTS (many-to-many, mirrors user_products) ───────────────────

CREATE TABLE IF NOT EXISTS client_products (
  client_id   INTEGER   NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  product_id  INTEGER   NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_client_products_product ON client_products(product_id);

-- ─── CLIENT_COMMENTS (mirrors bug_activities, comment-only) ──────────────────

CREATE TABLE IF NOT EXISTS client_comments (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER   NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id     INTEGER   REFERENCES users(id) ON DELETE SET NULL,
  content     TEXT      NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_comments ON client_comments(client_id, created_at);

-- ─── PERMISSIONS: gabungkan modul `clients` (tidak menimpa permission lain) ───

UPDATE roles SET permissions = COALESCE(permissions, '{}'::jsonb)
  || '{"clients": {"access": true, "create": true, "update": true, "delete": true}}'::jsonb
  WHERE name IN ('super_admin', 'manager');

UPDATE roles SET permissions = COALESCE(permissions, '{}'::jsonb)
  || '{"clients": {"access": true, "update": true}}'::jsonb
  WHERE name = 'po';

SELECT 'Migration v26 selesai.' AS status;
