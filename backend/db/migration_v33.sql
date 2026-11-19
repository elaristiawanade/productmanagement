-- Migration v33: Management Dashboard (Home -> Management) + task pribadi di My Task
-- Run once on existing database (back it up first):
--   docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v33.sql
--
-- Dashboard per produk berisi Sprint Aktif, tabel Features, dan Open Item mingguan (minggu ini live, minggu lalu
-- dan sebelumnya dibekukan). Membekukan satu minggu butuh tahu status setiap item di akhir minggu itu. Sebelum
-- v33 hanya bug yang punya riwayat (bug_progress_updates, bugs.closed_at). Migrasi ini menambah:
--
--   backlog_items.completed_at  waktu terakhir item MASUK status `done`; dikosongkan lagi saat keluar dari done
--   backlog_status_events       satu baris per perubahan status backlog. Item baru juga dicatat (from_status NULL)
--   roadmap_status_events       sama, untuk product_roadmap (disiapkan untuk panel roadmap yang ditunda)
--   features.target_date        tanggal Target fitur (kolom "Target" di dashboard). target_release tetap teks versi
--   personal_tasks              task pribadi yang dibuat sendiri dari My Task. BUKAN item Backlog: tidak punya kode,
--                               tidak masuk sprint/points/progress produk. backlog_item_id hanya relasi (opsional)
--   personal_task_status_events riwayat status task pribadi, pola sama dengan backlog_status_events
--   weekly_snapshots            satu baris per (minggu, produk) yang sudah dibekukan. source: scheduled (job otomatis),
--                               manual (Super Admin), backfill (dibekukan > 24 jam terlambat, ditampilkan "estimasi").
--                               Pencatatan dimulai minggu backend pertama kali jalan (app_settings
--                               management.tracking_start, diisi backend); minggu sebelumnya tidak dibekukan
--   weekly_snapshot_items       isi Open Item minggu itu: salinan item (kode, judul, PIC, status, deadline, progress)
--                               saat dibekukan. Tidak ber-FK ke item asal, supaya tetap ada walau item dihapus
--   open_item_remarks           kolom "PO Remarks": ekspektasi selesai (tanggal + teks pendek) per item per minggu,
--                               diisi manual. Remark terakhir berlaku sampai diganti (ikut ke minggu berikutnya);
--                               baris dengan tanggal dan teks kosong = remark dihapus mulai minggu itu
--   weekly_notes                catatan mingguan Product Owner per (produk, minggu), di bawah tabel Open Item
--   permission                  management_dashboard.view, default untuk super_admin, manager, commissioner, po
--
-- PENCATATAN LEWAT TRIGGER, BUKAN DI CONTROLLER
--   Status backlog diubah dari banyak jalur (PUT, PATCH status, auto-status parent, import) dan status roadmap dari
--   RoadmapController maupun FeatureController. Trigger database menangkap semuanya tanpa mengubah controller.
--   Konsekuensinya, event tidak menyimpan siapa yang mengubah status.
--
-- BACKFILL (sekali jalan): riwayat sebelum v33 adalah PERKIRAAN
--   1. Event backlog dibaca dari log teks item_activities, tiga format:
--        Status diubah dari "x" menjadi "y"            (PATCH status)
--        Status diubah otomatis dari "x" menjadi "y"   (auto-status parent)
--        Status: "x" -> "y"                            (PUT, bagian dari log gabungan; panahnya karakter U+2192)
--   2. Item `done` tanpa log status dianggap selesai pada updated_at (todo -> done), supaya ikut terhitung
--      sebagai item selesai di minggu itu.
--   3. Kalau status terakhir di log tidak sama dengan status sekarang (diubah lewat jalur yang tidak mencatat log),
--      ditambah satu event penutup ke status sekarang pada updated_at, supaya riwayat selalu berakhir di status asli.
--   4. Event "dibuat" (from_status NULL) di created_at; status awal = from_status event tertua, atau status sekarang.
--   5. completed_at = event terakhir ke done. Trigger updated_at dimatikan sementara supaya updated_at tidak berubah.
--   6. Roadmap: satu event (NULL -> status sekarang) di updated_at.
--
-- Idempotent: item yang sudah punya event tidak di-backfill lagi, dan permission tidak menimpa role yang sudah
-- punya key management_dashboard (hasil centang/hapus centang admin tetap). Semua dalam satu transaksi: kalau ada
-- yang gagal, tidak ada yang berubah. Harus dijalankan SEBELUM backend baru naik.

BEGIN;

