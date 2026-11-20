-- Migration v34: Feature = master, Roadmap = turunannya (satu Feature = satu baris Roadmap)
-- Jalankan SEKALI per database SETELAH migration_v33.sql dan SEBELUM backend baru naik. Aman diulang (idempotent).
--
--   psql -U postgres -d product_tracker -f migration_v34_preview.sql   (read-only: lihat dulu apa yang akan berubah)
--   psql -U postgres -d product_tracker -f migration_v34.sql
--
-- Yang dilakukan (semuanya dalam satu transaksi; gagal di tengah = tidak ada yang berubah):
--   1. features.target_release dilebarkan ke VARCHAR(50), sama dengan product_roadmap.product_version.
--   2. Status Feature lama dari seed/impor dirapikan: in_progress → in_development, done → released
--      (form Feature tidak punya pilihan itu, sehingga status tersebut diam-diam berubah saat Feature disimpan).
--   3. Baris Roadmap yang belum terhubung dipasangkan dengan Feature berdasarkan NAMA (tanpa beda huruf besar/kecil
--      dan spasi tepi) di produk yang sama, lalu source_feature_id diisi. Baris Roadmap TIDAK dihapus/dibuat ulang,
--      jadi kaitan Backlog (Impacted Features, label relasi) dan riwayat statusnya tetap utuh.
--   4. Semua pasangan diselaraskan:
--        - versi: versi Roadmap DIPERTAHANKAN dan disalin ke Feature (mis. Q4-26); Roadmap tanpa versi mengambil versi Feature
--        - status: Roadmap Research/Offline dengan Feature not_started → Feature ikut Research/Offline (dulu Feature tidak
--          punya status itu); selain itu status Roadmap mengikuti Feature, kecuali Feature On Hold (Roadmap tetap, persen tetap)
--        - nama Roadmap mengikuti nama Feature
--   5. Baris Roadmap tanpa Feature dibuatkan Feature otomatis: kode {kode produk}FT-{nomor berikutnya}, status dari status
--      Roadmap, versi disalin, prioritas medium, target_date dikosongkan (Roadmap hanya tahu bulan).
--   6. Feature tanpa baris Roadmap dibuatkan baris Roadmap, dan semua Feature diberi is_roadmap_item = TRUE.
--   7. Indeks unik: satu Feature hanya boleh punya satu baris Roadmap.
--
-- Status  Feature → Roadmap → Progress:  not_started → planned 20% · research → research 40% · in_development → on_progress 60%
--                                         testing → testing 80% · released → active 100% · offline → offline 100%
--                                         on_hold → (status Roadmap tidak diubah, persen tetap yang terakhir)
-- Progress produk = rata-rata progress Feature-nya. Tidak ada yang dihitung dari Backlog.

BEGIN;

