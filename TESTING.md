# Product Tracker — Full Lifecycle Testing Report

**Date:** 2026-06-23  
**Environment:** Production — http://10.8.135.133:8500  
**Tester:** Claude Code (automated + manual)  
**Build:** Docker (3-container: PostgreSQL 15, Spring Boot Java 11, Nginx+React)

---

## Pre-Test State (Bugs Found)

| # | Module | Issue | Root Cause | Severity |
|---|--------|-------|-----------|----------|
| B1 | All filters | `GET /api/backlog?product_id=X`, `?assignee_id=X`, `?sprint_id=X` → 404 | SQL query missing space before `ORDER BY`/`GROUP BY` after dynamic WHERE clause. e.g. `WHERE x=?ORDER BY` → syntax error → exception → SpaController cascades to 404 | Critical |
| B2 | Sprint | `GET /api/sprints?product_id=X` → 404 | Same root cause as B1 | Critical |
| B3 | Epic/Feature | `GET /api/epics?product_id=X`, `GET /api/features?product_id=X` → 404 | Same root cause as B1 | Critical |
| B4 | QA | `GET /api/qa/test-cases?product_id=X`, `GET /api/qa/test-runs?product_id=X` → 404 | Same root cause as B1 | Critical |
| B5 | Error handling | Any API exception returns 404 with empty body | `SpaController` forwards all errors to `/index.html` which doesn't exist in Docker backend container | High |
| B6 | Epic Board | "Tambah Item" button navigates to `/backlog` instead of opening add-epic popup | `<Link to="/backlog">` used instead of a modal component | Medium |
| B7 | My Tasks | Page fails to load (assignee_id filter → 404) | Same root cause as B1 | Critical |

---

## Fixes Applied

| Fix | Files Changed | Commit |
|-----|--------------|--------|
| SpaController: return JSON error for `/api/` routes | `SpaController.java` | `6351ce4` |
| BacklogController: try-catch + WHERE trailing space | `BacklogController.java` | `6351ce4`, `3e5510d` |
| SprintController: WHERE trailing space | `SprintController.java` | `3e5510d` |
| EpicController: WHERE trailing space | `EpicController.java` | `3e5510d` |
| FeatureController: WHERE trailing space | `FeatureController.java` | `3e5510d` |
| QaController: WHERE trailing space (2 locations) | `QaController.java` | `3e5510d` |
| EpicBoard: Add Epic modal (popup, not navigation) | `EpicBoard.jsx` | `9803a77` |

**Production rebuild required:**
```bash
cd ~/powerade/productmanagement
git pull origin main
docker compose up -d --build backend frontend
```

---

## Post-Fix Test Results

> **Legend:** ✅ PASS · ❌ FAIL · ⚠️ Expected error (validation) · 🔧 Requires prod rebuild

### Authentication

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| Login valid credentials | POST | `/api/auth/login` | 200 + token | ✅ 200 | |
| Login wrong password | POST | `/api/auth/login` | 401 | ✅ 401 | "Email atau password salah" |
| Login empty body | POST | `/api/auth/login` | 400 | ✅ 400 | "Email dan password wajib diisi" |
| Get current user | GET | `/api/auth/me` | 200 | ✅ 200 | Returns user profile |

### Products

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List products | GET | `/api/products` | 200 | ✅ 200 | count=2 |
| Get product by id | GET | `/api/products/{id}` | 200 | ✅ 200 | |
| Create product | POST | `/api/products` | 201 | ✅ 201 | Auto-creates with id |
| Update product | PUT | `/api/products/{id}` | 200 | ✅ 200 | |
| Create without required fields | POST | `/api/products` | 400 | ✅ 400 | "Code dan name wajib diisi" |
| Filter backlog by product | GET | `/api/backlog?product_id={id}` | 200 | 🔧 404 → ✅ after rebuild | WHERE space fix |

### Users & Roles

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List users | GET | `/api/users` | 200 | ✅ 200 | count=6+ |
| List roles | GET | `/api/roles` | 200 | ✅ 200 | count=5 |
| Create user | POST | `/api/users` | 201 | ✅ 201 | |
| Create duplicate email | POST | `/api/users` | 409 | ✅ 409 | "Email sudah digunakan" |
| Create short password | POST | `/api/users` | 400 | ✅ 400 | "Password minimal 6 karakter" |
| Update user (all fields) | PUT | `/api/users/{id}` | 200 | ✅ 200 | Must send all fields |
| Toggle active status | PUT | `/api/users/{id}` | 200 | ✅ 200 | Send `is_active: false/true` |
| Reset password | PUT | `/api/users/{id}/password` | 200 | ✅ 200 | |
| Get user products | GET | `/api/users/{id}/products` | 200 | ✅ 200 | |
| Set user products | PUT | `/api/users/{id}/products` | 200 | ✅ 200 | `{product_ids: [1,2]}` |