-- ── 1. Kolom dan tabel ────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE backlog_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS backlog_status_events (
  id               BIGSERIAL   PRIMARY KEY,
  backlog_item_id  INTEGER     NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
  from_status      VARCHAR(30),
  to_status        VARCHAR(30) NOT NULL,
  changed_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
  source           VARCHAR(10) NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'backfill'))
);
CREATE INDEX IF NOT EXISTS idx_backlog_status_events_item ON backlog_status_events (backlog_item_id, changed_at, id);
CREATE INDEX IF NOT EXISTS idx_backlog_status_events_time ON backlog_status_events (changed_at);

CREATE TABLE IF NOT EXISTS roadmap_status_events (
  id           BIGSERIAL   PRIMARY KEY,
  roadmap_id   INTEGER     NOT NULL REFERENCES product_roadmap(id) ON DELETE CASCADE,
  from_status  VARCHAR(30),
  to_status    VARCHAR(30) NOT NULL,
  changed_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  source       VARCHAR(10) NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'backfill'))
);
CREATE INDEX IF NOT EXISTS idx_roadmap_status_events_item ON roadmap_status_events (roadmap_id, changed_at, id);

ALTER TABLE features ADD COLUMN IF NOT EXISTS target_date DATE;

CREATE TABLE IF NOT EXISTS personal_tasks (
  id               SERIAL      PRIMARY KEY,
  owner_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id       INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  backlog_item_id  INTEGER     REFERENCES backlog_items(id) ON DELETE SET NULL,   -- relasi saja, bukan konversi
  title            TEXT        NOT NULL,
  notes            TEXT,
  status           VARCHAR(30) NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'blocked')),
  deadline         DATE,
  completed_at     TIMESTAMP,
  created_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_owner   ON personal_tasks (owner_id);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_product ON personal_tasks (product_id);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_backlog ON personal_tasks (backlog_item_id);

CREATE TABLE IF NOT EXISTS personal_task_status_events (
  id                BIGSERIAL   PRIMARY KEY,
  personal_task_id  INTEGER     NOT NULL REFERENCES personal_tasks(id) ON DELETE CASCADE,
  from_status       VARCHAR(30),
  to_status         VARCHAR(30) NOT NULL,
  changed_at        TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personal_task_events_task ON personal_task_status_events (personal_task_id, changed_at, id);

CREATE TABLE IF NOT EXISTS weekly_snapshots (
  id           BIGSERIAL   PRIMARY KEY,
  week_start   DATE        NOT NULL CHECK (EXTRACT(ISODOW FROM week_start) = 1),   -- selalu hari Senin
  product_id   INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source       VARCHAR(10) NOT NULL CHECK (source IN ('scheduled', 'manual', 'backfill')),
  captured_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE (week_start, product_id)
);

CREATE TABLE IF NOT EXISTS weekly_snapshot_items (
  id              BIGSERIAL   PRIMARY KEY,
  snapshot_id     BIGINT      NOT NULL REFERENCES weekly_snapshots(id) ON DELETE CASCADE,
  item_source     VARCHAR(10) NOT NULL CHECK (item_source IN ('backlog', 'bug', 'qa', 'mytask')),
  item_id         INTEGER     NOT NULL,          -- id di tabel asal (backlog_items, bugs, qa_test_cases, personal_tasks)
  parent_item_id  INTEGER,                       -- backlog: story induk dari sebuah task (untuk indentasi)
  item_type       VARCHAR(30),                   -- tipe backlog (story/task/...) atau tipe bug
  code            VARCHAR(50),
  title           TEXT        NOT NULL,
  pic             JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- [{id, name, color}], primary lebih dulu
  status          VARCHAR(50) NOT NULL,          -- status backlog/task pribadi, kode Stage bug, hasil run QA
  deadline        DATE,
  is_late         BOOLEAN     NOT NULL DEFAULT FALSE,         -- lewat deadline per akhir minggu itu
  progress        INTEGER,                       -- NULL = "–" (bug)
  done_in_week    BOOLEAN     NOT NULL DEFAULT FALSE,         -- selesai di minggu itu (bukan masih terbuka)
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (snapshot_id, item_source, item_id)
);
CREATE INDEX IF NOT EXISTS idx_weekly_snapshot_items_snapshot ON weekly_snapshot_items (snapshot_id, sort_order);

-- PO Remarks. Satu baris per (minggu, item) yang remark-nya diisi/diubah di minggu itu. Yang tampil untuk minggu W
-- adalah baris terbaru dengan week_start <= W, jadi remark ikut ke minggu berikutnya sampai diganti, dan minggu yang
-- sudah lewat tetap menunjukkan ekspektasi saat itu (hanya baris minggu berjalan yang bisa diubah).
CREATE TABLE IF NOT EXISTS open_item_remarks (
  id             BIGSERIAL   PRIMARY KEY,
  product_id     INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  week_start     DATE        NOT NULL CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  item_source    VARCHAR(10) NOT NULL CHECK (item_source IN ('backlog', 'bug', 'qa', 'mytask')),
  item_id        INTEGER     NOT NULL,          -- tanpa FK, sama seperti weekly_snapshot_items
  expected_date  DATE,                          -- ekspektasi selesai
  remark         TEXT,                          -- keterangan pendek (maks 300, dicek backend)
  updated_by     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE (week_start, item_source, item_id)
);
CREATE INDEX IF NOT EXISTS idx_open_item_remarks_product ON open_item_remarks (product_id, week_start);

-- Catatan mingguan Product Owner (di bawah tabel Open Item). Catatan minggu lalu masih boleh diubah.
CREATE TABLE IF NOT EXISTS weekly_notes (
  id           BIGSERIAL   PRIMARY KEY,
  product_id   INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  content      TEXT        NOT NULL,
  updated_by   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, week_start)
);