CREATE FUNCTION pg_temp.rm_status_for(fs TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE fs WHEN 'research' THEN 'research'
                 WHEN 'in_development' THEN 'on_progress' WHEN 'in_progress' THEN 'on_progress'
                 WHEN 'testing' THEN 'testing'
                 WHEN 'released' THEN 'active' WHEN 'done' THEN 'active'
                 WHEN 'offline' THEN 'offline'
                 WHEN 'on_hold' THEN NULL
                 ELSE 'planned' END
$$;
CREATE FUNCTION pg_temp.ft_status_for(rs TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE rs WHEN 'research' THEN 'research' WHEN 'on_progress' THEN 'in_development'
                 WHEN 'testing' THEN 'testing' WHEN 'active' THEN 'released' WHEN 'offline' THEN 'offline'
                 ELSE 'not_started' END
$$;
CREATE FUNCTION pg_temp.pct(rs TEXT) RETURNS INT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE rs WHEN 'planned' THEN 20 WHEN 'research' THEN 40 WHEN 'on_progress' THEN 60
                 WHEN 'testing' THEN 80 WHEN 'active' THEN 100 WHEN 'offline' THEN 100 END
$$;

-- 1. Kolom versi Feature sama lebarnya dengan versi Roadmap
ALTER TABLE features ALTER COLUMN target_release TYPE VARCHAR(50);

-- 2. Status Feature lama dirapikan
UPDATE features SET status = CASE status WHEN 'in_progress' THEN 'in_development' ELSE 'released' END
WHERE status IN ('in_progress', 'done');

-- 3. Pasangkan baris Roadmap yang belum terhubung dengan Feature (nama sama, produk sama; kalau namanya kembar,
--    dipasangkan berurutan menurut id)
WITH r AS (
  SELECT id, product_id, lower(btrim(feature_name)) AS k,
         row_number() OVER (PARTITION BY product_id, lower(btrim(feature_name)) ORDER BY id) AS rn
  FROM product_roadmap
  WHERE source_feature_id IS NULL
), f AS (
  SELECT ft.id, ft.product_id, lower(btrim(ft.name)) AS k,
         row_number() OVER (PARTITION BY ft.product_id, lower(btrim(ft.name)) ORDER BY ft.id) AS rn
  FROM features ft
  WHERE NOT EXISTS (SELECT 1 FROM product_roadmap x WHERE x.source_feature_id = ft.id)
)
UPDATE product_roadmap pr
SET source_feature_id = f.id
FROM r JOIN f ON f.product_id = r.product_id AND f.k = r.k AND f.rn = r.rn
WHERE pr.id = r.id;

-- 4a. Versi: versi Roadmap dipertahankan dan disalin ke Feature; Roadmap tanpa versi mengambil versi Feature
UPDATE features f
SET target_release = btrim(r.product_version)
FROM product_roadmap r
WHERE r.source_feature_id = f.id
  AND COALESCE(btrim(r.product_version), '') <> ''
  AND f.target_release IS DISTINCT FROM btrim(r.product_version);

UPDATE product_roadmap r
SET product_version = f.target_release
FROM features f
WHERE r.source_feature_id = f.id
  AND COALESCE(btrim(r.product_version), '') = ''
  AND COALESCE(btrim(f.target_release), '') <> '';

-- 4b. Status: Research/Offline di Roadmap turun ke Feature yang masih not_started; selain itu Roadmap mengikuti Feature
--     (Feature On Hold tidak mengubah Roadmap)
UPDATE features f
SET status = r.status
FROM product_roadmap r
WHERE r.source_feature_id = f.id
  AND f.status = 'not_started'
  AND r.status IN ('research', 'offline');

UPDATE product_roadmap r
SET status = pg_temp.rm_status_for(f.status)
FROM features f
WHERE r.source_feature_id = f.id
  AND f.status <> 'on_hold'
  AND r.status IS DISTINCT FROM pg_temp.rm_status_for(f.status);

-- 4c. Nama Roadmap mengikuti Feature
UPDATE product_roadmap r
SET feature_name = f.name
FROM features f
WHERE r.source_feature_id = f.id
  AND r.feature_name IS DISTINCT FROM f.name;

-- 5. Baris Roadmap tanpa Feature → buatkan Feature (kode {kode produk}FT-{n})
DO $$
DECLARE
  rec   RECORD;
  pcode TEXT;
  n     INT;
  fid   INT;
BEGIN
  FOR rec IN
    SELECT id, product_id, feature_name, status, product_version
    FROM product_roadmap
    WHERE source_feature_id IS NULL
    ORDER BY product_id, sort_order, id
  LOOP
    SELECT code INTO pcode FROM products WHERE id = rec.product_id;
    SELECT COALESCE(MAX(CASE WHEN left(code, length(pcode) + 3) = pcode || 'FT-'
                              AND substring(code FROM length(pcode) + 4) ~ '^[0-9]{1,9}$'
                             THEN substring(code FROM length(pcode) + 4)::INT END), 0) + 1
      INTO n
    FROM features WHERE product_id = rec.product_id;

    INSERT INTO features (product_id, code, name, status, priority, target_release, is_roadmap_item)
    VALUES (rec.product_id, pcode || 'FT-' || n, rec.feature_name, pg_temp.ft_status_for(rec.status),
            'medium', btrim(rec.product_version), TRUE)
    RETURNING id INTO fid;

    UPDATE product_roadmap SET source_feature_id = fid WHERE id = rec.id;
  END LOOP;
END $$;

-- 6. Feature tanpa baris Roadmap → buatkan; semua Feature menjadi roadmap item
INSERT INTO product_roadmap (product_id, feature_name, status, product_version, month_release_target, sort_order, source_feature_id)
SELECT f.product_id, f.name, COALESCE(pg_temp.rm_status_for(f.status), 'planned'), f.target_release,
       date_trunc('month', f.target_date)::DATE, 0, f.id
FROM features f
WHERE NOT EXISTS (SELECT 1 FROM product_roadmap r WHERE r.source_feature_id = f.id);

UPDATE features SET is_roadmap_item = TRUE WHERE is_roadmap_item IS DISTINCT FROM TRUE;

-- 7. Satu Feature = satu baris Roadmap
CREATE UNIQUE INDEX IF NOT EXISTS uq_roadmap_source_feature
  ON product_roadmap (source_feature_id) WHERE source_feature_id IS NOT NULL;

-- Hasil: kedua angka "tanpa pasangan" harus 0
SELECT (SELECT COUNT(*) FROM features)                                          AS total_feature,
       (SELECT COUNT(*) FROM product_roadmap)                                   AS total_roadmap,
       (SELECT COUNT(*) FROM product_roadmap WHERE source_feature_id IS NULL)   AS roadmap_tanpa_feature,
       (SELECT COUNT(*) FROM features f WHERE NOT EXISTS
          (SELECT 1 FROM product_roadmap r WHERE r.source_feature_id = f.id))   AS feature_tanpa_roadmap;

-- Progress produk yang baru (rata-rata progress Feature), sama dengan yang tampil di halaman Products
SELECT p.code AS produk, COUNT(f.id) AS jumlah_feature, ROUND(AVG(COALESCE(pg_temp.pct(r.status), 20))) AS progress_produk
FROM products p
JOIN features f ON f.product_id = p.id
LEFT JOIN product_roadmap r ON r.source_feature_id = f.id
GROUP BY p.code
ORDER BY p.code;

COMMIT;

SELECT 'Migration v34 selesai.' AS status;