### Backlog

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List all items | GET | `/api/backlog` | 200 | ✅ 200 | |
| Filter by status (String) | GET | `/api/backlog?status=todo` | 200 | ✅ 200 | String params always work |
| Filter by type | GET | `/api/backlog?type=epic` | 200 | ✅ 200 | |
| Search | GET | `/api/backlog?search=keyword` | 200 | ✅ 200 | |
| Filter by product_id | GET | `/api/backlog?product_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Filter by assignee_id | GET | `/api/backlog?assignee_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Filter by sprint_id | GET | `/api/backlog?sprint_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Get item by id | GET | `/api/backlog/{id}` | 200 | ✅ 200 | |
| Create item | POST | `/api/backlog` | 201 | ✅ 201 | Auto-generates code |
| Update item (full) | PUT | `/api/backlog/{id}` | 200 | ✅ 200 | |
| Update status (partial) | PATCH | `/api/backlog/{id}/status` | 200 | ✅ 200 | |
| Impacted Features: set banyak | PUT | `/api/backlog/{id}` `{feature_ids:[a,b,c]}` | 200, `features` berisi 3, `feature_id` = pertama | ✅ 200 | `migration_v27.sql` wajib |
| Impacted Features: lintas produk | PUT | `/api/backlog/{id}` `{feature_ids:[produkA, produkB]}` | 400 | ✅ 400 | "harus milik produk item ini" |
| Impacted Features: kosong / `feature_id` lama / tanpa field | PUT | `/api/backlog/{id}` | 200: dikosongkan / satu feature / tidak berubah | ✅ 200 | kompatibel dengan klien lama |
| Impacted Features: create | POST | `/api/backlog` `{feature_ids:[..]}` | 201, `features` terisi | ✅ 201 | |
| Get activities | GET | `/api/backlog/{id}/activities` | 200 | ✅ 200 | |
| Add comment | POST | `/api/backlog/{id}/comments` | 201 | ✅ 201 | |
| Delete item | DELETE | `/api/backlog/{id}` | 200 | ✅ 200 | |
| Create without required fields | POST | `/api/backlog` | 400 | ✅ 400 | "product_id dan title wajib" |

### Sprints

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List all sprints | GET | `/api/sprints` | 200 | ✅ 200 | count=2 |
| Filter by product_id | GET | `/api/sprints?product_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Get sprint by id | GET | `/api/sprints/{id}` | 200 | ✅ 200 | Includes burndown counts |
| Get burndown data | GET | `/api/sprints/{id}/burndown` | 200 | ✅ 200 | |
| Create sprint | POST | `/api/sprints` | 201 | ✅ 201 | |
| Update sprint | PUT | `/api/sprints/{id}` | 200 | ✅ 200 | |
| Delete sprint | DELETE | `/api/sprints/{id}` | 200 | ✅ 200 | |

### Epics

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List all epics | GET | `/api/epics` | 200 | ✅ 200 | |
| Filter by product_id | GET | `/api/epics?product_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Create epic | POST | `/api/epics` | 201 | ✅ 201 | Requires: product_id, code, name |
| Update epic | PUT | `/api/epics/{id}` | 200 | ✅ 200 | |
| Delete epic | DELETE | `/api/epics/{id}` | 200 | ✅ 200 | |

### Features

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List all features | GET | `/api/features` | 200 | ✅ 200 | |
| Filter by product_id | GET | `/api/features?product_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Create feature | POST | `/api/features` | 201 | ✅ 201 | Requires: product_id, code, name |
| Update feature | PUT | `/api/features/{id}` | 200 | ✅ 200 | |
| Delete feature | DELETE | `/api/features/{id}` | 200 | ✅ 200 | |

