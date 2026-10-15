#!/bin/bash
# Diagnosa StackOverflowError saat update backlog item — HANYA MEMBACA (SELECT), tidak mengubah apa pun.
#
# Penyebab: recalcAncestorSp() di BacklogController menaiki rantai parent_id secara rekursif
# tanpa deteksi siklus. Kalau rantai parent_id sebuah item membentuk loop (A->B->A, atau
# item jadi parent dirinya sendiri secara tidak langsung), update item itu akan membuat
# backend rekursi tak terbatas -> java.lang.StackOverflowError.
#
# Pakai di server:   bash deployment/diagnosa-backlog-cycle.sh [item_id] | tee diagnosa_cycle_$(date +%Y%m%d_%H%M%S).txt
# Perlu sudo docker?  DOCKER="sudo docker" bash deployment/diagnosa-backlog-cycle.sh 370
# Nama container beda?  DB_CONTAINER=xxx bash deployment/diagnosa-backlog-cycle.sh 370

DOCKER="${DOCKER:-docker}"
DB_CONTAINER="${DB_CONTAINER:-pt_postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-product_tracker}"
ITEM_ID="${1:-}"

Q()  { $DOCKER exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -P pager=off -c "$1" 2>&1; }

echo "Diagnosa siklus parent_id backlog: $(date '+%Y-%m-%d %H:%M:%S')  host: $(hostname)"

echo; echo "=== A. Semua item yang parent_id-nya adalah DIRINYA SENDIRI (self-loop) ==="
Q "SELECT id, code, title, parent_id FROM backlog_items WHERE parent_id = id;"

echo; echo "=== B. Semua rantai parent_id yang membentuk siklus (A->B->...->A) ==="
echo "(kalau hasil kosong, tidak ada siklus — cek bagian D untuk rantai yang terlalu dalam)"
Q "WITH RECURSIVE chain AS (
  SELECT id AS start_id, id, parent_id, ARRAY[id] AS path
  FROM backlog_items WHERE parent_id IS NOT NULL
  UNION ALL
  SELECT c.start_id, bi.id, bi.parent_id, c.path || bi.id
  FROM backlog_items bi
  JOIN chain c ON bi.id = c.parent_id
  WHERE bi.id <> ALL(c.path) AND array_length(c.path,1) < 50
)
SELECT DISTINCT c.start_id, bi2.id AS kembali_ke, c.path
FROM chain c
JOIN backlog_items bi2 ON bi2.id = c.parent_id
WHERE bi2.id = ANY(c.path)
ORDER BY 1;"

if [ -n "$ITEM_ID" ]; then
  echo; echo "=== C. Rantai parent item $ITEM_ID (naik sampai 50 level atau null) ==="
  Q "WITH RECURSIVE anc AS (
    SELECT id, parent_id, title, 1 AS depth, ARRAY[id] AS path
    FROM backlog_items WHERE id = $ITEM_ID
    UNION ALL
    SELECT bi.id, bi.parent_id, bi.title, anc.depth+1, anc.path || bi.id
    FROM backlog_items bi
    JOIN anc ON bi.id = anc.parent_id
    WHERE anc.depth < 50 AND bi.id <> ALL(anc.path)
  )
  SELECT * FROM anc ORDER BY depth;"
fi

echo; echo "=== D. Item dengan rantai parent sangat dalam (indikasi siklus jika baris terakhir parent_id masih terisi) ==="
Q "WITH RECURSIVE anc AS (
  SELECT id AS start_id, id, parent_id, 1 AS depth, ARRAY[id] AS path
  FROM backlog_items WHERE parent_id IS NOT NULL
  UNION ALL
  SELECT a.start_id, bi.id, bi.parent_id, a.depth+1, a.path || bi.id
  FROM backlog_items bi
  JOIN anc a ON bi.id = a.parent_id
  WHERE a.depth < 50 AND bi.id <> ALL(a.path)
)
SELECT start_id, max(depth) AS kedalaman_maks
FROM anc GROUP BY start_id HAVING max(depth) >= 10 ORDER BY 2 DESC;"

echo; echo "Selesai."
echo "Kalau bagian A/B/D menunjukkan siklus, kirim hasilnya — perbaikan datanya adalah memutus satu parent_id"
echo "di tengah rantai (UPDATE backlog_items SET parent_id = NULL WHERE id = <id_yang_tepat>), BUKAN menebak sendiri."
