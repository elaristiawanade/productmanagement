-- Pratinjau migration_v34.sql — READ-ONLY (hanya SELECT, tidak mengubah data apa pun).
-- Jalankan dulu sebelum migration_v34.sql untuk melihat apa yang akan terjadi:
--   psql -U postgres -d product_tracker -f migration_v34_preview.sql
-- Aturannya sama dengan migrasi: pasangan dicari dari nama yang sama (tanpa beda huruf besar/kecil dan spasi tepi)
-- di produk yang sama; versi Roadmap dipertahankan; Feature = master untuk nama dan status.

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

-- Simulasi hasil akhir (dipakai beberapa bagian di bawah)
CREATE TEMP VIEW v34_fn AS
  SELECT f.id, f.product_id, f.code, f.name, f.target_release AS fv, f.status AS fs_raw,
         CASE f.status WHEN 'in_progress' THEN 'in_development' WHEN 'done' THEN 'released' ELSE f.status END AS fs
  FROM features f;

CREATE TEMP VIEW v34_newpair AS
  SELECT r.id AS rid, f.id AS fid FROM (
    SELECT id, product_id, lower(btrim(feature_name)) AS k,
           row_number() OVER (PARTITION BY product_id, lower(btrim(feature_name)) ORDER BY id) AS rn
    FROM product_roadmap WHERE source_feature_id IS NULL) r
  JOIN (
    SELECT ft.id, ft.product_id, lower(btrim(ft.name)) AS k,
           row_number() OVER (PARTITION BY ft.product_id, lower(btrim(ft.name)) ORDER BY ft.id) AS rn
    FROM features ft WHERE NOT EXISTS (SELECT 1 FROM product_roadmap x WHERE x.source_feature_id = ft.id)) f
  ON f.product_id = r.product_id AND f.k = r.k AND f.rn = r.rn;

CREATE TEMP VIEW v34_pairs AS
  WITH p AS (
    SELECT r.id AS rid, r.source_feature_id AS fid, 'sudah terhubung' AS jenis FROM product_roadmap r WHERE r.source_feature_id IS NOT NULL
    UNION ALL
    SELECT rid, fid, 'BARU dipasangkan' FROM v34_newpair
  ), c AS (
    SELECT p.jenis, r.id AS rid, r.product_id, r.feature_name AS rname, r.status AS rs, r.product_version AS rv,
           fn.code, fn.name AS fname, fn.fs_raw, fn.fv,
           CASE WHEN fn.fs = 'not_started' AND r.status IN ('research', 'offline') THEN r.status ELSE fn.fs END AS fs_new
    FROM p JOIN product_roadmap r ON r.id = p.rid JOIN v34_fn fn ON fn.id = p.fid
  )
  SELECT c.*,
         CASE WHEN fs_new = 'on_hold' THEN rs ELSE pg_temp.rm_status_for(fs_new) END AS rs_new,
         CASE WHEN COALESCE(btrim(rv), '') <> '' THEN btrim(rv) ELSE fv END AS ver_new
  FROM c;

\echo '=== Keadaan sekarang ==='
SELECT (SELECT COUNT(*) FROM features)                                         AS total_feature,
       (SELECT COUNT(*) FROM product_roadmap)                                  AS total_roadmap,
       (SELECT COUNT(*) FROM product_roadmap WHERE source_feature_id IS NULL)  AS roadmap_belum_terhubung,
       (SELECT COUNT(*) FROM features f WHERE NOT EXISTS
          (SELECT 1 FROM product_roadmap r WHERE r.source_feature_id = f.id))  AS feature_tanpa_roadmap,
       (SELECT COUNT(*) FROM features WHERE status IN ('in_progress', 'done')) AS status_lama_dirapikan;

\echo ''
\echo '=== A. Pasangan Roadmap <-> Feature: yang BARU dipasangkan, atau yang datanya akan berubah ==='
SELECT pr.code AS produk, v.jenis, v.rid AS roadmap_id, v.rname AS nama_roadmap, v.code AS feature, v.fname AS nama_feature,
       v.rs AS status_roadmap, v.fs_raw AS status_feature,
       CASE WHEN v.fs_new <> v.fs_raw THEN 'Feature → ' || v.fs_new ELSE '' END
         || CASE WHEN v.rs_new IS DISTINCT FROM v.rs THEN ' Roadmap → ' || v.rs_new ELSE '' END AS perubahan_status,
       v.rv AS versi_roadmap, v.fv AS versi_feature, v.ver_new AS versi_hasil,
       pg_temp.pct(v.rs_new) AS progress_hasil