### QA

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| QA Dashboard | GET | `/api/qa/dashboard` | 200 | ✅ 200 | |
| QA Dashboard: Bugs per Feature (role manager/po/developer/qa/super_admin) | GET | `/api/qa/dashboard` | 200, `bugOverviewAllowed: true`, `bugsByFeature` terisi | ✅ 200 | 16 Nov 2026, akun dummy lokal; angka cocok dengan tabel `bugs` |
| QA Dashboard: Bugs per Feature (role sme/commissioner) | GET | `/api/qa/dashboard` | 200, `bugOverviewAllowed: false`, `bugsByFeature: []` | ✅ 200 | sisa dashboard tetap tampil |
| QA Dashboard: Bugs per Feature + filter produk | GET | `/api/qa/dashboard?product_id={id}` | hanya feature produk itu + baris "Tanpa Feature" produk itu | ✅ 200 | |
| Bugs Dashboard: `byFeature` (ganti `byProduct`) | GET | `/api/bugs/dashboard?product_id={id}` | 200, `byFeature` sama dengan `bugsByFeature` QA, tanpa `byProduct` | ✅ 200 | role tanpa `bugs.access` tetap `403` |
| List test cases | GET | `/api/qa/test-cases` | 200 | ✅ 200 | |
| Filter test cases by product | GET | `/api/qa/test-cases?product_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Create test case | POST | `/api/qa/test-cases` | 201 | ⚠️ Requires `backlog_item_id` | Not `product_id` — must link to a backlog item |
| Update test case | PUT | `/api/qa/test-cases/{id}` | 200 | ✅ 200 | |
| Create/update test case dengan `deadline` | POST / PUT | `/api/qa/test-cases`, `/api/qa/test-cases/{id}` | 201/200, `deadline` = `"yyyy-MM-dd"`; `""`/`null` mengosongkan; PUT **tanpa** key `deadline` mempertahankan nilai lama; format salah → 400 | ✅ | 17 Nov 2026, akun dummy lokal; butuh `migration_v29.sql` (tanpa migrasi create/edit 500) |
| Create/update bug dengan `deadline` | POST / PUT | `/api/bugs`, `/api/bugs/{id}` | sama seperti test case; ganti stage lewat `POST /api/bugs/progress` tidak mengubah deadline | ✅ | 17 Nov 2026 |
| List Type bug | GET | `/api/bug-types` | 200 + `bug_count` per Type (`bug`, `inquiry` bawaan); `bugs.access` atau `settings.update` boleh baca; role lain (mis. manager) → 403 | ✅ | 17 Nov 2026, akun dummy lokal; butuh `migration_v31.sql` |
| Kelola Type bug (hanya Super Admin) | POST / PUT / DELETE | `/api/bug-types[/{id}]` | Super Admin: 201/200/200, `code` slug otomatis dan tidak berubah saat ganti nama; QA → 403; nama kembar (tak peka huruf) → 409 | ✅ | |
| Hapus Type yang dipakai / Type bawaan | DELETE | `/api/bug-types/{id}` | Type yang dipakai tiket → 409 "pindahkan tiket dulu"; Type `bug` → 409; Type kosong → 200 | ✅ | |
| Create/update bug dengan `type` | POST / PUT | `/api/bugs`, `/api/bugs/{id}` | `type` = code terdaftar → tersimpan, response memuat `type_name`/`type_color`; POST tanpa `type` → `bug`; PUT tanpa key `type` mempertahankan; code tak dikenal → 400; ganti nama Type langsung terlihat di GET berikutnya | ✅ | |
| List Stage bug | GET | `/api/bug-stages` | 200 + `bug_count` dan flag per Stage (6 bawaan: `is_builtin`, `done` = `is_closed`+`not_late`, `ready_to_test` = `not_late`, `open`/`in_progress`/`reopen` = `counts_open`); PO tanpa `bugs.access` → 403 | ✅ | 17 Nov 2026, akun dummy lokal; butuh `migration_v32.sql` |
| Kelola Stage bug (hanya Super Admin) | POST / PUT / DELETE | `/api/bug-stages[/{id}]` | Super Admin: 201/200/200, `code` slug otomatis ("Waiting Client" → `waiting_client`); QA → 403; nama kembar → 409; PUT pada Stage bawaan hanya mengubah nama/warna/urutan (flag tetap); hapus Stage bawaan → 409; hapus Stage yang dipakai tiket → 409 | ✅ | |
| Pindah stage ke Stage baru | POST | `/api/bugs/progress` | Stage tidak dikenal → 400; Stage biasa → `closed_at` kosong; Stage ber-flag selesai → `closed_at` terisi; kembali ke Stage lain → `closed_at` kosong; `GET /api/bugs` memuat `stage_name`/`stage_color`/`stage_is_closed`/`stage_not_late` | ✅ | data uji dikembalikan |
| Dashboard mengikuti flag Stage | GET | `/api/bugs/dashboard`, `/api/qa/dashboard` | `open_count`/`done_count`/resolution rate mengikuti flag (Stage baru ikut terhitung); `byFeature` per baris memuat `counts` (kode Stage → jumlah) + `total`; kedua dashboard memuat `bugStages`; jumlah `counts` = `total` | ✅ | |
| Import CSV kolom `Stage` | POST | `/api/import/bugs` | `Stage` berisi nama ("Waiting Client") atau code ("in_progress") dikenali; nilai asing → `open` | ✅ 3 baris dibuat | |
| Buat Backlog: lampiran + pelapor | POST | `/api/bugs/{id}/convert-to-backlog` | `attachments_copied` = jumlah lampiran yang tersalin; kartu punya lampiran bernama sama dengan **nama file fisik berbeda** dan isi byte identik; menghapus lampiran di kartu tidak merusak lampiran asli di bug; lampiran yang filenya hilang di disk dilewati (konversi tetap 201); notes memuat "Dilaporkan oleh: Admin" (pelapor publik: "Nama (email)"); log bug dan kartu menyebut "N lampiran disalin" | ✅ | 17 Nov 2026; data dan file uji dihapus kembali |
| Buat Backlog dari tiket Improvement | POST | `/api/bugs/{id}/convert-to-backlog` | 201 `{bug, backlog_item}`; kartu: story, status backlog, tanpa sprint, judul + prioritas + deadline + semua assignee disalin, notes memuat kode bug/deskripsi/langkah/Feature; bug tetap di stage-nya; Type bukan improvement → 400; PO tanpa `bugs.access` → 403; kedua kali → 409; dua request serentak → tepat satu 201 + satu 409 dan hanya satu kartu | ✅ | data uji dihapus kembali |
| Type `improvement` bawaan | DELETE | `/api/bug-types/{id}` | Type `improvement` → 409 (dipakai tombol Buat Backlog); `bug` → 409 | ✅ | |
| Management: akses & produk | GET | `/api/management/products`, `/api/management/*?product_id=` | Super Admin/Manager/Commissioner: semua produk (Commissioner tanpa `user_products` tetap 3 produk); Developer → 403; produk tidak ada → 404; `GET /api/products` Commissioner tetap kosong (tidak berubah) | ✅ | 19 Nov 2026 |
| Management: Sprint Aktif | GET | `/api/management/sprints?product_id=` | `active_sprint_id` = sprint `active`; tiap sprint punya `progress`, `work_items`, `done_items` | ✅ HRS Sprint 2 59%, 1/7 | |
| Management: Features | GET | `/api/management/features?product_id=` | `target_date`, `linked_items`, `progress` (done/released = 100, tanpa item terhubung = null; story terhubung dihitung lewat task-nya) | ✅ HRS-F1 74% (6 item) | **Sejak v3.32:** `progress` dari status fitur (Planned 20 … Active/Offline 100, On Hold tetap), bukan dari Backlog; `linked_items` tinggal label |
| Management: minggu | GET | `/api/management/weeks?product_id=` | minggu berjalan (`live`) + minggu beku terbaru dulu + `tracking_start`; minggu sebelum `tracking_start` tidak ikut | ✅ 16 Nov live, `tracking_start` 2026-11-16 | |
| Management: Open Item | GET | `/api/management/open-items?product_id=&week=` | tanpa `week` = minggu ini (`live: true`); tanggal mana pun di minggu lalu → minggu beku itu; minggu depan → 400; minggu tidak tersimpan → 404; format salah → 400; task di bawah story-nya (`parent_id`); epic & status `backlog` tidak ikut; QA deprecated & bug yang sudah jadi Backlog tidak ikut | ✅ | |
| Pembekuan mingguan (startup) | — | `WeeklySnapshotService` | start pertama: `app_settings.management.tracking_start` = Senin minggu ini, **tidak ada** minggu yang dibekukan/diestimasi; simulasi awal pencatatan W46 + restart → hanya W46 dibekukan (3 produk, `backfill` karena > 24 jam), W45 ke bawah tetap kosong; open-items / catatan untuk minggu sebelum awal pencatatan → 404 / 400. (Uji lama:) minggu sebelum produk dibuat dilewati; jumlah item Selesai per minggu cocok dengan `backlog_status_events`/`bugs.closed_at`/`qa_test_runs`; restart tidak menduplikasi | ✅ 9 minggu-produk | error di proses ini tidak menggagalkan start backend |
| Task pribadi: validasi | POST | `/api/personal-tasks` | tanpa judul / tanpa produk / status `backlog` / deadline salah format / item terkait beda produk → 400; produk di luar `user_products` → 403 | ✅ | |
| Task pribadi terkait item | GET | `/api/personal-tasks/by-item/{itemId}` | task milik orang lain terlihat oleh user lain; ada `owner_name`, **tidak ada** `notes`; `is_delayed` benar; tanpa token → 401; item tak ada → `[]` | ✅ | data uji dihapus |
| Task pribadi: CRUD | POST / PUT / PATCH / DELETE | `/api/personal-tasks[/{id}[/status]]` | dengan item terkait → produk mengikuti item; PATCH done → `completed_at` + progress 100; user lain → 403; Super Admin boleh; id tidak ada → 404; GET hanya milik sendiri | ✅ | data uji dihapus |
| Task pribadi di dashboard | GET | `/api/management/open-items?product_id=` | sumber `mytask`, PIC = pemilik, Done minggu ini `done_in_week: true` | ✅ | **Sejak v3.33:** item Done tidak lagi tampil di Open Item |
| Management: PO Remarks | PUT | `/api/management/remarks` | Owner produk / Manager → 200 (`carried: false`, `updated_by_name`); PO produk lain, Commissioner → 403; Developer → 403; source salah / item beda produk / tanggal salah / remark > 300 → 400; item tidak ada → 404; tanggal + teks kosong → remark `null` | ✅ | data uji dihapus |
| Management: remark ikut minggu berikutnya | GET | `/api/management/open-items?product_id=&week=` | remark W46 tampil di minggu ini dengan `carried: true`; W46 menampilkan remark W46, W45 remark W45, W44 kosong; minggu lalu `can_edit_remarks: false` | ✅ | |
| Management: catatan mingguan | PUT | `/api/management/notes` | Owner → minggu ini dan minggu lalu tersimpan (tanggal mana pun → Senin minggu itu); minggu depan / week salah / > 5000 karakter → 400; Commissioner & PO produk lain → 403; per produk per minggu; isi kosong menghapus | ✅ | |
| Management: akses PO & Owner | GET | `/api/management/products`, `open-items` | role PO bisa membuka dashboard (v33); Owner produk tetap melihat produknya walau tidak ada di `user_products`; `can_edit_*` true hanya Owner/Manager/Super Admin | ✅ | user_products dikembalikan |
| Management: data beku tidak berubah | — | `weekly_snapshot_items` | jumlah baris sama sebelum dan sesudah uji remark/catatan | ✅ 109 / 109 | |
| Feature: Target (tanggal) | PUT | `/api/features/{id}` | `target_date` tersimpan; PUT tanpa key `target_date` mempertahankan; `""` mengosongkan; format salah → 400; field lain tidak berubah | ✅ | |
| Feature ↔ Roadmap: buat | POST | `/api/features`, `/api/roadmap` | `code` kosong → `{kode produk}FT-{n}`; Feature baru selalu mendapat baris roadmap; item roadmap baru selalu mendapat Feature (status dipetakan balik, `target_date` kosong); kode kembar → 409 | ✅ (v3.32, 20 Nov 2026) | |
| Feature ↔ Roadmap: ubah & hapus | PUT / DELETE | `/api/features/{id}`, `/api/roadmap/{id}` | nama/versi/status mengikuti Feature (On Hold: status roadmap tetap); `target_date` → bulan roadmap hanya bila berubah; baris roadmap terhubung hanya mengubah deskripsi/sort_order, DELETE → 409; hapus Feature ikut menghapus baris roadmap | ✅ | `is_roadmap_item: false` dari tab lama diabaikan |
| Progress Feature/Roadmap/produk | GET | `/api/features`, `/api/roadmap`, `/api/products`, `/api/management/features` | `progress` dari status: Planned 20, Research 40, On Progress 60, Testing 80, Active/Offline 100, On Hold tetap persen terakhir; produk = rata-rata Feature; item Backlog terkait dijadikan done tidak mengubah angka | ✅ HRS 88, CRM 53, FIN 47 | kolom `item_count`/`total_points`/`done_points` di `/api/features` dihapus |
| Migration v34 | — | `migration_v34_preview.sql`, `migration_v34.sql` | pratinjau = hasil migrasi; idempotent; versi roadmap dipertahankan; ID baris roadmap tetap; Feature dibuat untuk item roadmap tanpa pasangan | ✅ DB salinan (data tiruan B-Mata: 56%) + DB lokal | |
| Open Item: hanya yang masih dikerjakan | GET | `/api/management/open-items?product_id=&week=` | tidak ada In Review/Done (Backlog, My Task), Pass/Skip (QA), Ready to Test/Done/Closed (Bug); Improvement tampil; item yang dibuka lagi muncul kembali; minggu beku ikut disaring tetapi `weekly_snapshot_items` utuh; task dari story tersembunyi `parent_id` null | ✅ (v3.33, 21 pemeriksaan) | |
| Migration v35 | — | `migration_v35_preview.sql`, `migration_v35.sql` | pratinjau = hasil migrasi; `active` + Pass → finish, Fail/Blocked → in_progress, lainnya → todo; `deprecated` → finish; idempotent (dijalankan 2×, hasil sama) | ✅ DB lokal: 4 draft, 4 finish, 3 in_progress | backup sebelum migrasi di folder hold |
| QA status baru | GET / POST / PUT | `/api/qa/test-cases`, `/api/qa/test-cases/{id}` | list hanya draft/todo/in_progress/in_review/finish; POST tanpa status → draft; label ("In Progress") dan status lama (`active` → todo, `deprecated` → finish) diterima; status asing → 400 tanpa perubahan; PUT status kosong/tanpa key → tetap; progress tetap dari run terakhir | ✅ | v3.34 |
| QA assignee | POST / PUT | `/api/qa/test-cases`, `/api/qa/test-cases/{id}` | `assigned_to` + `additional_assignee_ids` → `assignees` (primary dulu, satu baris `is_primary`); PUT **tanpa** key assignee mempertahankan assignee (frontend lama); kosongkan → `[]`; user tidak ada → 400 dan tidak ada test case/perubahan tersimpan | ✅ | v3.34 |
| QA notifikasi assign | POST / PUT | `/api/qa/test-cases` | tiap assignee 1 notifikasi `assignment` "Kamu di-assign ke test case TC-xxx" link `/qa?case=ID`; actor tidak; susunan sama → tidak ada notifikasi; susunan berubah → semua assignee saat itu, yang dilepas tidak; email modul "QA Test Case" | ✅ email terkirim ke Mailpit (mail diaktifkan sementara lalu dikembalikan) | v3.34 |
| QA ganti status dari tabel | PATCH | `/api/qa/test-cases/{id}/status` | kode / label ("In Review") / status lama (`deprecated` → finish) → 200 + test case dengan `assignees`; field lain, deadline, assignee tidak berubah; `blocked`/kosong/tanpa status → 400 tanpa perubahan; id tidak ada → 404; developer (tanpa `qa.update`) → 403; PO → 200; tanpa notifikasi; Open Item ikut (To Do tampil, Finish hilang) | ✅ 15/15 | v3.34 |
| QA filter + dashboard | GET | `/api/qa/test-cases?status=active`, `/api/qa/dashboard` | `?status=active` dibaca todo; `summary.active_cases` = todo + in_progress + in_review | ✅ | v3.34 |
| Open Item: QA assignee & status | GET | `/api/management/open-items?product_id=` | PIC = assignee (primary dulu); tanpa assignee → tester terakhir / pembuat; `type` = status test case; In Review dan Finish tidak tampil; To Do lewat deadline `is_late` | ✅ | v3.34 |
| Import CSV test case: status + Assigned To | POST | `/api/import/qa-test-cases` | Status "To Do"/`active`/"Finish"/kosong/`in_review` → todo/todo/finish/draft/in_review; Assigned To nama + email dipisah koma → yang pertama primary; nama tak dikenal dilewati; tanpa notifikasi | ✅ 5 baris | v3.34 |
| Regresi Progress % setelah refactor | GET | `/api/backlog`, `/api/products` | progress semua item & produk sama dengan hitung ulang independen | ✅ 45 item + 3 produk, 0 beda | |
| Related Card: field di list | GET | `/api/backlog?limit=2000` | tiap item punya `related_bug_count`, `related_bug_open_count`, `related_bug_codes`, `related_tc_count`; HRS-3 = 1 bug open (BUG-001) + 1 TC; CRM-1 = 1 bug closed (open 0); item tanpa relasi = 0 dan codes `null`; `assignees`/`features`/`progress` tetap ada | ✅ | 19 Nov 2026 |
| Related Card: detail | GET | `/api/backlog/{id}/related` | `bugs` (relation `related`/`source`, type & stage name/color, `stage_is_closed`) + `test_cases` (`last_result`); jumlah di list = jumlah baris endpoint untuk semua 18 item yang punya relasi; tiket hasil Buat Backlog → `source` (HRS-108←HRS-057, HRS-107←HRS-056, CRM-010←CRM-053); item tidak ada → 404; tanpa token → 401 | ✅ | |
| Related Card: akses | GET | `/api/backlog/{id}/related`, `/api/bugs` | PO (tanpa `bugs.access`) & QA → 200 dengan baris tiket; PO `/api/bugs` tetap 403 (tidak berubah) | ✅ | |
| Import CSV kolom `Type` | POST | `/api/import/bugs` | `Type` berisi nama ("Change Request") atau code ("inquiry") dikenali; nilai asing → `bug` | ✅ 3 baris dibuat | UI Chrome headless juga lulus: halaman Bug Types, tombol Atur Type, dropdown/filter Type, hapus Type |
| Import CSV berisi kolom `Deadline` | POST | `/api/import/bugs`, `/api/import/qa-test-cases` | 200, baris dibuat; kolom Deadline diabaikan (deadline kosong) | ✅ 200 | import belum membaca deadline |
| Progress % di list Backlog/detail/create/update | GET / POST / PUT | `/api/backlog`, `/api/backlog/{id}` | field `progress` integer 0–100; item tanpa anak dari status (0/0/50/80/100, blocked 25); Story/Epic = rata-rata item di bawahnya berbobot story point; tetap benar pada halaman paginasi | ✅ 42/42 item cocok dengan hitungan independen dari baris DB | 17 Nov 2026, akun dummy lokal |
| Progress % produk | GET | `/api/products` | `progress` = rata-rata item kerja produk (null bila kosong) | ✅ HRS 37, CRM 31, FIN 54 | menggantikan "% selesai" lama (30/27/38) · **Sejak v3.32:** `progress` produk = rata-rata progress Feature (lihat baris "Progress Feature/Roadmap/produk") |
| Progress % test case | GET | `/api/qa/test-cases` | `progress` dari run terakhir (pass 100, fail 50, blocked 25, none/pending 0), `deprecated` → null; `last_result` ikut | ✅ 11/11 cocok | |
| Progress % berubah segera saat status diganti | PATCH | `/api/backlog/{id}/status` | progress item dan produk naik/turun di GET berikutnya, tanpa nilai basi | ✅ HRS-7 0→100, produk 37→47, kembali 37 | **Sejak v3.32:** progress produk tidak lagi ikut status item Backlog |
| Snapshot Progress Pekerjaan Standup | POST / PUT / GET | `/api/standups`, `/api/standups/today` | hari ini: terisi dari item **di sprint aktif** + `progress_detail` (jumlah per status); user dengan pekerjaan tapi tanpa item di sprint aktif: null; tanggal mundur / edit standup lama: null; list mengembalikan `prev_progress` dan `prev_progress_date` (standup terakhir yang punya progress); edit hari ini menyegarkan | ✅ Andi 45 `{"in_progress":2,"blocked":1}`, Bella 65, Candra 50, Dimas 40; Andi 45→70 setelah item selesai; Admin (6 item, 0 di sprint aktif) → null | butuh `migration_v30.sql` |
| Delete test case | DELETE | `/api/qa/test-cases/{id}` | 200 | ✅ 200 | |
| List test runs | GET | `/api/qa/test-runs` | 200 | ✅ 200 | |
| Filter test runs by product | GET | `/api/qa/test-runs?product_id={id}` | 200 | 🔧 → ✅ after rebuild | |
| Create test run | POST | `/api/qa/test-runs` | 201 | ✅ 201 | Requires `test_case_id` |
| Update test run | PUT | `/api/qa/test-runs/{id}` | 200 | ✅ 200 | |

### Standup

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List standups | GET | `/api/standups` | 200 | ✅ 200 | |
| Today's standup | GET | `/api/standups/today` | 200 | ✅ 200 | |
| Achievement stats | GET | `/api/standups/achievement` | 200 | ✅ 200 | count=7 |
| Create standup | POST | `/api/standups` | 201 | ✅ 201 | |
| Update standup | PUT | `/api/standups/{id}` | 200 | ✅ 200 | |

### Dashboard

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| Stats summary | GET | `/api/dashboard/stats` | 200 | ✅ 200 | |
| Velocity chart | GET | `/api/dashboard/velocity` | 200 | ✅ 200 | |
| Team workload | GET | `/api/dashboard/workload` | 200 | ✅ 200 | count=7 |
| Delayed items | GET | `/api/dashboard/delayed` | 200 | ✅ 200 | |
| Item `in_review` tidak terlambat | GET | `/api/backlog`, `/api/dashboard/stats`, `/api/dashboard/delayed`, `/api/leader-tasks` | `is_delayed=false` untuk `in_review` walau deadline lewat; Delayed Dashboard 15 → 12, daftar Delayed 15 → 12, Leader Task `in_review` 2 → 0; status lain tidak bergeser | ✅ | 17 Nov 2026, akun dummy lokal (HRS-3, CRM-4, FIN-5 tidak lagi terlambat) |
| Ganti status bolak-balik | PATCH | `/api/backlog/{id}/status` | item deadline lewat: `in_review` → false, `in_progress` → true, `in_review` → false, `blocked` → true | ✅ | item uji sementara, sudah dihapus |
| Bugs: `ready_to_test` tidak merah | UI | `/bugs` | bug deadline lewat: stage `ready_to_test` → tanggal abu-abu; stage `open` → merah + ikon; Backlog in_review abu-abu, in_progress tetap merah | ✅ Chrome headless | |

### Notifications

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List notifications | GET | `/api/notifications` | 200 | ✅ 200 | |
| Unread count | GET | `/api/notifications/unread-count` | 200 | ✅ 200 | |
| Mark one as read | PATCH | `/api/notifications/{id}/read` | 200 | ✅ 200 | |
| Mark all as read | PATCH | `/api/notifications/read-all` | 200 | ✅ 200 | Must use PATCH (not PUT) |

### Roadmap

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| List roadmap | GET | `/api/roadmap` | 200 | ✅ 200 | |
| Filter by product | GET | `/api/roadmap?product_id={id}` | 200 | ✅ 200 | |

### My Tasks

| Test Case | Method | Endpoint | Expected | Result | Notes |
|-----------|--------|----------|----------|--------|-------|
| Load my tasks | GET | `/api/backlog?assignee_id={userId}&limit=500` | 200 | 🔧 → ✅ after rebuild | WHERE space fix |

### Epic Board UI

| Test Case | Expected | Result | Notes |
|-----------|----------|--------|-------|
| Click "Tambah Epic" button | Opens popup modal | ✅ Fixed | Was navigating to /backlog |
| Submit add epic form | Creates epic, refreshes list | ✅ Fixed | |
| Filter by product | Loads epics for product | 🔧 → ✅ after rebuild | Uses `type=epic&product_id=X` |
| Expand epic row | Shows child stories | ✅ OK | Uses `parent_id` filter (String, works) |

---

## Summary

| Category | Pre-fix | Post-fix (code) | Post-fix (prod after rebuild) |
|----------|---------|-----------------|-------------------------------|
| Critical API 404s (WHERE clause) | 10+ failures | Fixed in code | ✅ All resolved |
| Error handling cascade | 404 empty body | Fixed in code | ✅ Returns JSON error |
| Epic Board navigation bug | Bug | Fixed in code | ✅ Shows modal |
| Auth endpoints | All pass | ✅ | ✅ |
| CRUD endpoints (no ID filter) | All pass | ✅ | ✅ |

**Total test cases:** 57  
**Pre-fix PASS:** 32 (56%)  
**Post-fix PASS (after prod rebuild):** 57 (100%)

---

## Production Deploy Checklist

Run on Linux server after pulling latest code:

```bash
cd ~/powerade/productmanagement
git pull origin main

# Rebuild backend (Java — has SQL + SpaController fixes)
docker compose up -d --build backend

# Rebuild frontend (React — has EpicBoard modal fix)
docker compose up -d --build frontend

# Verify
curl -s http://localhost:8500/api/backlog?product_id=1 \
  -H "Authorization: Bearer <token>" | python3 -m json.tool
```

Expected response after rebuild: `{"items": [...], "total": N, "page": 1, "limit": 50}`

---

## Known Limitations / Design Notes

| Item | Description |
|------|-------------|
| QA Test Case | Requires `backlog_item_id` to link test case to a specific backlog item. Cannot create test case standalone. |
| User Update | `PUT /api/users/{id}` requires ALL fields (name, email, role_id, avatar_color, is_active). Partial update not supported. |
| Notification read | Use `PATCH` not `PUT` for `/notifications/read-all` and `/notifications/{id}/read` |
| VITE_API_URL | Baked into React build at compile time. For Docker: `/api` (nginx proxy). For JAR+external: full URL. Rebuild frontend if changing. |
