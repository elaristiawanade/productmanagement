-- Migration v27: Impacted Features (satu backlog item bisa punya banyak feature)
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v27.sql
--
-- Join table backlog_item_features: satu baris = satu feature roadmap (product_roadmap) yang
-- terdampak oleh satu backlog item. backlog_items.feature_id DIPERTAHANKAN sebagai feature
-- "pertama" (pola sama seperti backlog_items.assignee_id vs backlog_item_assignees di v19), jadi
-- semua query lama yang membaca feature_id / feature_name tetap jalan tanpa diubah.
--
-- Additive + idempotent. Menghapus feature roadmap / backlog item otomatis menghapus baris
-- penghubungnya (ON DELETE CASCADE) tanpa menghapus item-nya.
--
-- Harus dijalankan SEBELUM backend baru naik: BacklogController membaca & menulis tabel ini,
-- tanpa migrasi create/edit/list backlog gagal 500.

CREATE TABLE IF NOT EXISTS backlog_item_features (
  backlog_item_id  INTEGER   NOT NULL REFERENCES backlog_items(id)   ON DELETE CASCADE,
  roadmap_id       INTEGER   NOT NULL REFERENCES product_roadmap(id) ON DELETE CASCADE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (backlog_item_id, roadmap_id)
);

CREATE INDEX IF NOT EXISTS idx_backlog_item_features_roadmap ON backlog_item_features(roadmap_id);

-- Backfill: setiap feature_id yang sudah ada menjadi satu baris penghubung.
INSERT INTO backlog_item_features (backlog_item_id, roadmap_id)
SELECT id, feature_id
FROM backlog_items
WHERE feature_id IS NOT NULL
ON CONFLICT (backlog_item_id, roadmap_id) DO NOTHING;

SELECT 'Migration v27 selesai.' AS status;