-- ── 2. Backfill backlog (hanya item yang belum punya event sama sekali) ──────────────────────────────────────

CREATE TEMP TABLE v33_items ON COMMIT DROP AS
SELECT bi.id, bi.status, bi.created_at, bi.updated_at
FROM backlog_items bi
WHERE NOT EXISTS (SELECT 1 FROM backlog_status_events e WHERE e.backlog_item_id = bi.id);

-- Transisi dari log teks. seq menjaga urutan asli kalau dua log punya waktu yang sama.
CREATE TEMP TABLE v33_trans ON COMMIT DROP AS
SELECT a.backlog_item_id AS item_id, x.m[1] AS from_status, x.m[2] AS to_status,
       a.created_at AS changed_at, a.id::bigint AS seq
FROM item_activities a
JOIN v33_items i ON i.id = a.backlog_item_id
CROSS JOIN LATERAL (SELECT COALESCE(
    regexp_match(a.content, '^Status diubah (?:otomatis )?dari "([^"]+)" menjadi "([^"]+)"'),
    regexp_match(a.content, 'Status: "([^"]+)" → "([^"]+)"')
  ) AS m) x
WHERE a.type = 'change_log' AND x.m IS NOT NULL AND x.m[1] <> x.m[2];

-- Langkah 2: item done tanpa log status dianggap selesai pada updated_at
INSERT INTO v33_trans (item_id, from_status, to_status, changed_at, seq)
SELECT i.id, 'todo', 'done', i.updated_at, 0
FROM v33_items i
WHERE i.status = 'done'
  AND NOT EXISTS (SELECT 1 FROM v33_trans t WHERE t.item_id = i.id);

-- Langkah 3: event penutup kalau log berakhir di status yang berbeda dengan status sekarang
INSERT INTO v33_trans (item_id, from_status, to_status, changed_at, seq)
SELECT i.id, last.to_status, i.status, GREATEST(i.updated_at, last.changed_at), 9223372036854775807
FROM v33_items i
JOIN LATERAL (
  SELECT t.to_status, t.changed_at FROM v33_trans t
  WHERE t.item_id = i.id ORDER BY t.changed_at DESC, t.seq DESC LIMIT 1
) last ON TRUE
WHERE last.to_status <> i.status;

-- Langkah 4: event "dibuat" lebih dulu, supaya id-nya lebih kecil dari transisi di waktu yang sama
INSERT INTO backlog_status_events (backlog_item_id, from_status, to_status, changed_at, source)
SELECT i.id, NULL,
       COALESCE((SELECT t.from_status FROM v33_trans t WHERE t.item_id = i.id
                 ORDER BY t.changed_at, t.seq LIMIT 1), i.status),
       i.created_at, 'backfill'
FROM v33_items i
ORDER BY i.id;

INSERT INTO backlog_status_events (backlog_item_id, from_status, to_status, changed_at, source)
SELECT t.item_id, t.from_status, t.to_status, GREATEST(t.changed_at, i.created_at), 'backfill'
FROM v33_trans t
JOIN v33_items i ON i.id = t.item_id
ORDER BY t.item_id, t.changed_at, t.seq;

-- Langkah 5: completed_at tanpa menyentuh updated_at
ALTER TABLE backlog_items DISABLE TRIGGER trg_backlog_updated;
UPDATE backlog_items bi
SET completed_at = COALESCE(
      (SELECT MAX(e.changed_at) FROM backlog_status_events e
       WHERE e.backlog_item_id = bi.id AND e.to_status = 'done'),
      bi.updated_at)