FROM v34_pairs v JOIN products pr ON pr.id = v.product_id
WHERE v.jenis = 'BARU dipasangkan' OR v.fs_new <> v.fs_raw OR v.rs_new IS DISTINCT FROM v.rs
   OR v.rname IS DISTINCT FROM v.fname OR v.ver_new IS DISTINCT FROM v.rv OR v.ver_new IS DISTINCT FROM v.fv
ORDER BY pr.code, v.rid;

\echo ''
\echo '=== B. Roadmap TANPA Feature, akan dibuatkan Feature baru (kode usulan) ==='
WITH orphan AS (
  SELECT r.id, r.product_id, r.feature_name, r.status, r.product_version,
         row_number() OVER (PARTITION BY r.product_id ORDER BY r.sort_order, r.id) AS nth
  FROM product_roadmap r
  WHERE r.source_feature_id IS NULL AND r.id NOT IN (SELECT rid FROM v34_newpair)
), mx AS (
  SELECT p.id AS product_id, p.code,
         COALESCE(MAX(CASE WHEN left(f.code, length(p.code) + 3) = p.code || 'FT-'
                            AND substring(f.code FROM length(p.code) + 4) ~ '^[0-9]{1,9}$'
                           THEN substring(f.code FROM length(p.code) + 4)::INT END), 0) AS mx
  FROM products p LEFT JOIN features f ON f.product_id = p.id GROUP BY p.id, p.code
)
SELECT mx.code AS produk, o.id AS roadmap_id, o.feature_name,
       mx.code || 'FT-' || (mx.mx + o.nth) AS kode_feature_baru,
       o.status AS status_roadmap, pg_temp.ft_status_for(o.status) AS status_feature_baru,
       o.product_version AS versi, pg_temp.pct(o.status) AS progress
FROM orphan o JOIN mx ON mx.product_id = o.product_id
ORDER BY mx.code, o.nth;

\echo ''
\echo '=== C. Feature TANPA baris Roadmap, akan dibuatkan baris Roadmap ==='
SELECT p.code AS produk, fn.code, fn.name, fn.fs_raw AS status_feature,
       COALESCE(pg_temp.rm_status_for(fn.fs), 'planned') AS status_roadmap_baru
FROM v34_fn fn JOIN products p ON p.id = fn.product_id
WHERE NOT EXISTS (SELECT 1 FROM product_roadmap r WHERE r.source_feature_id = fn.id)
  AND fn.id NOT IN (SELECT fid FROM v34_newpair)
ORDER BY p.code, fn.code;

\echo ''
\echo '=== D. Progress produk SETELAH migrasi (rata-rata progress Feature; tidak lagi dari Backlog) ==='
WITH after AS (
  SELECT product_id, rs_new AS st FROM v34_pairs
  UNION ALL
  SELECT r.product_id, r.status FROM product_roadmap r
  WHERE r.source_feature_id IS NULL AND r.id NOT IN (SELECT rid FROM v34_newpair)
  UNION ALL
  SELECT fn.product_id, COALESCE(pg_temp.rm_status_for(fn.fs), 'planned') FROM v34_fn fn
  WHERE NOT EXISTS (SELECT 1 FROM product_roadmap x WHERE x.source_feature_id = fn.id)
    AND fn.id NOT IN (SELECT fid FROM v34_newpair)
)
SELECT p.code AS produk, p.name, COUNT(*) AS jumlah_feature, ROUND(AVG(COALESCE(pg_temp.pct(st), 20))) AS progress_produk_baru
FROM after JOIN products p ON p.id = after.product_id
GROUP BY p.code, p.name
ORDER BY p.code;

\echo ''
\echo '=== E. Perlu dicek manual (idealnya kosong) ==='
\echo 'E1. Nama kembar dalam satu produk (dipasangkan berurutan menurut id)'
SELECT p.code AS produk, 'roadmap' AS tabel, lower(btrim(feature_name)) AS nama, COUNT(*) AS jumlah
FROM product_roadmap r JOIN products p ON p.id = r.product_id WHERE r.source_feature_id IS NULL
GROUP BY p.code, lower(btrim(feature_name)) HAVING COUNT(*) > 1
UNION ALL
SELECT p.code, 'feature', lower(btrim(f.name)), COUNT(*)
FROM features f JOIN products p ON p.id = f.product_id GROUP BY p.code, lower(btrim(f.name)) HAVING COUNT(*) > 1;

\echo 'E2. Feature yang sudah punya lebih dari satu baris roadmap (menghalangi indeks unik)'
SELECT source_feature_id, COUNT(*) AS jumlah_baris FROM product_roadmap
WHERE source_feature_id IS NOT NULL GROUP BY source_feature_id HAVING COUNT(*) > 1;

\echo 'E3. Versi roadmap lebih dari 50 karakter (tidak mungkin, hanya pengaman)'
SELECT id, feature_name FROM product_roadmap WHERE length(product_version) > 50;