WHERE bi.status = 'done' AND bi.completed_at IS NULL;
ALTER TABLE backlog_items ENABLE TRIGGER trg_backlog_updated;

-- ── 3. Backfill roadmap ────────────────────────────────────────────────────────────────────────────────────

INSERT INTO roadmap_status_events (roadmap_id, from_status, to_status, changed_at, source)
SELECT r.id, NULL, r.status, r.updated_at, 'backfill'
FROM product_roadmap r
WHERE NOT EXISTS (SELECT 1 FROM roadmap_status_events e WHERE e.roadmap_id = r.id)
ORDER BY r.id;

-- ── 4. Trigger ─────────────────────────────────────────────────────────────────────────────────────────────
-- UPDATE OF status ikut terpicu walau nilainya sama (PUT selalu mengirim status), jadi selalu dicek IS DISTINCT FROM.

CREATE OR REPLACE FUNCTION backlog_set_completed_at() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.completed_at := CASE WHEN NEW.status = 'done' THEN COALESCE(NEW.completed_at, NOW()) END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.completed_at := CASE WHEN NEW.status = 'done' THEN NOW() END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_backlog_completed_at ON backlog_items;
CREATE TRIGGER trg_backlog_completed_at
  BEFORE INSERT OR UPDATE OF status ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION backlog_set_completed_at();

CREATE OR REPLACE FUNCTION backlog_log_status_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO backlog_status_events (backlog_item_id, from_status, to_status, changed_at)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.created_at, NOW()));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO backlog_status_events (backlog_item_id, from_status, to_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, NOW());
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_backlog_status_event ON backlog_items;
CREATE TRIGGER trg_backlog_status_event
  AFTER INSERT OR UPDATE OF status ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION backlog_log_status_event();

CREATE OR REPLACE FUNCTION roadmap_log_status_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO roadmap_status_events (roadmap_id, from_status, to_status, changed_at)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.created_at, NOW()));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO roadmap_status_events (roadmap_id, from_status, to_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, NOW());
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roadmap_status_event ON product_roadmap;
CREATE TRIGGER trg_roadmap_status_event
  AFTER INSERT OR UPDATE OF status ON product_roadmap
  FOR EACH ROW EXECUTE FUNCTION roadmap_log_status_event();

-- Task pribadi: updated_at, completed_at, dan riwayat status, sama seperti backlog
DROP TRIGGER IF EXISTS trg_personal_tasks_updated ON personal_tasks;
CREATE TRIGGER trg_personal_tasks_updated
  BEFORE UPDATE ON personal_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_personal_tasks_completed_at ON personal_tasks;
CREATE TRIGGER trg_personal_tasks_completed_at
  BEFORE INSERT OR UPDATE OF status ON personal_tasks
  FOR EACH ROW EXECUTE FUNCTION backlog_set_completed_at();   -- fungsinya generik: hanya membaca status/completed_at

CREATE OR REPLACE FUNCTION personal_task_log_status_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO personal_task_status_events (personal_task_id, from_status, to_status, changed_at)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.created_at, NOW()));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO personal_task_status_events (personal_task_id, from_status, to_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, NOW());
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_personal_task_status_event ON personal_tasks;
CREATE TRIGGER trg_personal_task_status_event
  AFTER INSERT OR UPDATE OF status ON personal_tasks
  FOR EACH ROW EXECUTE FUNCTION personal_task_log_status_event();

-- ── 5. Permission (pola v28: digabung dengan ||, tidak menimpa pilihan admin) ────────────────────────────────

UPDATE roles SET permissions = COALESCE(permissions, '{}'::jsonb)
  || '{"management_dashboard": {"view": true}}'::jsonb
  WHERE name IN ('super_admin', 'manager', 'commissioner', 'po')
    AND NOT (COALESCE(permissions, '{}'::jsonb) ? 'management_dashboard');

COMMIT;

SELECT 'Migration v33 selesai.' AS status,
       (SELECT COUNT(*) FROM backlog_status_events) AS backlog_events,
       (SELECT COUNT(*) FROM roadmap_status_events) AS roadmap_events,
       (SELECT COUNT(*) FROM backlog_items WHERE completed_at IS NOT NULL) AS items_with_completed_at,
       (SELECT COUNT(*) FROM personal_tasks) AS personal_tasks,
       (SELECT COUNT(*) FROM open_item_remarks) AS po_remarks,
       (SELECT COUNT(*) FROM weekly_notes) AS weekly_notes;
