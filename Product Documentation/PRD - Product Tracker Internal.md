# PRD — Product Tracker Internal
**Product Requirements Document**

| | |
|---|---|
| **Versi** | 3.28 |
| **Tanggal** | 19 November 2026 |
| **Status** | Live — Production |
| **Pemilik** | Tim Internal |

---

## 1. Latar Belakang & Tujuan

Product Tracker adalah sistem manajemen pengembangan produk internal yang dibangun untuk menggantikan pencatatan manual (spreadsheet, Notion, grup chat). Sistem ini menjadi satu-satunya sumber kebenaran (_single source of truth_) untuk:

- Status pekerjaan seluruh tim dev — dari Epic hingga Task
- Sprint planning dan tracking burndown
- Daily standup tim
- QA dan test case management
- Visibility lintas produk bagi manajemen

**Tujuan utama:** Mempercepat siklus delivery dengan mengurangi overhead koordinasi dan memberikan visibilitas real-time kepada semua stakeholder.

---

## 2. Pengguna & Peran

Role **bukan daftar tetap di kode** — role apa pun bisa dibuat/diubah/dihapus bebas lewat halaman **Users & Roles → Roles & Permissions** (3.10), dan hak aksesnya ditentukan oleh matrix **Modul × Aksi** per role (lihat 3.10 untuk detail model datanya). Tabel di bawah ini adalah **7 role default** yang ter-seed saat instalasi awal — bisa diedit atau dihapus kapan saja oleh Super Admin (kecuali role `super_admin` itu sendiri, yang selalu bypass semua pengecekan terlepas isi matrix-nya):

| Role | Deskripsi | Hak Akses Utama (default) |
|---|---|---|
| **Super Admin** | Akses penuh tanpa batasan | Semua modul + manajemen user + konfigurasi sistem (bypass hardcode, bukan dari matrix) |
| **Manager** | Kepala tim / manajemen | Hampir semua modul (create/update/delete), manajemen user, import standup, kecuali Bugs Incident & C-Level |
| **Product Owner (PO)** | Pemilik produk | Kelola backlog, sprint, feature, epics, QA (create/update), roadmap untuk produk yang di-assign; Client Management (lihat & ubah, tanpa tambah/hapus client) |
| **Developer** | Anggota tim dev | Buat/update backlog & epic; untuk item di luar itu hanya bisa update item yang di-assign ke diri sendiri |
| **QA Engineer** | Penguji | Kelola test case, test run, eksekusi pengujian, dan modul Bugs Incident (3.9) |
| **SME** | Subject Matter Expert lintas fungsi | C-Level Dashboard — Leader Notes & Leader Task (3.10 C-Level) |
| **Commissioner** | Pengawas/komisaris | C-Level Dashboard — Leader Notes & Leader Task, setara SME |

**Aturan akses produk:** Developer dan QA hanya melihat item dari produk tempat mereka terdaftar sebagai member. Exception: semua user selalu dapat melihat item yang di-assign langsung ke mereka (My Tasks). Ini adalah filter data (query-level), terpisah dari matrix Modul × Aksi di atas yang mengatur aksi (create/update/delete).

**Pelapor eksternal (bukan role sistem):** Sejak versi 2.5, karyawan kantor yang **tidak punya akun** Product Tracker sama sekali bisa melaporkan bug lewat form publik tanpa login (lihat 3.15) — bukan salah satu dari 5 role di atas, tidak masuk tabel `users`, dan tidak punya akses ke bagian manapun dari aplikasi selain form itu sendiri.

---

## 3. Modul & Fitur

### 3.1 Dashboard

**Tujuan:** Memberikan gambaran lintas produk secara real-time kepada manajemen dan PO.

**Fitur:**
- **Overview stats** — total backlog, sprint aktif, item selesai bulan ini, item terlambat
- **Sprint velocity chart** — grafik poin yang diselesaikan per sprint (6 sprint terakhir)
- **Team Workload** — distribusi jumlah task aktif per orang dalam story points. Hanya item bertipe `task` dan `bug` yang dihitung — tipe `story`, `epic`, dan `independent` dikecualikan. Kapasitas maks: **20 pts**
- **User Occupation** — beban kerja per user berdasarkan konversi jam:
  - Item sprint aktif (non-independent): 1 Story Point = 6 jam
  - Item tipe `independent`: menggunakan `estimated_hours` langsung (tanpa konversi)
  - Kapasitas baseline: **80 jam** per sprint
  - Indikator beban: **Ringan** (< 40j) / **Normal** (40–64j) / **Padat** (64–80j) / **Overload** (> 80j)
  - Klik nama user untuk melihat detail item yang sedang dikerjakan
- **Delayed items list** — item yang melewati due date atau target sprint; item berstatus **In Review**, Done, dan Backlog tidak dihitung terlambat (lihat 3.2)

**Akses:** Semua role (data disesuaikan dengan scope produk masing-masing role)

---

### 3.2 Backlog Management

**Tujuan:** Kelola semua backlog item dalam hierarki Epic → Story → Task/Bug, plus item independen.

**Tipe Item (5 tipe):**

| Tipe | Warna | Deskripsi |
|---|---|---|
| `epic` | Ungu | Kontainer besar, SP otomatis dari child stories |
| `story` | Biru | User story, dapat punya parent epic |
| `task` | Abu | Implementasi, wajib punya parent story |
| `bug` | Merah | Bug, wajib punya parent story |
| `independent` | Orange | Task mandiri — tidak terikat sprint, epic, maupun story. Menggunakan **Estimasi Jam** bukan Story Points |

**Fitur Backlog:**
- CRUD item dengan 5 tipe di atas
- Hierarki parent-child: Task/Bug ← Story ← Epic
- **Dropdown pencarian untuk field Parent:** field **Parent User Story** (Task/Bug) dan **Parent Epic** (Story) berupa dropdown dengan kotak pencarian di dalamnya — ketik untuk filter berdasarkan kode/judul, bukan sekadar daftar panjang untuk di-scroll. Pola yang sama juga dipakai untuk field Backlog Item di form Bug (3.9) dan Test Case (3.8). Dropdown ini mengecualikan item yang sedang diedit dari daftar pilihannya sendiri — penting saat **mengubah Tipe item** (mis. Epic → Story), karena sebelum disimpan item tersebut masih berstatus tipe lama di database dan secara teknis bisa saja muncul sebagai kandidat parent untuk dirinya sendiri
- **Validasi parent anti-siklus:** backend menolak (400 Bad Request, "Parent item membentuk siklus") `parent_id` yang mengarah ke diri sendiri atau membentuk rantai melingkar (mis. A→B→A) lewat chain beberapa parent. Ini juga melindungi kalkulasi **Story Points auto-cascade** di bawah — tanpa validasi ini, parent_id yang melingkar dapat membuat proses cascade SP rekursi tanpa henti (`StackOverflowError`) saat item mana pun di rantai itu di-update
- **Dropdown pencarian multi-select untuk Assignee:** filter **Assignee** di toolbar Backlog, dan field **Assignee** di form Tambah/Edit item, berupa dropdown checklist dengan kotak pencarian — ketik nama untuk menyaring, tetap bisa pilih lebih dari satu orang (komponen `SearchableMultiSelect`, varian multi-select dari pola `SearchableSelect` di atas). Pola yang sama juga dipakai untuk filter Assignee dan field Assigned To di Bugs Incident (3.9)
- **Impacted Features (multi-select):** field **Feature** di form Tambah/Edit item diganti **Impacted Features** — dropdown checklist dengan kotak pencarian (komponen `SearchableMultiSelect`, sama seperti Assignee) sehingga **satu item bisa menandai lebih dari satu feature roadmap** (Products → Roadmap) yang terdampak. Opsi disaring ke produk yang dipilih; mengganti produk mereset pilihan; field nonaktif sampai produk dipilih. Pilihan tampil sebagai chip di bawah dropdown. Di tabel Backlog tampil feature pertama plus badge **+N** untuk sisanya di samping judul (tooltip berisi daftar lengkap); di My Tasks tampil di detail dan baris daftar. Perubahan feature tercatat di log aktivitas item (`Impacted Features: "A" → "A, B"`). Penamaan ini **hanya di Backlog** — Bugs Incident dan QA tetap memakai satu "Feature" dari tabel `features` (bukan roadmap). Backend: tabel `backlog_item_features` (`migration_v27.sql`); POST/PUT `/api/backlog` menerima `feature_ids` (array, urutan pertama juga disimpan di kolom lama `feature_id` agar query lama tetap jalan), `400` kalau ada feature milik produk lain, `feature_id` tunggal dari klien lama tetap diterima, dan PUT tanpa kedua field membiarkan feature apa adanya. Response item menambah array `features` (`[{id, name}]`)
- **Share link (salin link kartu):** setiap record punya tombol **Salin link** yang menyalin URL absolut deep link-nya, mis. `http://host/backlog?item=123` — membuka link itu langsung membuka kartu/modal record tersebut. Tombol ada di header modal sebagai tombol merah bertuliskan "Salin link" (Backlog, Bugs Incident, QA Test Case, Sprint, Produk/Epic/Feature/Roadmap, Client, Leader Task) serta sebagai ikon kecil di baris tabel dan kartu Board Backlog, kartu Kanban dan header Sprint, baris Epic Board, My Tasks (baris dan panel), dan panel Leader Task; modul Users tidak diberi tombol. Link selalu dibuat dari ID record (bukan address bar, karena halaman menghapus `?item=` setelah modal terbuka). Salin tetap jalan di server http biasa (tanpa HTTPS) lewat fallback `execCommand`, dan bila browser menolak keduanya link ditampilkan di kotak dialog untuk disalin manual. **Redirect setelah login:** pengunjung yang belum login atau tokennya kedaluwarsa dikirim ke Login lalu **kembali ke link tujuan** (bukan dashboard) — berlaku juga untuk link notifikasi/email; hanya path internal yang diterima (`//host` dan `/login` diabaikan). **Tanpa izin edit:** Backlog membuka modal **Detail Item** baca-saja (field nonaktif, tanpa tombol Perbarui; komentar dan lampiran tetap bisa dilihat); modul lain mengikuti aturan lama (halaman terbuka, modal hanya untuk role berizin). Hak lihat tidak berubah: `GET /api/backlog/{id}` memang tidak membatasi per produk. Frontend saja, tanpa migrasi
- **Related Card (kartu terkait):** kartu dari modul lain yang terhubung ke item Backlog — **tiket Bugs Incident** yang field *Backlog Item*-nya menunjuk item ini, **tiket asal** bila kartu ini dibuat lewat **Buat Backlog** (3.9), dan **QA Test Case** milik item ini.
  - **Di kartu:** chip kecil di baris List (sebelah chip parent) dan di kartu Board (baris di bawah judul, bersama chip parent): ikon bug + jumlah tiket (**merah** bila masih ada tiket yang Stage-nya belum ber-flag selesai, **abu-abu** bila semua sudah closed) dan ikon tabung uji + jumlah test case. Tooltip berisi ringkasan, mis. "Related Card: 1 tiket Bugs Incident (1 masih open): BUG-001 · 1 QA test case". Klik chip membuka item dengan section Related Card langsung terbuka (mengikuti aturan buka item yang sama: hanya user yang boleh mengedit Backlog; user lain melihat chip sebagai penanda saja)
  - **Di detail item:** section **Related Card (n)** di bawah Tasks & Bugs / Linked Stories, tertutup secara default (klik untuk membuka; rinciannya baru dimuat saat dibuka) dengan keterangan "· N tiket masih open". Isinya dikelompokkan: **Bugs Incident** (Type, kode, judul, Stage; tiket asal ditandai **Asal kartu ini** dan ditaruh paling atas, lalu yang masih open, lalu yang terbaru) dan **QA Test Case** (kode, judul, hasil run terakhir atau "Belum di-run", tanda `deprecated`). Klik baris membuka tiket/test case di modulnya (`/bugs?bug=ID`, `/qa?case=ID`). Tanpa relasi: "(0)" dan petunjuk cara menghubungkan
  - **Akses:** semua yang bisa membuka item melihat daftar ini (kode, judul, Type, Stage saja). User tanpa `bugs.access` (mis. PO, Developer) tetap melihat baris tiket tetapi **tidak bisa mengkliknya** karena halaman Bugs Incident tertutup untuknya (tooltip menjelaskan); baris test case tetap menaut ke QA Module
  - **Hanya info:** tidak mengubah status, progress, maupun assignee item, dan tidak mengubah logika modul lain. Relasi parent/child (Tasks & Bugs, Linked Stories) dan **Task Pribadi Terkait** tetap di section masing-masing. Kartu Backlog bertipe `bug` (child dari story) bukan bagian Related Card — itu tetap tampil di Tasks & Bugs story-nya
  - Backend: response item Backlog (list, detail, POST/PUT/PATCH) menambah `related_bug_count`, `related_bug_open_count`, `related_bug_codes`, `related_tc_count`; endpoint baru `GET /api/backlog/:id/related`. Tanpa migrasi (index `bugs.backlog_item_id`, `bugs.converted_backlog_id`, dan `qa_test_cases.backlog_item_id` sudah ada)
- **Story Points auto-cascade:** SP pada Task otomatis dijumlahkan ke Story parent → lalu ke Epic grandparent. Berlaku untuk create, update, dan delete
- **Epic SP read-only:** Form Epic menampilkan SP sebagai kalkulasi otomatis (tidak bisa diinput manual)
- **Story Points hints:** Panduan skala SP (1–13) ditampilkan langsung di form untuk membantu estimasi
- **Independent task:** Tidak memiliki sprint, parent, atau epic. Field wajib: `estimated_hours` (jam kerja langsung). Nilai ini digunakan di Dashboard User Occupation
- Filter: produk, sprint, tipe, status, assignee, prioritas, range deadline, pencarian teks
- **Shortcut filter chips:** Backlog · Story · Epic · ✅ Selesai — klik sekali untuk filter cepat, klik lagi untuk hapus
- **Hide done by default:** Item berstatus `done` disembunyikan dari tampilan default. Gunakan chip "✅ Selesai" untuk melihat item yang sudah selesai
- **Aturan "terlambat" (deadline merah):** item dihitung terlambat bila deadline sudah lewat **dan statusnya bukan `done`, `backlog`, atau `in_review`** — item yang sedang **In Review** (menunggu review orang lain) tidak pernah dianggap terlambat: tanggalnya tidak merah, tanpa ikon peringatan/tulisan "terlambat", dan tidak masuk hitungan Delayed (Dashboard, My Tasks, Epic Board, C-Level, Export MD). Begitu status kembali ke `todo`/`in_progress`/`blocked` dan deadline sudah lewat, item merah lagi. Aturan ini dihitung di backend (`is_delayed`), jadi semua halaman konsisten. Berlaku sama untuk Leader Tasks (C-Level). **Story/Epic**: statusnya otomatis mengikuti anak (maju saja), sehingga Story/Epic yang punya anak `in_review` ikut berstatus `in_review` dan tidak merah selama belum ada anak yang lebih maju — anak yang terlambat tetap merah di barisnya sendiri
- Status item: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`
- **Status Epic & Story otomatis mengikuti anak (maju saja):** status induk dihitung ulang setiap kali status anaknya berubah (lewat dropdown/menu status, Board, My Tasks, form Edit, maupun item baru). Anak Epic = semua Story, Task, dan Bug di bawahnya (termasuk Task/Bug di bawah Story); anak Story = Task dan Bug langsungnya. Urutan status induk: `backlog` → `todo` → `in_progress` → `in_review` → `done`.
  - **Naik mengikuti anak paling maju:** cukup **1 anak** yang pindah ke `todo`/`in_progress`/`in_review` dan induk ikut ke status itu, walaupun anak lain masih `backlog` atau `in_progress`. Contoh: satu Task `in_progress` → Story dan Epic `in_progress`; Task lain `in_review` → Story dan Epic `in_review`.
  - **`done` hanya bila SEMUA anak `done`.** Satu anak `done` belum cukup; induk tetap di status terakhirnya. Dihitung dari bawah ke atas, jadi menandai Task/Bug terakhir `done` bisa menyelesaikan Story lalu Epic sekaligus dalam satu aksi.
  - **Tidak pernah mundur otomatis:** anak yang kembali ke `in_progress` (revisi) atau `backlog` tidak menurunkan induk, dan induk yang sudah `done` tetap `done` walau ada anak baru atau anak dibuka lagi — mengubahnya kembali harus manual.
  - **`blocked` tidak memengaruhi induk** (anak `blocked` tidak menggeser induk), dan induk yang sedang `blocked` dibiarkan (tidak ditimpa).
  - Story/Epic **tanpa anak** dan item `independent` tetap sepenuhnya manual. Status induk tetap boleh diubah manual kapan saja, termasuk mundur; hitung ulang otomatis hanya jalan ketika ada anak yang berubah status atau dibuat.
  - Setiap perubahan otomatis tercatat di log aktivitas induk (mis. `Status diubah otomatis dari "in_review" menjadi "done" karena semua item di bawahnya Done`), tanpa notifikasi email. Backend saja (`BacklogController`), tanpa migrasi; data lama tidak diperbaiki otomatis — induk baru menyesuaikan ketika salah satu anaknya berubah status
- Prioritas: `low`, `medium`, `high`, `critical`
- Assign ke developer, set due date, set sprint, hubungkan ke epic/feature
- **Pindah sprint langsung dari tabel:** kolom **Sprint** di tabel Backlog berupa dropdown — pilih sprint lain (atau kembali ke "Backlog (no sprint)") tanpa buka form edit, pola quick-update yang sama seperti kolom Status. Item tipe `independent` tidak punya dropdown ini karena tidak terikat sprint. Perubahan tercatat di log aktivitas item; tidak mengirim notifikasi email (beda dari perubahan status)
- **Pagination server-side** dengan pilihan baris per halaman **10 / 30 / 50 / 100** (default 30). Mengganti jumlah baris langsung memuat ulang data dan kembali ke halaman 1 — tidak perlu menekan filter/tombol lain dulu. Pilihan ini hanya berlaku di halaman Backlog (tidak dibagi ke QA/Bugs dan kembali ke default saat halaman di-refresh)
- Import dari Jira (CSV)
- **Lampiran** — unggah file ke backlog item: gambar (JPEG/PNG/GIF/WebP), PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT (max 10MB per file, multi-file). Preview inline untuk gambar, PDF, TXT, dan CSV (dirender sebagai tabel) — tipe lain dibuka/diunduh di tab baru. Lampiran **opsional** dan bisa ditambahkan juga saat **membuat** item baru (file diantrekan lalu diunggah otomatis begitu item tersimpan, sama seperti Bugs/QA). **Tempel dengan Ctrl+V**: gambar di clipboard (mis. screenshot Win+Shift+S) atau file hasil copy dari Explorer langsung jadi lampiran tanpa dialog unggah — berlaku di semua form berlampiran (Backlog, Bugs Incident, QA Test Case, dan Lapor Bug Publik). Aturan paste: hanya diambil bila clipboard berisi file **tanpa teks** (menyalin sel Excel/Word atau teks biasa tetap tertempel sebagai teks); tipe/ukuran divalidasi sama seperti unggah biasa (Lapor Bug Publik: gambar saja); screenshot otomatis dinamai `screenshot-YYYYMMDD-HHMMSS.png`
- **Author** — saat item diklik (dari tampilan List, Board, maupun item anak), modal Edit menampilkan baris read-only **Author: <nama> · <tanggal dibuat>** di paling atas, supaya terlihat siapa yang membuat item tanpa menambah kolom di tabel. Datanya dari `backlog_items.created_by` yang sudah terisi otomatis sejak awal (user yang login saat create; user yang meng-import saat Import Jira), dikirim backend sebagai `created_by_name` (JOIN `users`) di semua endpoint backlog. `—` bila user pembuatnya sudah dihapus. Tidak ada migrasi dan Author tidak bisa diubah dari form
- **Progress %** — tabel Backlog (list) punya kolom **Progress** (setelah *Status*, bar + angka), kartu di tampilan Board punya bar progress di bawahnya, dan modal item menampilkan Progress **baca-saja** (tidak ada input). Progress % selalu **dihitung otomatis**, tidak pernah diisi manual, jadi tidak bisa basi dan tidak butuh kolom database (kecuali snapshot Standup, 3.7). Aturan: (1) item **tanpa anak** dihitung dari status — `backlog`/`todo` 0%, `in_progress` 50%, `in_review` 80%, `done` 100%, `blocked` 25% (satu tempat konstanta di `ProgressSupport`); (2) item **yang punya anak** (Story/Epic) = rata-rata progress item di bawahnya, dibobot story point (item 0 poin berbobot 1 supaya pekerjaan yang belum diestimasi tetap terhitung). "Tanpa anak" ditentukan oleh **struktur**, bukan tipe: Story yang belum punya Task dihitung sebagai item kerja biasa, dan Epic kosong (kontainer) tidak ikut menghitung. Dihitung dari **seluruh pohon produk**, bukan hanya halaman/filter yang tampil, jadi angka induk tidak berubah karena paginasi. API `GET/POST/PUT /api/backlog` mengembalikan field `progress` (0–100). Ganti status (dropdown list, Board, My Tasks) langsung mengubah angkanya karena dihitung saat dibaca. Keterbatasan: karena dari status, item In Progress selalu 50% (tidak ada gradasi di dalam satu task)
- **Toast sukses menampilkan kode baru:** setelah item dibuat, toast menyebut kode yang baru terbentuk (mis. `Item HRS-098 ditambahkan`) supaya mudah dicari di tabel — kodenya ditebalkan (monospace) dan toast tampil 6 detik (default 3 detik). Berlaku untuk Backlog (form Tambah Item, juga lewat tombol "+" grup dan Ctrl K), **Epic Board** (`Epic HRS-104 dibuat`; sebelumnya tanpa toast), **Bugs Incident** (`Bug HRS-053 dibuat`, 3.9), dan **QA Module** (`Test case TC-045 dibuat`, 3.8). Kode yang ditampilkan adalah kode yang benar-benar tersimpan (otomatis maupun yang diketik manual), diambil dari respons create. Toast edit, toast error, dan hasil Import CSV/Jira (hanya menyebut jumlah) tidak berubah. Frontend saja, tanpa migrasi

**Komentar & Aktivitas:**
- Setiap item memiliki tab aktivitas yang menampilkan log perubahan dan komentar
- **@mention:** Ketik `@` di kolom komentar untuk memunculkan dropdown user. Pilih dengan klik atau navigasi ↑↓ + Enter/Tab. Mention ditampilkan sebagai badge indigo `@Nama`
- Hapus komentar sendiri (Super Admin bisa hapus semua)

**Akses:**
- Super Admin, Manager, PO: CRUD penuh
- Developer, QA: update status item yang di-assign ke diri sendiri

---

### 3.3 My Tasks

**Tujuan:** Tampilan personal yang menampilkan semua task/bug yang di-assign ke user yang sedang login.

**Fitur:**
- Menampilkan semua item dengan `assignee_id = current_user` tanpa filter produk
- Kartu item menampilkan: judul, tipe, prioritas, status, produk, sprint, due date
- Filter lokal: status, prioritas
- Update status langsung dari kartu (inline)
- Penanda **terlambat** (tanggal merah, ikon, hitungan Overdue) mengikuti aturan 3.2: status **In Review** tidak dihitung terlambat
- **Progress %** — tabel My Tasks punya kolom **Progress** (setelah *Status*) dan panel detail task menampilkan bar Progress baca-saja. Item yang sama dengan Backlog, jadi angkanya identik (aturan di 3.2). Setelah status diganti dari tabel atau panel, progress diambil ulang dari server tanpa memuat ulang halaman (progress Story juga ikut berubah bila task-nya berubah)

- **Add Task (task pribadi)** — tombol **Add Task** di kanan atas halaman membuat task untuk diri sendiri: Judul (wajib), **Produk** (wajib; dropdown dengan pencarian, pilihan = produk yang bisa diakses user, sama dengan daftar produk sidebar Planning), **Item Backlog terkait** (opsional, dropdown dengan pencarian berisi item produk itu), Status (To Do / In Progress / In Review / Done / Blocked), Deadline, Catatan
  - **Relasi, bukan konversi:** task pribadi **bukan item Backlog** — tidak punya kode, tidak masuk sprint, story points, velocity, maupun progress produk/fitur. Item Backlog terkait hanya dijadikan rujukan (ditampilkan "HRS-2 terkait") dan tidak berubah apa pun. Memilih item terkait otomatis mengunci produk ke produk item itu
  - Tampil di tabel My Tasks bersama item yang di-assign, berlabel **Pribadi** (Kode) dan tipe `pribadi`; Prioritas dan Sprint "—". Status bisa diganti inline; klik baris membuka form edit (ada tombol **Hapus**); ikon tautan membuka item Backlog terkait. Progress dari status (aturan 3.2), terlambat jika deadline lewat kecuali Done/In Review
  - Hanya **pemiliknya** (dan Super Admin) yang bisa mengubah atau menghapus. Orang lain melihatnya lewat Management Dashboard (3.18), sumber "My Task" dengan PIC = pemilik, dan lewat panel info **Task Pribadi Terkait** di detail item Backlog yang dirujuk (judul, pemilik, deadline, status; catatan pribadi tidak ditampilkan; hanya info, tidak mengubah assignee maupun progress item; panel tersembunyi bila tidak ada task terkait)
  - Tidak ada permission khusus (My Tasks memang tanpa gate); produk tetap dicek ke `user_products` (Super Admin & Manager boleh semua produk)

**Catatan implementasi:** Bypass filter produk khusus untuk query ini — developer yang belum terdaftar di `user_products` tetap bisa melihat task yang di-assign ke mereka. Task pribadi disimpan di tabel `personal_tasks` (`migration_v33.sql`), endpoint `/api/personal-tasks`.

---

### 3.4 Epic Board

**Tujuan:** Visualisasi progress per Epic dalam format board.

**Fitur:**
- Tampilan kanban per epic dengan breakdown story dan task di dalamnya
- Progress bar visual berdasarkan jumlah item done vs total
- Filter per produk

---

### 3.5 Sprint Management

**Tujuan:** Kelola sprint dan pantau progress pengerjaan.

**Fitur:**
- Buat, edit, mulai, dan selesaikan sprint per produk
- Field sprint: nama, tanggal mulai/selesai, **capacity** (maks story points yang direncanakan, default 22 pts)
- **Sprint board (Kanban):** Tampilan item dikelompokkan per kolom status (`todo`, `in_progress`, `in_review`, `done`, `blocked`). Kartu bersifat tampilan saja (kode, tipe, judul, story points) — status item diubah dari halaman Backlog atau My Tasks (menu status inline), bukan dari kartu Kanban
- **Burndown chart:** Grafik poin tersisa vs ideal burndown per sprint
- Lihat sprint aktif dan riwayat sprint

**Status sprint:** `planned`, `active`, `completed`

---

### 3.6 Product Management

**Tujuan:** Kelola produk, epic, dan feature sebagai kontainer hierarki item.

**Fitur:**
- CRUD produk (nama, deskripsi, warna)
- **Progress %** produk — kartu produk menampilkan bar dan angka **Progress N%** (menggantikan "% selesai" lama yang hanya menghitung jumlah item Done dibanding total, termasuk Epic/Story sebagai item). Kini = rata-rata progress seluruh **item kerja** produk (item tanpa anak, bukan Epic kosong), dibobot story point, dengan aturan status → persen yang sama seperti Backlog (3.2). Produk tanpa item kerja tampil 0%. Jumlah **Items** dan **Done** di kartu tetap ada. Contoh data lokal: HRS 30% → 37%, CRM 27% → 31%, FIN 38% → 54%. API `GET /api/products` mengembalikan field `progress` (null bila belum ada item). Bar persen di baris Product Features (berbasis poin selesai) dan di Sprints/Epic Board **tidak diubah**
- Kelola epics per produk
- Kelola features per produk
  - **Target (tanggal)** — field tanggal opsional di form Feature (di samping *Target Release* yang tetap berupa teks versi, mis. `v1.2`), tampil di daftar feature dengan ikon target dan menjadi kolom **Target** di Management Dashboard (3.18). Disimpan di `features.target_date` (`migration_v33.sql`); request lama yang tidak mengirim field ini tidak menghapus tanggal yang tersimpan
- Assign member ke produk (menentukan scope akses Developer/QA)
- Roadmap produk (timeline feature) — status item: `planned`, `research`, `on_progress`, `testing` (sedang tahap testing), `active`, `offline`
  - **Sort tabel Roadmap** (sejak 3.27) — header kolom **Fitur**, **Produk**, **Status**, **Versi**, dan **Target Rilis** bisa diklik: klik pertama urut naik, kedua urut turun, ketiga kembali ke urutan awal (produk → urutan → id dari server); kolom yang aktif ditandai panah. Status diurutkan menurut alur Planned → Research → On Progress → Testing → Active → Offline (bukan abjad), Versi secara natural (`v1.2` sebelum `v1.10`), Target Rilis menurut tanggal; baris tanpa nilai selalu di bawah. Sort berlaku di atas filter Produk/Status dan tidak mengubah kartu ringkasan status. Dilakukan di browser (frontend saja)
  - **Scroll horizontal** — tabel punya lebar minimum sehingga di layar sempit (sidebar terbuka, tablet, HP) kolom tidak lagi terjepit/terlipat: tabel bisa digeser ke kanan/kiri di dalam kartunya, halaman sendiri tidak ikut melebar. Deskripsi dipotong satu baris dengan tooltip berisi teks lengkap
- **Export MD (untuk AI)** — tombol **Export MD** di setiap kartu produk mengunduh **satu file Markdown** berisi paket data lengkap produk itu, siap diunggah ke AI apa pun (Claude, ChatGPT, Gemini, dll.):
  - Isi: legenda cara membaca, ringkasan angka, data produk, Roadmap, Product Features, Epic, Sprint, **Backlog** tersusun Epic → Story → Task/Bug (termasuk acceptance criteria, catatan, **komentar & riwayat aktivitas**), **Bugs Incident** (deskripsi, langkah reproduksi, **riwayat progress**, komentar & aktivitas), dan **QA Test Case** (langkah, expected result, **riwayat test run**). Tiap kartu punya link ke kartu aslinya
  - Legenda menjelaskan bahwa ada dua jenis feature: Roadmap (dipakai Impacted Features di Backlog) dan Product Features (dipakai Bugs/QA)
  - Isi file mengikuti hak akses akun pengekspor (produk yang ditugaskan, akses Bugs Incident); tanpa akses Bugs, bagian Bugs diganti catatan. **Tidak disertakan:** Client Management, alamat e-mail, dan lampiran (hanya teks)
  - Dibuat sepenuhnya di browser dari endpoint GET yang sudah ada (pola sama seperti Export CSV); riwayat tiap kartu diambil paralel dengan indikator progres di toast. Riwayat kartu yang gagal dimuat ditandai di kartunya, export tidak dibatalkan
  - Nama file: `PO-Tracker_<KODE>_<yyyyMMdd_HHmm>.md`
  - Progress % (3.2, 3.6, 3.8) ikut tercantum di produk, kartu Backlog, dan test case, plus satu baris di legenda yang menjelaskan cara menghitungnya
  - **Akses:** permission `export.md` (modul **Export MD** di Roles & Permissions, 3.10). Default (`migration_v28.sql`): Super Admin, Manager, Product Owner, QA Engineer
  - **Uji keterbacaan AI (17 Nov 2026):** file dibaca AI tanpa melihat kode, lalu jawabannya dicocokkan dengan database. Ringkasan angka, kartu terlambat, progress sprint, test run yang gagal beserta bug-nya, dan bug per feature semuanya cocok. **Keterbatasan yang diketahui:**
    - Istilah **Epic** dan **Bug** masing-masing punya dua arti (kartu Backlog bertipe Epic/Bug vs Epic produk seperti `HRS-E1` / tiket Bugs Incident) dan belum dijelaskan di legenda, sehingga pertanyaan "berapa epic/bug?" bisa dijawab dua versi
    - Judul tiket Bugs Incident dan QA Test Case belum diberi label tipe seperti `[Story]` di Backlog, padahal kode bug berformat `HRS-051` mirip kode Backlog
    - Belum ada tabel ringkas satu baris per kartu. Untuk produk dengan ratusan kartu, AI yang membaca file per potongan (mis. ChatGPT) bisa melewatkan kartu saat menghitung atau merangkum per orang
    - Assignee kartu hasil Import Jira (3.11) tetap tercantum di file walau tidak tampil di Backlog/My Tasks, karena export memakai kolom assignee lama sebagai cadangan

---

### 3.7 Daily Standup

**Tujuan:** Pencatatan dan arsip standup pagi seluruh tim.

**Fitur:**

**Input Standup:**
- Form standup harian: kemarin, hari ini, blocker, rencana atasi blocker
- Satu standup per user per hari (sistem mencegah duplikat)
- Edit standup hari ini selama hari berjalan
- **Progress Pekerjaan** — kartu standup (tab Riwayat) menampilkan bar **Progress Pekerjaan** bila terisi, lengkap dengan **selisih dari standup sebelumnya** ("▲ +15% sejak 16 Nov"; "▼" bila turun, "● tetap" bila sama) dan satu baris keterangan **jumlah item per status** ("dari 3 item sprint aktif: 2 in progress · 1 blocked"). Tidak diisi user: server mencatatnya saat standup **hari ini** disimpan (create dan edit) = rata-rata progress item kerja (item tanpa anak, bukan Epic kosong) yang di-assign ke penulisnya di **sprint yang sedang aktif**, dibobot story point (aturan status → persen sama seperti 3.2). **Tanpa item di sprint aktif, tidak ada progress dan tidak ada bar** — sengaja tidak memakai item lama/belum direncanakan sebagai cadangan, supaya angka tidak terbaca "semua selesai". Selisih dibandingkan dengan standup terakhir milik orang yang sama yang punya progress (standup tanpa progress dilewati). Pada standup naratif, angka ini pelengkap narasi, bukan pengganti. Karena standup adalah catatan satu hari, ini **snapshot**: standup lama, standup hasil Import, dan standup dengan tanggal mundur (selisih lebih dari 1 hari dari hari ini server) **tidak punya progress**. Edit standup lama tidak mengubah snapshot-nya; menyimpan ulang standup hari ini menyegarkannya. Kolom `standups.progress` (`SMALLINT`) dan `standups.progress_detail` (`TEXT`, JSON status → jumlah), keduanya nullable, `migration_v30.sql`. Angka ini **bukan** persentase kehadiran di tab Achievement

**Riwayat:**
- Lihat standup berdasarkan user yang sedang login (default semua role)
- Manager/Super Admin dapat filter ke standup user lain via parameter `user_id`
- Filter rentang tanggal

**Achievement:**
- Statistik konsistensi standup per user
- Persentase kehadiran vs hari kerja bulan ini, total standup, total blocker

**Import CSV / Excel (Manager/Super Admin only):**
- Upload file `.csv`, `.xlsx`, atau `.xls` untuk migrasi data standup historis
- Parser xlsx menggunakan Java ZIP+XML (tidak bergantung library eksternal) — kompatibel dengan semua versi Excel
- Kolom yang didukung (fleksibel, case-insensitive, mendukung nama kolom Bahasa Indonesia dan Inggris):

| Kolom Canonical | Alias yang Diterima |
|---|---|
| `email` | email |
| `standup_date` | standup_date, date, tanggal, standup date, standup meeting date |
| `yesterday` | yesterday, kemarin, task yang dilakukan kemarin |
| `today` | today, hari ini, task yang akan dilakukan hari ini |
| `has_blocker` | has_blocker, blocker?, ada blocker |
| `blocker` | blocker, hambatan, apa yang diperlukan untuk menghilangkan blocker: |
| `blocker_plan` | blocker_plan, rencana, estimasi penyelesaian task |

- Header dapat berada di baris mana pun (baris kosong di atas header otomatis dilewati)
- Tanggal Excel serial number otomatis dikonversi ke `YYYY-MM-DD`
- Duplikat (user + tanggal sudah ada) dilewati otomatis
- Laporan hasil: jumlah berhasil, dilewati, error per baris

**Format nilai `has_blocker`:** `true/false`, `1/0`, `yes/no`, `ya/tidak`

---

### 3.8 QA Module

**Tujuan:** Manajemen test case dan eksekusi pengujian.

**Fitur:**
- CRUD test case dengan link ke backlog item — field **Backlog Item** (wajib) memakai dropdown dengan kotak pencarian (pola dasar sama seperti 3.2 & 3.9), memudahkan pencarian saat daftar backlog item sudah banyak. Opsinya disusun **hierarkis** (Epic → Story → Task/Bug mengikuti `parent_id`, terindentasi per level; item `independent` di grup terpisah paling bawah) dengan **badge warna tipe** (Story/Task/Bug/Epic/Independent, sama seperti warna di tabel Backlog 3.2) di kiri kode — di tiap level, item diurutkan tipe dulu baru kode, supaya mis. Task tidak menyelip di antara daftar Story hanya karena kodenya lebih kecil. Item berstatus **`done` disembunyikan** dari pilihan baru (QA Test Case untuk item yang sudah selesai jarang relevan dibuat baru) — kecuali item itu sedang jadi pilihan test case yang sedang diedit, supaya tidak silently ke-unlink. Lebih kaya dari dropdown pencarian polos di 3.2 (Parent User Story/Parent Epic tidak ikut berubah, tetap teks biasa)
- **Feature (opsional)** — test case bisa dikaitkan ke satu **Feature produk** (tabel `features`, tab Features di halaman Products, kode seperti `BMTFT-1` — **bukan** feature roadmap yang dipakai Backlog Item). Form Buat/Edit Test Case punya dropdown **Feature (opsional)** dengan kotak pencarian; tiap opsi berbentuk `[KODE_PRODUK] KODE_FEATURE · Nama` sehingga bisa dicari lewat kode produk, kode feature, maupun nama. Daftar opsi disaring ke produk yang dipilih di form (semua produk kalau belum dipilih), mengganti produk mereset pilihan Feature. Tabel Test Cases punya kolom **Features** (setelah *Item*, format `[KODE] Nama`, `—` kalau kosong). Backend menolak (`400`) feature milik produk lain. Test case lama otomatis `—`. Menghapus feature **tidak** menghapus test case (`feature_id` jadi `NULL`). Tidak ada filter by feature — cukup filter produk
- **Author** — tabel Test Cases punya kolom **Author** (setelah *Fail*, sebelum *Produk*) berisi nama user yang membuat test case. Datanya dari `qa_test_cases.created_by` yang sudah terisi otomatis sejak awal (user yang login saat create; user yang meng-import saat Import CSV), jadi **tanpa perubahan database** dan test case lama langsung punya Author. `—` bila user pembuatnya sudah dihapus. **Export CSV** memuat kolom `Author`; **Import CSV** mengabaikan kolom ini (Author selalu user yang meng-import). Author tidak bisa diubah dari form
- **Deadline (opsional)** — form Buat/Edit Test Case punya input tanggal **Deadline (opsional)** (di bawah Status/Prioritas); dikosongkan = tanpa deadline. Tabel Test Cases punya kolom **Deadline** (setelah *Status*, format `17 Nov 2026`, `—` kalau kosong). Tanggal jadi **merah dengan ikon peringatan** (tooltip "Lewat deadline") begitu hari deadline sudah lewat — **tanpa syarat status**, karena test case tidak punya status "selesai". Hari H deadline belum merah. Lewat/tidaknya dihitung di browser dengan **tanggal lokal pengguna** (database berjalan di UTC, sehingga pengecekan di SQL bisa meleset sampai 7 jam di WIB). **Export CSV** memuat kolom `Deadline` (`yyyy-MM-dd`); **Import CSV belum membaca** kolom ini (test case hasil import tanpa deadline). Kolom `qa_test_cases.deadline` (`DATE`, nullable, `migration_v29.sql`); test case lama otomatis `—`. Backend menolak (`400`) format selain `YYYY-MM-DD`, dan **Edit yang tidak mengirim field `deadline` tidak mengubah** deadline yang tersimpan (melindungi data saat browser masih memakai versi frontend lama)
- **Progress %** — tabel Test Cases punya kolom **Progress** (setelah *Deadline*). Progress % selalu **dihitung otomatis**, tidak pernah diisi manual, jadi tidak bisa basi dan tidak butuh kolom database (kecuali snapshot Standup, 3.7). Dari hasil **test run terakhir** test case itu: `pass` 100%, `fail` 50% ("sudah dites, belum lolos"), `blocked` 25%, `pending`/`skip`/belum pernah dijalankan 0%. Test case `deprecated` tampil `—`. Warna bar mengikuti hasil (hijau pass, merah fail, kuning blocked) agar fail tidak terlihat seperti kemajuan; tooltip menjelaskan sumbernya. Run terakhir = urut `executed_at` (bila kosong `created_at`) terbaru. API `GET /api/qa/test-cases` mengembalikan `progress` dan `last_result`. Export CSV tidak berubah (tetap 1:1 importable)
- **Klik baris membuka detail** — klik di mana saja pada baris tabel Test Cases langsung membuka modal detail/edit test case (sama seperti ikon pensil, tidak perlu klik ikon dulu), seperti Bugs (3.9) dan Backlog (3.2). Hanya untuk user dengan izin `qa.update`; tombol Run Test / Edit / Hapus di kolom Aksi tidak ikut memicu, dan memilih (select) teks di baris tidak membuka modal
- **Lampiran** — test case bisa diberi lampiran (gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, max 10MB per file) — sebelumnya QA Module tidak punya lampiran sama sekali. Perilaku, tampilan, dan preview sama persis dengan lampiran Bugs Incident (3.9) dan Backlog Item (3.2), lewat komponen bersama `AttachmentSection` di form Buat/Edit Test Case. Tabel baru `qa_attachments` (`migration_v25.sql`); menghapus test case ikut menghapus baris lampirannya. Upload butuh izin `qa.create` atau `qa.update`, hapus lampiran butuh `qa.update`; melihat daftar lampiran tidak butuh izin khusus (sama seperti daftar test case)
- Test run management (kumpulan test case untuk satu sesi pengujian)
- Eksekusi test case: `pass`, `fail`, `skip`, `blocked`
- Eksekusi test case boleh **tanpa memilih Sprint** — field Sprint dikirim kosong (`""`) dan backend memperlakukannya sebagai tidak ada sprint (sebelumnya gagal `500` karena `Long.parseLong("")`)
- QA dashboard: statistik coverage, pass rate, item yang belum di-test. Grafik **Test Results per Sprint** berupa tren per produk (6 sprint terbaru per produk, urut kronologis, skala sumbu Y sama): semua produk → satu grafik kecil per produk, satu produk dipilih → satu grafik penuh; label sumbu X "Sprint N", tooltip memakai nama sprint lengkap. Filter produk di dashboard ikut berlaku ke grafik ini
- **Bugs per Feature (QA Dashboard)** — tabel angka (tanpa grafik) jumlah bug Bugs Incident per **Feature produk** (tabel `features`, Products → tab Produk & Features — sama dengan field Feature di form Bug, **bukan** item roadmap), dipecah per stage: satu kolom per **Stage** terdaftar (6 Stage bawaan **Open, In Progress, Ready to Test, Re-Open, Done, Improvement** plus Stage tambahan dari Super Admin, urut sesuai pengaturan di Bug Stages — sejak 3.25 daftar kolomnya dinamis), plus kolom **Total** dan baris Total di bawah. Angka diberi warna stage (sama dengan badge stage Bugs Incident), angka 0 tampil `–`. Hanya feature yang punya bug yang tampil, urut dari total bug terbanyak; bug tanpa Feature dikumpulkan di baris terakhir **"Tanpa Feature"**. Ikut filter produk; saat "Semua Produk" tiap feature diberi badge kode produk. Header stage rata bawah dengan garis warna stage; tabel bisa di-scroll di dalam kartu (header & baris Total tetap terlihat). **Letak:** saat "Semua Produk", di kolom kiri **di bawah Overall Result Distribution** (Recent Failures di kolom kanan), sehingga tidak terdorong ke bawah oleh daftar Recent Failures yang panjang; saat satu produk dipilih, sejajar dengan Recent Failures (yang kini setengah lebar). **Akses:** hanya role `manager`, `po`, `developer`, `qa` (dan Super Admin) — dicek per **nama role** di backend, **bukan** lewat `bugs.access`, jadi role tersebut bisa melihat angka ini tanpa diberi akses ke modul Bugs Incident; role lain (mis. SME, Commissioner) tidak menerima datanya dan kartunya disembunyikan. Daftar role ada di `BUG_OVERVIEW_ROLES` (`QaController`); belum bisa diatur dari Roles & Permissions. Kartu yang sama (komponen `BugsPerFeatureCard`, query `BugStats.bugsByFeature`) dipakai di Bugs Dashboard (3.9), jadi angkanya selalu sama
- **Daftar produk di sidebar** — saat berada di QA Module, sidebar menampilkan daftar produk (pola sama seperti Backlog, lihat 3.16). Klik produk memfilter halaman lewat `/qa?product=ID`; filter produk di dropdown halaman dan di sidebar saling sinkron
- **Pagination tabel (client-side)** — tab Test Cases dan Test Runs memakai pilihan baris per halaman **10 / 30 / 50 / 100** (default 10), sama seperti Backlog. Ganti jumlah baris langsung berubah (mis. 100 → 30 seketika) dan kembali ke halaman 1. Kalau halaman aktif melewati halaman terakhir setelah filter berubah (mis. dari halaman 16 lalu memilih produk dengan 44 data), halaman otomatis pindah ke halaman terakhir yang berisi data — bukan menampilkan tabel kosong "151–44 dari 44"
- **Export & Import CSV** — tombol **Export CSV** dan **Import CSV** di tab Test Cases, pola sama seperti Bugs Incident (3.9). Export mengeluarkan kolom Kode, Judul, Deskripsi, Langkah, Expected Result, Status, Prioritas, Backlog Item, Features, Produk (**tanpa** Run Count/Pass/Fail — angka itu agregat dari tabel `qa_test_runs`, bukan field test case, jadi tidak ikut diekspor supaya kolomnya tetap 1:1 importable). Cara pakai paling umum adalah round-trip: export → edit di Excel (pakai "Save As → CSV UTF-8", lihat catatan encoding di 3.9) → import balik. Kolom `Produk` di-resolve per baris; kolom `Backlog Item` (format `[KODE] Judul`, sama seperti hasil Export) **wajib** cocok dengan backlog item yang ada di produk tsb — beda dari Bugs Incident yang field ini opsional, di Test Case kolom `backlog_item_id` memang `NOT NULL` di skema, jadi baris dengan Backlog Item kosong atau kodenya tidak ditemukan masuk daftar error, bukan dibuat dengan nilai `NULL`. Kolom `Kode` kosong → auto-generate `TC-###` (algoritma sama persis dengan create manual, per produk); kode yang sudah ada di produk yang sama → baris di-skip (create-only, bukan upsert). Kolom `Status`/`Prioritas` yang tidak valid fallback ke default (`draft`/`medium`). Hasil akhir (dibuat/di-skip/error) ditampilkan di modal setelah proses selesai, tidak ada notifikasi/email terkirim. **Akses:** permission `qa.create` — sama seperti tombol "Buat Test Case"

---

### 3.9 Bugs Incident

**Tujuan:** Pelacakan bug/insiden terpisah dari Test Case QA — mencatat bug yang ditemukan, siapa yang menangani, dan sejauh mana progres perbaikannya.

**Akses:** Modul ini **tidak terlihat/tidak bisa diakses** oleh role selain **Super Admin** dan **QA Engineer** secara default — baik dari sisi menu (disembunyikan) maupun API (setiap endpoint menolak dengan `403` untuk role lain). Role lain bisa diberi akses lewat permission baru `access_bugs` di tab **Roles & Permissions** (Users & Roles, 3.10) — pola yang sama seperti `access_c_level` untuk C-Level Dashboard (lihat [PRD - C-Level Dashboard.md](./PRD%20-%20C-Level%20Dashboard.md), Bagian 10). Saat ini role **Developer** sudah diberi permission `access_bugs`, sehingga punya akses penuh yang setara Super Admin/QA Engineer di modul ini (termasuk tombol Aksi di tabel Bugs, yang sebelumnya sempat ter-hardcode hanya untuk Super Admin/QA).

**Fitur:**
- **Bugs** — CRUD data bug: judul, deskripsi, langkah reproduksi, severity & prioritas (`critical/high/medium/low`), assignee, dan **Stage Awal** (`open` atau `improvement`, hanya muncul saat membuat tiket baru). **Tidak wajib** terhubung ke Backlog Item (beda dari Test Case QA yang wajib) — bug bisa berdiri sendiri untuk insiden yang belum tentu jadi backlog item. Field Backlog Item di form Buat/Edit Bug memakai dropdown dengan kotak pencarian (pola sama seperti 3.2 & 3.8), termasuk opsi tersusun hierarkis dengan badge tipe dan item `done` disembunyikan dari pilihan baru — detail lengkap lihat 3.8
- **Incident Author** — tiap bug menampilkan siapa yang melaporkan/membuat bug tersebut, sebagai kolom terpisah di tabel Bugs (di samping kolom Assigned To). Otomatis diisi dari user yang sedang login saat bug dibuat — **read-only**, tidak ada field untuk memilih/mengubah Incident Author secara manual di form
- **Progress** — riwayat progres perbaikan bug, dicatat sebagai log/histori (bukan satu angka yang ditimpa) setiap kali statusnya diupdate, lengkap dengan catatan dan siapa yang mengupdate
- **Aktivitas & Komentar** — tiap bug punya thread komentar (dibuka dari modal Edit Bug), dengan @mention (ketik `@` untuk dropdown user, badge indigo `@Nama`) dan log perubahan sistem, mengikuti pola yang sama seperti Backlog Item (3.2). Hapus komentar sendiri; Super Admin bisa hapus komentar siapa pun. Log perubahan tidak bisa dihapus
- **Bugs Dashboard** — statistik total bug, jumlah open (Stage ber-flag *dihitung open*: bawaan `open`/`in_progress`/`reopen`, plus Stage tambahan yang tidak ditandai selesai/tidak terlambat), jumlah ready to test, resolution rate (Stage ber-flag *selesai*; stage `improvement` tidak masuk hitungan open/ready to test, tapi tetap masuk Total Bugs dan ikut menurunkan resolution rate), tabel **Bugs per Feature** (2/3 lebar, menggantikan grafik batang "Bugs per Produk" sejak v3.19 — kartu dan aturan sama dengan QA Dashboard, lihat 3.8; di halaman ini aksesnya tetap mengikuti `bugs.access` dan ikut filter produk) bersebelahan dengan pie **Distribusi Stage** (1/3 lebar), **grafik tren bug Dibuka vs Ditutup** (line chart) dengan toggle **Mingguan (8 minggu terakhir) / Bulanan (6 bulan terakhir) / Tahunan (3 tahun terakhir)** (dihitung dari `created_at` dan `closed_at`; bucket tanpa data tetap tampil sebagai 0 agar garis tidak putus), serta dua panel bersebelahan: **Recent Activity** (10 update progress/stage terbaru lintas bug) dan **Recent Comments** (10 komentar terbaru lintas bug)
- **Lampiran** — unggah file pada bug dengan aturan yang sama seperti lampiran Backlog Item (3.2): gambar (JPEG/PNG/GIF/WebP), PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, max 10MB per file. File boleh dipilih sejak form **Buat Bug** (diantrekan lalu diunggah otomatis setelah bug tersimpan) maupun dari form Edit. Klik tile: gambar → preview penuh layar, PDF/TXT/CSV → preview di dalam aplikasi, Word/Excel/PowerPoint/ZIP → dibuka/diunduh di tab baru (nama asli file dipertahankan); tombol X (muncul saat hover) menghapus. Komponen UI bersama dengan QA Module: `AttachmentSection`. Sebelum versi 3.11 lampiran bug hanya berupa gambar. Lampiran lama tetap utuh
- **Tracking tanggal** — tiap bug menampilkan **Tanggal Incident** (tanggal bug dibuat/dilaporkan), **Tanggal Closed** (otomatis terisi begitu stage masuk Stage ber-flag *selesai* — bawaan `done` — otomatis kosong lagi kalau stage dipindah ke Stage yang bukan selesai), dan **Update Terakhir** (tanggal + nama user dari entry Progress paling baru, kosong kalau belum pernah ada update progress)
- **Filter & pencarian** — cari berdasarkan judul/kode; filter multi-select stage, severity, prioritas, dan assignee (assignee bisa diketik untuk mencari nama — lihat pola `SearchableMultiSelect` di 3.2); filter produk di level halaman (memuat ulang data dari server). Toggle **"Sembunyikan Closed/Done"** aktif secara default sehingga bug yang sudah selesai (Stage ber-flag *selesai*, bawaan `done`) tidak memenuhi list — klik untuk menampilkannya kembali; filter ini independen dari filter multi-select Stage. Export hasil filter ke CSV (mengikuti urutan sort yang aktif)
- **Sort kolom** — klik header kolom Severity, Prioritas, Stage, Deadline, Tanggal Incident, Tanggal Closed, atau Update Terakhir untuk mengurutkan. Klik pertama: arah default kolom tsb (Severity/Prioritas dari Critical, Stage sesuai alur kerja Open→Done, Deadline dari yang **paling dekat**, tanggal lain dari yang terbaru); klik kedua: kebalikannya; klik ketiga: kembali ke urutan asli. Baris tanpa nilai (mis. bug yang belum closed atau tanpa deadline) selalu ditampilkan paling bawah
- **Import CSV** — tombol **Import CSV** di tab Bugs (sebelah Export CSV) untuk bikin bug secara massal dari file CSV. Format kolom persis sama dengan hasil **Export CSV** di atas, jadi cara pakai paling umum adalah round-trip: export → edit di Excel → import balik. **Catatan cara save di Excel:** pakai **File → Save As → "CSV UTF-8 (Comma delimited) (*.csv)"**, bukan opsi "CSV (Comma delimited)" polos — opsi terakhir itu defaultnya nulis ulang file pakai ANSI/Windows-1252, bukan UTF-8, meskipun ekstensinya tetap `.csv`. Kalau kepakai encoding yang salah, import tetap jalan normal, cuma karakter non-standar (nama dengan diakritik, dsb) di kolom terkait bisa tampil berantakan — bukan gagal total atau data hilang. Excel versi lama yang tidak punya opsi "CSV UTF-8" bisa pakai Google Sheets (**File → Download → Comma Separated Values**, selalu UTF-8) atau Notepad untuk perubahan kecil. Kolom `Produk` di-resolve **per baris** (satu file boleh berisi bug dari beberapa produk sekaligus, bukan satu produk per upload). Kolom `Kode` kosong → kode digenerate otomatis (mengikuti pola kode produk yang berjalan, sama seperti create manual); kode yang sudah ada **di produk yang sama** → baris tsb di-skip, bukan ditimpa (create-only, tidak ada mode upsert). Kolom `Assigned To`/`Reported By` dicocokkan ke akun user lewat nama/email — khusus `Reported By` yang tidak cocok akun manapun, teksnya tetap disimpan sebagai pelapor (pola sama seperti tiket dari Lapor Bug Publik, 3.15) alih-alih hilang begitu saja. Kolom `Tanggal Incident`/`Tanggal Closed` dipakai kalau terisi & formatnya valid — penting untuk migrasi data bug historis, bukan cuma tanggal saat file di-upload. Baris dengan produk yang tidak ditemukan dicatat di daftar error (bukan gagal diam-diam), baris lain di file yang sama tetap lanjut diproses. Hasil akhir (jumlah dibuat/di-skip/error, plus detail tiap error) ditampilkan di modal setelah proses selesai. Tidak ada notifikasi/email yang dikirim untuk bug hasil import (sama seperti Import Jira, 3.11) — menghindari spam notifikasi untuk migrasi data massal. **Akses:** sama seperti modul Bugs Incident (permission `access_bugs`), beda dari Import Jira (3.11) yang gate-nya PO/Manager/Admin

- **Feature (opsional)** — bug bisa dikaitkan ke satu **Feature produk** (tabel `features`, kode seperti `BMTFT-1`; bukan feature roadmap). Perilaku dropdown, format opsi `[KODE_PRODUK] KODE_FEATURE · Nama`, penyaringan per produk, validasi backend, dan efek hapus feature sama persis dengan QA Module (lihat 3.8). Tabel Bugs punya kolom **Features** (setelah *Item*), dan **Export CSV** memuat kolom `Features`. **Import CSV** menerima kolom opsional `Features` (`[KODE] Nama` atau kode saja, dicocokkan di dalam produk baris tsb; kosong/tidak ditemukan → feature dibiarkan kosong, bukan error). Form Lapor Bug Publik (3.15) tidak berubah — pelapor eksternal tidak memilih feature
- **Type (opsional)** — tiap tiket punya **Type** yang **daftarnya bisa diatur** (sejak 3.23). Bawaan: `bug` (default), `inquiry` (**Inquiry / Clarification** — laporan yang kurang jelas dan perlu klarifikasi sebelum bisa diperlakukan sebagai bug), dan `improvement` (**Improvement** — usulan perbaikan; pemicu tombol **Buat Backlog**, lihat di bawah; ditambahkan `migration_v32.sql` bila belum ada). **Hanya Super Admin** (`settings.update`) yang bisa menambah, mengganti nama/warna/urutan, dan menghapus Type lewat halaman **Admin → Bug Types** (`/settings/bug-types`, juga tombol **Atur Type** di tab Bugs); user lain hanya memilih Type di form dan filter — butuh Type baru → minta Super Admin. Tiap Type punya `code` (slug otomatis dari nama, **tidak pernah berubah**, itulah yang disimpan di `bugs.type`), `name`, `color`, `sort_order`. Mengganti nama tidak mengubah tiket; Type yang masih dipakai tiket **tidak bisa dihapus** (`409`, "pindahkan tiket dulu") dan Type bawaan `bug` serta `improvement` tidak bisa dihapus sama sekali (`bug` dipakai sebagai default dan oleh Lapor Bug Publik, `improvement` oleh tombol Buat Backlog) — namanya boleh diganti. Type **terpisah dari stage** (stage `improvement` = masukan/ide, tidak terkait Type). Form Buat/Edit Bug punya dropdown **Type (opsional)** (default Bug, di sebelah Stage Awal); tabel Bugs punya kolom **Type** (badge, setelah *Judul*) dan filter multi-select **Type**. **Export CSV** memuat kolom `Type` (nilai `code`); **Import CSV** menerima kolom opsional `Type`/`Tipe` berisi `code` atau nama Type (tidak peka huruf besar; label lama `Inquiry / Clarification` tetap dikenali; kosong/tidak dikenal → `bug`). Backend menolak (`400`) Type yang tidak terdaftar; **Edit** yang tidak mengirim `type` tidak mengubah Type yang tersimpan. Bug lama otomatis `bug`. Form Lapor Bug Publik (3.15) tidak berubah — tiket dari sana selalu `bug` (pilihan Bug/Improvement di form itu mengatur stage, bukan Type)
- **Stage yang bisa diatur** (sejak 3.25) — daftar Stage tidak lagi tetap. **6 Stage bawaan** (`open`, `in_progress`, `ready_to_test`, `reopen`, `done`, `improvement`) tetap ada, **tidak bisa dihapus**, dan perilakunya terkunci; **hanya Super Admin** (`settings.update`) yang bisa **menambah Stage baru** serta mengganti nama/warna/urutan (Stage bawaan: nama/warna/urutan saja) lewat **Admin → Bug Stages** (`/settings/bug-stages`, juga tombol **Atur Stage** di tab Bugs). Stage membawa perilaku lewat flag: **`is_closed`** (dianggap selesai: mengisi **Tanggal Closed**, ikut disembunyikan oleh "Closed/Done disembunyikan", dihitung di resolution rate; bawaan: `done`), **`not_late`** (Deadline tidak pernah merah; bawaan: `done` dan `ready_to_test`), dan **`counts_open`** (dihitung di kartu **Open** dashboard; bawaan: `open`/`in_progress`/`reopen`, Stage baru: otomatis ya kecuali ber-flag selesai/tidak terlambat). Tiap Stage punya `code` (slug otomatis, **tidak pernah berubah**, disimpan di `bugs.stage`), `name`, `color`, `sort_order`. Stage yang masih dipakai tiket tidak bisa dihapus (`409`). Dropdown stage di tabel, tombol Update Progress, filter Stage, urutan sort kolom Stage, kolom kartu **Bugs per Feature** (di Bugs Dashboard dan QA Dashboard), pie Distribusi Stage, dan Import CSV (kolom `Stage` cocok ke `code` atau nama; tidak dikenal → `open`) semuanya membaca daftar ini. **Stage Awal** di form Buat Bug tetap hanya `open`/`improvement`. Pesan log dan notifikasi perubahan stage kini memakai **nama** Stage, bukan kode.
- **Buat Backlog dari tiket Improvement** (sejak 3.25) — tiket ber-Type `improvement` punya tombol **Buat kartu Backlog** di kolom Aksi tabel Bugs **dan** tombol **Buat Backlog** di header modal Edit Bug (di kiri **Salin link**, juga saat modal dibuka dari link notifikasi/Ctrl K); keduanya hanya untuk user dengan `bugs.access` **dan** `backlog.create`. Tombol di header memakai data bug yang **sudah tersimpan**, jadi bila form berubah dan belum disimpan, user diminta menyimpan dulu; setelah berhasil modal ditutup dan daftar dimuat ulang. Satu klik (dengan konfirmasi) membuat kartu Backlog lewat alur create Backlog yang sama (kode otomatis, log aktivitas, notifikasi + Teams ke assignee): tipe **story**, status **backlog**, tanpa sprint; **judul, prioritas, semua assignee, deadline, dan lampiran disalin** (tiap lampiran mendapat file fisik sendiri, jadi menghapus lampiran di satu sisi tidak merusak sisi lain; lampiran yang filenya hilang dari disk dilewati tanpa menggagalkan konversi); **pelapor asli** ("Dilaporkan oleh: nama", atau nama + email untuk pelapor publik), deskripsi, langkah reproduksi, Feature bug (tabel `features`, tidak bisa ditautkan langsung ke Impacted Features Backlog yang memakai roadmap), dan Backlog item terkait dituliskan di **notes** beserta kode bug asal. **Bug tetap ada** dan stage-nya tidak berubah; hasilnya dicatat di `bugs.converted_backlog_id`, sehingga **hanya bisa dikonversi sekali** (`409`; konversi ganda serentak dijaga: yang kalah kartunya dihapus). Setelah dikonversi, tombol berganti penanda hijau (di header modal: "Di Backlog: PB-xxx" yang menaut ke kartu); menekannya membuka dialog "Bug ini sudah dibuat di Backlog sebagai PB-xxx" dengan tautan ke kartu, dan form Edit Bug menampilkan banner yang sama. Log aktivitas tercatat di bug dan di kartu. Kalau kartunya dihapus, bug boleh dikonversi lagi.
- **Deadline (opsional)** — form Buat/Edit Bug punya input tanggal **Deadline (opsional)** di sebelah **Assigned To** (keduanya kini setengah lebar, sama seperti form Backlog 3.2); dikosongkan = tanpa deadline. Tabel Bugs punya kolom **Deadline** (setelah *Stage*, format `17 Nov 2026`, `—` kalau kosong) yang bisa di-sort (lihat Sort kolom). Tanggal jadi **merah dengan ikon peringatan** (tooltip "Lewat deadline") begitu hari deadline sudah lewat **dan stage bukan `done` atau `ready_to_test`** — bug Done dan bug Ready to Test (padanan In Review di Bugs: perbaikan selesai, menunggu QA, lihat 3.2) tidak pernah merah. Hari H deadline belum merah (beda dari Backlog 3.2 yang sudah merah di hari H). Lewat/tidaknya dihitung di browser dengan tanggal lokal pengguna, sama seperti QA Module (3.8). **Export CSV** memuat kolom `Deadline` (`yyyy-MM-dd`, setelah `Stage`); **Import CSV belum membaca** kolom ini. Form Lapor Bug Publik (3.15) tidak berubah — tiket dari sana tanpa deadline. Mengganti stage (Update Progress / dropdown Stage) tidak mengubah deadline. Kolom `bugs.deadline` (`DATE`, nullable, `migration_v29.sql`); validasi `400` dan perilaku Edit tanpa field `deadline` sama dengan QA Module (3.8). Belum ada filter, notifikasi pengingat, atau hitungan "terlambat" di Bugs Dashboard untuk deadline
- **Daftar produk di sidebar & pagination** — saat berada di Bugs Incident, sidebar menampilkan daftar produk dan klik produk memfilter lewat `/bugs?product=ID` (sinkron dengan dropdown produk di halaman). Tabel **Bugs** dan **Progress** memakai pilihan baris per halaman **10 / 30 / 50 / 100** (default 10), berubah langsung, dan otomatis pindah ke halaman terakhir yang berisi data kalau halaman aktif melewati batas setelah filter berubah — pola sama seperti QA Module (3.8). Pagination dilakukan di frontend atas data yang sudah dimuat penuh
- Menghapus komentar di modal Edit Bug tidak menutup modal (tombol hapus bertipe `button`, bukan `submit`)

**Stage bug** (dicatat sebagai histori di Progress, nilai stage terkini disimpan juga di data Bug untuk filter/tampilan cepat):

| Stage | Arti |
|---|---|
| `open` | Bug baru dilaporkan, belum dikerjakan |
| `in_progress` | Sedang diperbaiki developer |
| `ready_to_test` | Developer sudah selesai memperbaiki, siap diretest QA |
| `reopen` | Hasil retest QA gagal — bug dibuka kembali untuk diperbaiki ulang. Dihitung sebagai bug "open" di ringkasan dashboard |
| `done` | Bug selesai — baik setelah diverifikasi QA, maupun ditutup tanpa fix (duplicate/won't-fix/tidak bisa direproduksi) |
| `improvement` | Bukan bug — masukan/ide perbaikan yang ditemukan di produk. Bisa dipilih langsung saat membuat tiket (form **Buat Bug** → *Stage Awal*, atau pilihan *Jenis Laporan* di form publik `/report-bug`) dan bisa dipindah ke stage lain kapan saja. Hanya stage biasa: tidak masuk hitungan "open" maupun "ready to test" di dashboard, tapi tetap dihitung di Total Bugs dan Distribusi Stage |

**Stage tambahan (sejak 3.25):** selain 6 Stage di atas (bawaan — tidak bisa dihapus, perilakunya terkunci), Super Admin bisa menambah Stage lain lewat **Admin → Bug Stages**; Stage tambahan memilih sendiri perilakunya lewat dua centang *Dianggap selesai (Closed)* dan *Tidak dihitung terlambat*. Lihat bullet **Stage yang bisa diatur** di atas.

**Ganti stage cepat dari tabel:** kolom **Stage** di tabel Bugs berupa dropdown (pola sama seperti status/sprint di Backlog) — pilih stage baru langsung tanpa membuka modal. Memakai endpoint `POST /api/bugs/progress` yang sama dengan tombol Update Progress, jadi histori Progress, log aktivitas, `closed_at`, dan notifikasi assignee tetap konsisten (tanpa catatan; untuk catatan pakai Update Progress). Dropdown aktif bagi user dengan permission `bugs.access`.

**Catatan implementasi:** Kode bug auto-generate berbasis kode produk (`{KODE_PRODUK}-001`, `{KODE_PRODUK}-002`, ...) — bukan `BUG-001` seperti sebelumnya, pola sama seperti kode Backlog Item. Stage hanya bisa diubah lewat aksi "Update Progress" (menambah entry baru di histori) — form Edit Bug sendiri tidak punya field stage. Tidak ada validasi transisi stage di backend maupun frontend — semua Stage terdaftar (termasuk `reopen` dan Stage tambahan) bisa dipilih kapan pun terlepas dari stage bug saat ini. `closed_at` di-set/di-clear otomatis oleh backend setiap kali stage berubah (masuk Stage ber-flag *selesai*, bawaan `done` → terisi; pindah ke Stage lain termasuk `reopen` → otomatis kosong lagi, bukan field yang bisa diisi manual). Sort kolom, grafik tren Dibuka vs Ditutup, dan toggle Sembunyikan Closed/Done dihitung **di frontend** (client-side) dari data bug yang sudah dimuat penuh per filter produk — bukan lewat parameter/endpoint backend baru, karena list bug memang tidak dipaginasi di server. Konsekuensinya: semuanya selalu mencerminkan data terkini pada saat halaman dimuat/direfresh, tapi tidak live-update sendiri selama tab dibiarkan terbuka (sama seperti data lain di halaman ini — tidak ada polling/websocket di aplikasi ini).

---

### 3.10 Users & Roles (Admin only)

**Tujuan:** Manajemen akun dan hak akses. Terdiri dari 3 tab: **Users**, **Roles & Permissions**, **Departemen**.

**Tab Users — Fitur:**
- CRUD user (nama, email, role, warna avatar, status aktif)
- Assign/ubah role
- **Reset password** user oleh admin (tanpa perlu password lama)
- Lihat dan kelola daftar produk yang di-assign ke user
- **Soft delete** (`is_active = false`) — user tidak bisa login tapi data tetap ada
- **Permanent delete** — hapus user beserta seluruh data terkait dari database (tidak bisa dibatalkan)
- Aksi Buat/Ubah/Reset Password/Nonaktifkan/Hapus masing-masing digerbang aksi terpisah di tab Roles & Permissions (lihat di bawah) — bukan satu permission tunggal, supaya asimetri lama (mis. role yang bisa Edit profil user tapi tidak boleh Reset Password) bisa tetap diatur per aksi

**Tab Roles & Permissions — Fitur:**
- **Role dibuat bebas** — bukan daftar tetap di kode. Tombol "Tambah Role" membuka form: nama (slug, tidak bisa diubah setelah dibuat), display name, dan tabel hak akses
- **Matrix Modul × Aksi** — satu baris per modul (Backlog, Epic, Features, Products, Roadmap, Sprint, QA, Bugs Incident, C-Level Dashboard, Client Management, Export MD, Standup, Import Jira, Users, Roles, Departemen, Pengaturan), tiap baris cuma menampilkan checkbox untuk aksi yang benar-benar relevan untuk modul itu (bukan grid 5 kolom seragam untuk semua modul — mis. modul Bugs Incident cuma punya 1 aksi "Akses", modul Users punya 5: Buat/Ubah/Reset Password/Nonaktifkan/Hapus)
- Role **`super_admin`** checkbox-nya di-disable (selalu akses penuh lewat bypass hardcode, bukan dari matrix — supaya tidak ada skenario Super Admin terkunci sendiri dari sistem akibat salah klik)
- Perubahan tersimpan langsung berefek nyata di frontend (tombol/menu muncul-hilang) **dan** backend (`403` kalau dipanggil API langsung tanpa aksi yang sesuai) — satu sumber kebenaran untuk keduanya
- List role menampilkan badge per modul yang dapat aksi (mis. "Backlog: Buat, Ubah, Hapus")
- Hapus role diblokir kalau masih ada user yang pakai role tsb

**Model data:** `roles.permissions` (JSONB) berbentuk nested `{"modul": {"aksi": true}}`, mis. `{"qa": {"create": true, "run": true}}`. Backend menegakkan lewat `PermissionHelper.can(principal, module, action)`, frontend lewat `useAuth().can(module, action)` — tidak ada lagi floor role hardcode di kode untuk modul-modul ini (lihat Riwayat Perubahan untuk detail migrasi dari model permission lama).

**Tab Departemen — Fitur:**
- CRUD departemen (kode, nama, prefix kode task, warna, urutan tampil) — dipakai untuk scope C-Level Dashboard (3.10), bukan bagian dari matrix Modul × Aksi (tidak ada "aksi" untuk Departemen sebagai record, cuma CRUD data referensi)
- Atur anggota per departemen (menentukan Leader Notes/Task mana yang terlihat untuk user tsb)

**Akses:** Aksi Buat/Ubah user digerbang aksi `users.create`/`users.update` (default: Super Admin, Manager). Reset Password/Nonaktifkan/Hapus user, dan semua aksi di tab Roles & Permissions + Departemen, default-nya cuma Super Admin — role lain bisa diberi akses ini lewat matrix Modul × Aksi itu sendiri.

---

### 3.11 Import Jira (PO/Manager/Admin)

**Tujuan:** Migrasi data dari Jira ke Product Tracker.

**Fitur:**
- Upload file CSV export dari Jira
- Mapping kolom Jira ke format Product Tracker
- Preview hasil mapping sebelum import
- Laporan hasil import
- ⚠️ **Diketahui (17 Nov 2026, belum diperbaiki):** import hanya mengisi kolom assignee lama `backlog_items.assignee_id` dan tidak menulis ke `backlog_item_assignees` (sumber assignee sejak `migration_v19.sql`). Akibatnya kartu hasil import tampil tanpa assignee di Backlog, tidak muncul di My Tasks milik assignee-nya, dan tidak ikut filter Assignee. Export MD (3.6) tetap mencantumkan assignee-nya

---

### 3.12 Profil & Keamanan Akun

**Tujuan:** Memungkinkan user mengelola akun mereka sendiri.

**Edit Profil:**
- Ubah nama tampilan
- Ubah email (sistem mencegah duplikat email)
- Pilih warna avatar dari 15 pilihan warna
- Perubahan langsung ter-reflect di header dan sidebar tanpa refresh

**Ubah Password:**
- Verifikasi password saat ini sebelum bisa mengganti
- Password baru minimal 6 karakter
- Konfirmasi password baru
- Toggle show/hide untuk semua field password

---

### 3.13 Notifikasi

**Tujuan:** Memberitahu user tentang perubahan yang relevan, lewat tiga jalur: bell in-app, email personal, dan (opsional) channel Microsoft Teams.

**Notifikasi In-App (Bell):**
- Bell notifikasi di header, dengan badge jumlah belum dibaca
- Dipicu saat: item di-assign ke user (Backlog, Bugs Incident, Leader Task), status/stage item berubah (Bugs Incident), atau user di-mention di komentar (Backlog, Bugs Incident)
- Tandai satu/semua sebagai dibaca

**Notifikasi Email:**
- Email personal ke `users.email` milik user yang relevan (assignee, atau yang di-mention) — **bukan** broadcast ke satu alamat tetap
- Trigger: assignment & update (Backlog), status berubah (Backlog — jalur email saja, tidak ada notifikasi bell untuk event ini), assignment & stage berubah (Bugs Incident), assignment (Leader Task), mention di komentar (Backlog & Bugs Incident, format `@[Nama]`)
- User yang melakukan aksi terhadap item miliknya sendiri (mis. assignee mengubah status task yang di-assign ke dirinya sendiri) tidak menerima email untuk aksi tsb
- Pengiriman asynchronous & best-effort — kegagalan kirim tidak pernah menggagalkan request API yang memicunya, dicatat di backend log
- **Global, dikontrol Super Admin** — bukan preferensi per-user. Selama fitur dinyalakan Super Admin (lihat 3.14), semua user otomatis menerima email untuk event yang relevan buat mereka; user biasa tidak punya kontrol/preferensi individual atas fitur ini
- Isi email: heading ringkas + tabel detail (modul, judul, perubahan, siapa yang melakukan) + tombol link balik ke item terkait di aplikasi

**Microsoft Teams Webhook (opsional):**
- Satu webhook channel global (bukan per-user), dikonfigurasi lewat env var `TEAMS_WEBHOOK_URL`
- Trigger: item Backlog dibuat, diupdate, atau status berubah — modul lain (Bugs Incident, Leader Task) belum terhubung ke Teams

---

### 3.14 Notification Settings (Admin only)

**Tujuan:** Memberi Super Admin kontrol penuh atas fitur Notifikasi Email (3.13) langsung dari aplikasi — tanpa perlu edit file konfigurasi server atau restart aplikasi.

**Akses:** Halaman ini (`/settings/notifications`) hanya muncul di sidebar dan hanya bisa diakses untuk role **Super Admin** — dijaga di frontend (item menu disembunyikan untuk role lain) maupun backend (setiap endpoint API menolak dengan `403` untuk role selain Super Admin).

**Fitur:**
- Toggle nyala/mati fitur notifikasi email secara keseluruhan
- Form konfigurasi SMTP: Host, Port, Username, Password, From Address, SMTP Auth, STARTTLS
- Password tidak pernah ditampilkan balik setelah disimpan (field kosong saat submit ulang = tidak diubah)
- **Kirim Email Tes** — kirim satu email percobaan ke alamat manapun, hasil sukses/gagal (termasuk pesan error dari server SMTP, mis. autentikasi ditolak) ditampilkan langsung di halaman
- Perubahan config **langsung aktif tanpa restart backend** — disimpan ke tabel `app_settings`, dibaca ulang setiap kali ada email yang mau dikirim

**Catatan implementasi:** Sebelum halaman ini pernah dibuka/disimpan, sistem fallback ke nilai env var lama (`MAIL_HOST`, `MAIL_PORT`, dst. — lihat Bagian 8) — jadi deployment yang belum pernah menyentuh halaman ini tetap berjalan seperti semula, tidak ada breaking change.

---

### 3.15 Lapor Bug Publik (Landing Page Ticketing)

**Tujuan:** Membuka pelaporan bug/insiden ke **seluruh karyawan kantor**, bukan cuma tim internal yang punya akun Product Tracker — misalnya orang Accounting yang menemukan bug di aplikasi accounting mereka. Tiket yang masuk lewat sini langsung jadi data yang sama dengan modul Bugs Incident (3.9), bukan sistem terpisah/staging.

**Akses:** Halaman `/report-bug` dan tiga endpoint pendukungnya (`GET /api/public/products`, `POST /api/public/bugs`, `POST /api/public/bugs/:id/attachments`) **tidak memerlukan login sama sekali** — satu-satunya bagian dari aplikasi yang bisa diakses tanpa JWT selain halaman Login itu sendiri. Ini disengaja: fitur ditujukan untuk siapa pun di jaringan kantor yang sama, bukan cuma user terdaftar. Lihat Bagian 7 (Keamanan) untuk batasan/asumsi trust model-nya.

**Fitur:**
- Form berisi: pilih aplikasi/produk (dropdown), **jenis laporan** (*Bug / Masalah* atau *Improvement / Masukan Ide*, default Bug), nama pelapor, email pelapor, judul bug, deskripsi, langkah reproduksi, tingkat keparahan (severity), dan lampiran screenshot opsional (image only, maks 10MB — sama seperti lampiran Bugs Incident biasa)
- **Jenis laporan menentukan stage awal** — *Bug* → stage `open`, *Improvement* → stage `improvement` (nilai lain dari `report_type` diabaikan dan jatuh ke `open`). Notifikasi ke Product Owner ikut menyebut "Improvement publik baru" untuk jenis ini
- **Tidak ada field Prioritas** — pelapor publik tidak diminta menilai prioritas, backend selalu set `medium`, tim internal yang menentukan ulang saat triase
- **Assignment otomatis** — begitu pelapor pilih produk, tiket langsung di-assign ke Product Owner produk tsb (`products.owner_id`). Kalau produk belum punya owner, tiket tetap dibuat tapi tidak ter-assign ke siapa pun (tidak ada notifikasi terkirim) — Admin/QA meng-assign manual belakangan dari Bugs Incident seperti biasa
- **Identitas pelapor bukan akun** — nama & email pelapor disimpan sebagai teks bebas (kolom `bugs.reporter_name`/`reporter_email`), bukan referensi ke tabel `users`. Kolom `reported_by` (yang biasanya diisi user login) dibiarkan `NULL` untuk tiket dari jalur ini
- Setelah submit, pelapor melihat konfirmasi berisi kode tiket (mis. `DEMO-011`) — tidak ada redirect ke halaman lain, karena pelapor memang bukan user yang bisa masuk ke area manapun di aplikasi
- Di tabel Bugs (3.9), kolom **Incident Author** untuk tiket dari jalur ini menampilkan `reporter_name`/`reporter_email` sebagai fallback (karena `reported_by_name` kosong) — tim internal tetap bisa tahu siapa pelapornya meski bukan user terdaftar
- Notifikasi assignment (bell + email, lihat 3.13) tetap terpicu normal ke Product Owner yang ke-assign, dengan atribusi **"System (Laporan Publik)"** sebagai pihak yang melakukan assignment (bukan nama pelapor) — karena assignment-nya otomatis oleh sistem, bukan tindakan manual pelapor

**Catatan implementasi:** Kode bug (`{KODE_PRODUK}-NNN`) di-generate dengan logika yang sama persis seperti `POST /api/bugs` biasa. Lampiran screenshot dari jalur publik hanya bisa diunggah ke tiket yang juga dibuat lewat jalur publik (`bugs.reported_by IS NULL`) — endpoint `POST /api/public/bugs/:id/attachments` menolak dengan `403` kalau `:id` menunjuk ke tiket internal, supaya pengunjung anonim tidak bisa menambah lampiran ke tiket siapa pun dengan menebak-nebak ID. Produk yang ditampilkan di dropdown hanya yang berstatus `active`.

---

### 3.16 Antarmuka & Navigasi (UI Revamp)

**Tujuan:** Penyegaran tampilan ala ClickUp dengan palet merah/putih/hitam. **Hanya perubahan UI** — semua fitur, field, endpoint, dan hak akses modul lain tetap sama seperti versi sebelumnya (diverifikasi lewat audit paritas, lihat `TESTING_UI_REVAMP.md`).

**Fitur:**
- **App shell** — **bingkai abu terang ala ClickUp** (sejak 3.28; sebelumnya top bar hitam): top bar dan **icon rail setinggi layar** dengan logo PTAP di pojok atas, sidebar per section dan area kerja putih; di mode gelap bingkai hampir hitam. Sidebar per section bisa disembunyikan/ditampilkan; di HP rail ikut masuk ke drawer. Warna bingkai memakai variabel CSS (`--frame`, `--frame-2`, `--frame-3`, `--frame-ink`, `--frame-ink-2`, `--side` di `index.css`; warna `frame`/`side` di Tailwind) yang diganti tema, bukan hex tetap. Breadcrumb memakai judul halaman asli. Status sidebar (`pt_sidebar_collapsed`) dan tema (`pt_theme`) disimpan per browser di `localStorage`, bukan di akun user
- **Tema terang/gelap** — toggle tema di top bar (sejak 3.28): pil 60×30 dengan **ikon matahari dan bulan selalu terlihat**, track **amber** di mode terang dan **biru** di mode gelap, knob hitam; tooltip menyebut aksi berikutnya ("Ganti ke mode gelap/terang"). Warna lewat variabel CSS sehingga grafik dan komponen ikut berganti
- **Aksen merah** (sejak 3.28) — merah brand menandai elemen yang aktif: garis bawah **tab aktif** (Backlog, Products, QA, Standup, Users, Bugs, C-Level, My Task), **bar progress** (tetap hijau saat 100%), dan **menu aktif** di sidebar per section (latar merah muda + batang merah tipis). Sengaja tidak diubah: bar kapasitas di Dashboard (hijau/kuning/merah menurut beban kerja) serta status, badge, dan prioritas — merah tetap berarti masalah/bug
- **Backlog** — tombol **Group: Status** berada di baris tab List/Board (di sebelah Import Jira / Tambah Item; sebelumnya di baris filter yang melipat sehingga tombol terdampar sendiri). Tampilan **List** dikelompokkan per status (kolom Kode + Tipe digabung jadi satu kolom **Item**) dan tampilan **Board**; status/prioritas/sprint diubah lewat menu pill (status pill, bendera prioritas); klik baris membuka detail
- **Command palette (Ctrl/⌘ K)** — satu pencarian untuk seluruh aplikasi, semuanya mengikuti permission role: (1) **Halaman** yang boleh dibuka user; (2) **Aksi** "… baru" (Backlog, Bug, Test Case, Sprint, Produk, Epic, Roadmap, Leader Task, User, Role, Departemen, serta Feature/Epic produk per produk) yang hanya muncul bila role punya izin buat; (3) **Record** — Backlog item, Bug, Test Case, Sprint, Produk, Epic, Feature, Roadmap, Leader Task, User, Role, Departemen — dicari lewat kode/judul/nama (minimal 2 karakter). Backlog dan Leader Task dicari di server (`search`), daftar kecil lainnya dimuat sekali per pembukaan palette lalu disaring di browser. Grup hasil yang tidak boleh diakses role tidak pernah diminta ke server (mis. Bug tanpa `bugs.access`, User/Role/Departemen tanpa `users.update`, Leader Task tanpa `c_level.access`). Hasil membuka form/detail langsung lewat deep link satu-kali yang dibaca lalu dihapus dari URL oleh halaman tujuan: `/backlog?item=ID`, `/bugs?bug=ID`, `/qa?case=ID`, `/sprints?sprint=ID&product=ID`, `/products?product|epic|feature|roadmap=ID`, `/users?user|role|department=ID`, `/c-level?task=ID`, dan `?new=…` untuk aksi baru. Bila role boleh melihat tapi tidak boleh mengubah record, user hanya diarahkan ke halaman/tab-nya tanpa form. Test run tidak ikut dicari karena tidak punya tampilan detail sendiri
- **Daftar produk di sidebar** — di Backlog (`/backlog?product=ID`), QA Module (`/qa?product=ID`), dan Bugs Incident (`/bugs?product=ID`) sidebar menampilkan daftar produk sebagai shortcut filter. Produk aktif ditandai; klik menu halamannya (tanpa produk) menghapus filter. Filter berada di parameter URL `product` sehingga bisa di-bookmark dan sinkron dengan dropdown produk di halaman
- **Status presence (online / away / offline)** — titik status di avatar (top bar, menu akun, AssigneeStack, Users, Team Workload, User Occupation, saran @mention). Tiap tab yang terbuka mengirim heartbeat ±30 detik dengan state `online` (tab terlihat, ada aktivitas < 5 menit) atau `away` (tab tersembunyi/diam). Status dihitung saat dibaca sehingga beberapa tab tidak saling menimpa: **online** = aktif ≤ 75 detik, **offline** = tanpa heartbeat > 150 detik atau sudah logout, selain itu **away**. Logout langsung mengirim offline

**Catatan implementasi:** Presence disimpan di tabel terpisah `user_presence` (`migration_v22.sql`) — bukan kolom di `users` — karena trigger `BEFORE UPDATE` di `users` akan mengubah `updated_at` setiap heartbeat. Klien memakai `fetch` sendiri (tanpa toast/redirect interceptor axios) supaya galat heartbeat tidak mengganggu user. Pilihan baris per halaman tiap halaman berdiri sendiri (state lokal, tidak dibagi lintas halaman dan tidak disimpan di browser): Backlog 10/30/50/100 (default 30), QA & Bugs 10/30/50/100 (default 10); Standup dan Users 10/50/100; My Tasks 10/20/50.

---

### 3.17 Client Management

**Tujuan:** Satu tempat untuk mencatat bank/klien yang memakai produk internal beserta kondisi hubungan dan kontraknya (permintaan mentor: riset client management). Menu **Clients → Client List** (`/clients`).

**Fitur:**
- **Tabel client** — kolom Bank, Kota, Status, No Contract, Produk, PIC, Revenue, Start–End kontrak, dan Update Terakhir (catatan terbaru). Baris bisa diklik untuk membuka detail/edit. Pencarian teks (bank, kota, no contract, PIC, isi catatan), filter Produk dan PIC, serta **kartu ringkasan per status** (klik untuk memfilter, angka mengikuti filter lain)
- **Satu baris = satu kontrak.** Satu bank bisa memakai **beberapa produk** (chip produk), tetapi hanya punya satu kontrak per baris; kalau satu bank punya lebih dari satu kontrak, tambahkan baris baru secara manual (nama bank sengaja **tidak unik**). Revenue adalah nilai **per kontrak** dalam Rupiah (boleh kosong untuk client Approaching/Declined yang belum berkontrak). Tanggal akhir tidak boleh sebelum tanggal mulai
- **Status bisa diatur** — Admin → **Client Statuses** (`/settings/clients`, Super Admin): tambah/ubah nama, warna, urutan. Data awal: Approaching, Declined, Active, Sunset, Deactivated. Status yang masih dipakai client **tidak bisa dihapus** (`409` dengan jumlah client yang memakainya). Kode status dibuat otomatis dari nama dan tidak berubah saat nama diganti
- **PIC (tim inhouse)** — satu user. Dropdown berisi user ber-role Product Owner dan owner produk mana pun; **otomatis terisi Product Owner dari produk pertama yang dipilih** selama PIC belum diubah manual (setelah diganti manual, memilih produk tidak menimpanya lagi). Bukan kunci keras: user lain yang sudah menjadi PIC tetap tampil
- **Catatan update** — riwayat catatan per client (siapa, kapan, isi; URL otomatis menjadi link) di bagian bawah modal. Catatan terbaru tampil di kolom Update Terakhir. Menulis catatan butuh aksi `clients.update`; menghapus hanya oleh **penulisnya atau Super Admin**
- **Ctrl K** — halaman Client List, aksi "Client baru", dan pencarian client (nama bank, kota, no contract, PIC) yang membuka modal lewat `/clients?client=ID` atau `/clients?new=1`

**Akses:** modul `clients` di matrix Modul × Aksi (3.10) dengan aksi `access` (melihat modul & catatan), `create`, `update` (ubah client + tulis catatan), `delete`. Default: **Super Admin & Manager** penuh, **Product Owner** `access` + `update`, role lain tidak punya akses (menu tersembunyi, API `403`). Role dengan `access` saja melihat modal dalam mode baca-saja. Pengaturan status memakai `settings.update` (Super Admin), sama seperti Notification Settings.

**Catatan implementasi:** `GET /api/clients/options` mengembalikan **semua** produk (bukan `GET /api/products` yang difilter per user) — editor yang tidak di-assign ke suatu produk tetap melihat daftar lengkap, sehingga menyimpan client tidak diam-diam melepas produk yang tidak terlihat olehnya. `PUT /api/clients/:id` hanya mengganti set produk bila `product_ids` dikirim. `migration_v26.sql` **menggabungkan** modul `clients` ke `roles.permissions` dengan operator `||` (tidak menimpa seperti v21), sehingga edit permission yang sudah dibuat admin tidak hilang. Hapus user permanen tidak gagal karena `clients.pic_id`, `clients.created_by`, dan `client_comments.user_id` berstatus `ON DELETE SET NULL`.

---

### 3.18 Management Dashboard

**Tujuan:** Satu halaman untuk manajemen melihat kondisi **satu produk** dari sprint, fitur, sampai pekerjaan terbuka minggu demi minggu, termasuk riwayat minggu-minggu sebelumnya yang tidak berubah lagi (permintaan mentor, sketsa papan tulis 19 Nov 2026). Menu **Home → Management** (`/management`), paling atas di Home.

**Tata letak:** satu halaman yang di-scroll (bukan tab), dari atas ke bawah. Pilihan produk, sprint, dan minggu tersimpan di URL (`?product=&sprint=&week=`) sehingga tampilan bisa dibagikan sebagai link.
- **Pilih produk** — daftar **Products** di sidebar kiri bagian Home (hanya saat halaman Management terbuka; pola sama dengan Planning → Backlog), atau pilihan **Produk** di header (dropdown + cari; tetap ada untuk sidebar tersembunyi/HP). Dashboard selalu per produk; produk yang tampil ikut tertulis di URL sehingga tersorot di sidebar
- **Header** — pilihan Produk, keterangan "Data per …", tombol muat ulang
- **Sprint Aktif** — pilihan sprint produk itu (nama + tanggal mulai–selesai); default sprint berstatus `active`, atau **"–"** kalau tidak ada. Menampilkan nama, status, rentang tanggal (plus "N hari lagi" / "Lewat N hari dari tanggal selesai"), goal, **Progress** sprint, dan "X dari Y item kerja selesai". Progress = rata-rata berbobot story point atas item kerja di bawah item sprint itu (aturan 3.2)
- **Features** — dari **Products → Features** (3.6). Kolom: No, Feature (kode + nama, link ke Products; keterangan jumlah item Backlog terhubung), Status, **Target** (tanggal `target_date`, merah bila lewat dan fitur belum Done/Released), **Progress %**
  - Progress fitur: status `done` / `released` = 100%. Selain itu rata-rata progress berbobot story point dari **item Backlog yang terhubung** lewat baris roadmap fitur (`product_roadmap.source_feature_id`), baik sebagai *Feature* item maupun salah satu *Impacted Features*. Story yang terhubung dihitung lewat task-task di bawahnya, dan satu task tidak dihitung dua kali. Tanpa item terhubung → "—" (fitur yang bukan roadmap item tidak bisa dihubungkan ke Backlog)
  - Progress mengikuti pekerjaan, bukan status fitur, jadi fitur berstatus *Not Started* bisa sudah punya progress (diputuskan 19 Nov 2026)
- **Open Item · Minggu Ini** — pekerjaan yang **terbuka** selama minggu berjalan **ditambah yang selesai** di minggu itu, dari empat sumber: **Backlog**, **My Task** (task pribadi, 3.3), **QA** (test case), **Bug** (Bugs Incident). Kolom: **Item** (label sumber, kode, judul; link ke modulnya), **PIC**, **Status**, **Deadline**, **Progress**, **PO Remarks**. Chip filter per sumber dengan jumlahnya, plus ringkasan "N terbuka · M selesai minggu ini · K lewat deadline · J lewat ekspektasi". Judul kartu menampilkan nomor minggu, mis. **W47** · 16 – 22 Nov 2026, dan label **Live**
  - Status bisa diubah langsung (dropdown yang sama dengan modulnya) oleh yang memang berhak di modul itu: Backlog (`backlog.update`/`update_assigned`), Bug (`bugs.access`), My Task (pemilik/Super Admin). Status QA = hasil test run terakhir sehingga diubah dengan menjalankan test di QA Module, bukan di sini
  - Di bawah tabel: **Catatan Product Owner** minggu ini (lihat di bawah)
- **Minggu Lalu** — tabel yang sama untuk minggu yang sudah lewat, **baca-saja**, semua item langsung tampil (tanpa chip filter sumber). Default minggu lalu. Pilihan minggu:
  - Chip **Minggu lalu · W46**, **2 minggu lalu · W45**, **3 minggu lalu · W44**, **4 minggu lalu · W43**; minggu yang tidak punya data tersimpan (mis. sebelum pencatatan dimulai) dinonaktifkan dengan keterangan
  - Tombol kalender (gaya Google Calendar) untuk minggu yang lebih lama: grid bulan dengan **nomor minggu** di kiri, klik satu baris minggu. **Bulan dan tahun bisa dipilih langsung** (dropdown; tahun dari awal pencatatan sampai tahun ini) selain tombol panah. Minggu dihitung Senin–Minggu, jadi nomornya nomor minggu ISO (16–22 Nov 2026 = W47). Hanya minggu tersimpan yang bisa diklik; minggu berjalan dan minggu depan abu-abu; nomor minggu **Estimasi** berwarna kuning
  - Minggu yang dibekukan terlambat ditandai **Estimasi** (lihat Pembekuan mingguan). Di bawah tabel: Catatan Product Owner minggu itu
  - Selama belum ada minggu yang selesai sejak pencatatan dimulai, kartu ini kosong dengan keterangan "Pencatatan mingguan dimulai W47 (16 – 22 Nov 2026); minggu sebelumnya tidak dicatat". Chip minggu dan tombol kalender baru muncul setelah minggu pertama tersimpan (Senin berikutnya 00:00 WIB; untuk pemasangan 19 Nov 2026: Senin 23 Nov 2026, W47 menjadi "Minggu lalu")

**PO Remarks** (kolom terakhir di kedua tabel): **ekspektasi tanggal selesai** dari Product Owner plus keterangan pendek opsional (maks 300 karakter), mis. "27 Nov 2026 · menunggu API vendor". Diisi **manual**, bukan dihitung.
- Diisi dengan klik sel di tabel **Minggu Ini** (popover: tanggal, keterangan, Simpan/Hapus). Remark disimpan **per item per minggu**
- Remark **ikut ke minggu berikutnya** selama belum diganti, ditandai "dari W46"; mengubahnya di minggu ini membuat remark baru untuk minggu ini, remark minggu sebelumnya tidak berubah. Jadi minggu lalu tetap menunjukkan ekspektasi saat itu (remark minggu lalu tidak bisa diubah)
- Tanggal ekspektasi **merah + "lewat"** bila sudah lewat (minggu berjalan: sebelum hari ini; minggu lalu: sebelum Senin sesudahnya) dan item belum selesai; jumlahnya tampil di ringkasan sebagai "lewat ekspektasi"
- Tooltip menunjukkan siapa yang mengisi dan kapan

**Catatan Product Owner** (di bawah tabel, kedua kartu): satu catatan teks per produk per minggu untuk menjelaskan item yang lewat deadline atau tidak selesai sesuai ekspektasi, penyebabnya, dan langkah selanjutnya (maks 5000 karakter, link bisa diklik). Catatan **tersimpan bersama minggunya**: membuka minggu lama menampilkan catatan minggu itu. Catatan minggu yang sudah lewat **masih bisa diubah** (evaluasi sering ditulis hari Senin), dengan keterangan "Terakhir diubah oleh … · tanggal". Mengosongkan isi = menghapus catatan.

**Siapa yang mengisi PO Remarks & catatan:** **Owner** produk itu (field Owner di Products), **Manager**, dan **Super Admin**. Yang lain (mis. Commissioner, PO produk lain) hanya melihat.

**Aturan isi Open Item:**
- **Minggu** = Senin 00:00 sampai Senin berikutnya 00:00 **WIB** (`app.management.week-zone`, default `Asia/Jakarta`); database berjalan di UTC
- **Backlog:** semua tipe kecuali `epic`; status `backlog` (belum direncanakan) tidak ikut. Item Done hanya muncul di minggu ia menjadi Done (ditandai **Selesai**). Task diletakkan menjorok di bawah story-nya bila story itu juga tampil. PIC = assignee (primary lebih dulu). Progress aturan 3.2
- **My Task:** semua task pribadi produk itu; Done hanya di minggu selesai. PIC = pemilik
- **QA:** test case kecuali yang `deprecated`. Status = hasil run terakhir (`pass`/`fail`/`blocked`/`pending`/`skip`) atau **Belum Dijalankan**; selesai = Pass, dan hanya muncul di minggu Pass itu. PIC = tester run terakhir, atau pembuat test case bila belum pernah di-run. Progress aturan 3.8. Test case Draft diberi tanda `draft`
- **Bug:** semua tiket kecuali yang sudah dijadikan item Backlog lewat **Buat Backlog** (item Backlog-nya yang tampil, supaya tidak dobel). Selesai = Stage ber-flag *selesai* (3.9), hanya muncul di minggu ditutup. PIC = assignee. Progress "—"
- **Terlambat:** deadline lewat (minggu berjalan: sebelum hari ini; minggu lalu: sebelum akhir minggu itu), kecuali item sudah selesai, berstatus In Review (Backlog/My Task), atau Stage bug ber-flag *tidak terlambat*

**Pembekuan mingguan:** begitu minggu berganti, isi minggu yang baru lewat **dibekukan** (disalin ke `weekly_snapshots` + `weekly_snapshot_items`) dan tidak berubah lagi walau item aslinya diubah/dihapus.
- **Pencatatan dimulai minggu fitur ini dipasang** (diputuskan mentor 19 Nov 2026): saat backend pertama kali jalan, Senin minggu berjalan disimpan di `app_settings` (`management.tracking_start`). Minggu sebelum itu **tidak dibekukan dan tidak diestimasi** — dibiarkan kosong. Untuk memindahkannya, ubah baris `app_settings` tersebut
- Backend mengecek **saat start dan setiap jam** (menit ke-5); minggu yang belum tersimpan di antara **4 minggu terakhir** (tidak sebelum awal pencatatan) langsung dibekukan
- **Status & progress** dihitung **per akhir minggu itu** dari riwayat (`backlog_status_events`, `personal_task_status_events`, `qa_test_runs`, `bug_progress_updates`); **judul, PIC, dan deadline** diambil saat dibekukan (tidak punya riwayat)
- Sumber minggu: `scheduled` (dibekukan ≤ 24 jam setelah minggu berakhir), `backfill` → tampil **Estimasi** (minggu yang baru dibekukan > 24 jam setelah berakhir, mis. server mati saat pergantian minggu: status & progress tetap per akhir minggu itu dari riwayat, tetapi judul/PIC/deadline saat dibekukan), `manual` (disiapkan untuk Super Admin, belum ada tombolnya)
- Minggu sebelum produk dibuat dilewati

**Akses:** permission `management_dashboard.view` (modul **Management Dashboard** di Roles & Permissions, 3.10). Default (`migration_v33.sql`): Super Admin, Manager, Commissioner, **Product Owner** (role `po`, karena PO yang mengisi PO Remarks dan catatan). Produk yang terlihat: **Super Admin, Manager, dan Commissioner melihat semua produk** di dashboard ini (lebih luas dari `GET /api/products`, yang tetap membatasi Commissioner ke produk yang di-assign di modul lain); role lain produk di `user_products` **ditambah produk yang ia jadi Owner-nya**.

**Ditunda (akan diangkat lagi oleh user):** kartu KPI, insight otomatis berbasis aturan, grafik tren mingguan, dan panel status roadmap dari dokumen spesifikasi mentor, serta tombol bekukan manual (`POST snapshots/run`). Riwayat status (`backlog_status_events`, `roadmap_status_events`) sudah dicatat sejak `migration_v33.sql`, jadi grafik tren nanti tidak perlu backfill ulang.

**Catatan implementasi:** riwayat status Backlog dan Roadmap dicatat oleh **trigger database** (semua jalur perubahan status ikut tercatat tanpa mengubah controller; siapa yang mengubah tidak disimpan). Kolom `backlog_items.completed_at` diisi trigger saat item masuk Done dan dikosongkan saat keluar dari Done. Riwayat sebelum v33 di-backfill dari log teks `item_activities` (perkiraan). PO Remarks (`open_item_remarks`) dan catatan (`weekly_notes`) disimpan terpisah dari salinan minggu beku dan digabung saat dibaca (remark yang berlaku untuk minggu W = baris terbaru dengan `week_start` ≤ W), jadi proses pembekuan tidak berubah. Lihat `WeeklySnapshotService` dan `ManagementDashboardController`.

---

## 4. Alur Kerja Utama

### Alur Sprint Planning
```
PO membuat Sprint
    → Isi backlog item (Epic → Story → Task)
    → Assign SP ke Task (Epic & Story terupdate otomatis)
    → Pindahkan item ke Sprint
    → Mulai Sprint (status: active)
    → Developer update status item saat dikerjakan
    → PO pantau burndown chart
    → Sprint selesai → pindah item yang belum done ke sprint berikutnya
```

### Alur Item Independent
```
User buat item tipe 'independent'
    → Isi judul, prioritas, assignee, deadline
    → Isi Estimasi Jam (wajib, min 0.5)
    → Item muncul di daftar backlog dengan badge ⚡
    → Jam estimasi langsung masuk ke perhitungan Dashboard User Occupation
    → Update status saat dikerjakan
```

### Alur Daily Standup
```
Developer login setiap pagi
    → Isi form standup (kemarin, hari ini, blocker)
    → Manager lihat standup tim via filter user_id
    → Untuk data historis: Manager upload CSV/Excel via Import
```

### Alur QA
```
QA Engineer buat Test Case → link ke backlog item
    → Buat Test Run (kumpulan test case)
    → Eksekusi satu per satu: pass/fail/skip/blocked
    → QA Dashboard: pantau coverage & pass rate, serta jumlah bug per Feature per stage (Bugs per Feature)
```

### Alur Bugs Incident
```
QA Engineer / Super Admin / Developer buat Bug (produk wajib, backlog item opsional)
    → Assign ke developer (opsional)
    → Klik "Update Progress" → pilih stage baru (open/in_progress/ready_to_test/reopen/done/improvement, atau Stage tambahan dari Super Admin) + catatan, atau ganti cepat lewat dropdown di kolom Stage
      → Entry baru tersimpan di histori Progress, stage terkini di data Bug ikut terupdate (masuk Stage selesai, bawaan 'done' → closed_at otomatis terisi; keluar dari Stage selesai termasuk ke 'reopen' → closed_at otomatis kosong lagi)
    → Kalau retest QA gagal di stage 'ready_to_test' → Update Progress ke 'reopen', lanjut diperbaiki lagi
    → Ulangi Update Progress setiap ada perkembangan, sampai stage 'done'
    → Bugs Dashboard: pantau total bug, open (termasuk reopen), ready to test, resolution rate, Recent Activity & Recent Comments
```

### Alur Lapor Bug Publik
```
Karyawan tanpa akun buka /report-bug (tanpa login)
    → Pilih aplikasi/produk, jenis laporan (Bug / Improvement), isi nama & email, judul, deskripsi, langkah reproduksi, severity
    → (Opsional) lampirkan screenshot
    → Submit → tiket langsung masuk ke tabel bugs yang sama dengan Bugs Incident (3.9), stage 'open' (atau 'improvement' kalau jenis laporan Improvement)
    → Assign otomatis ke Product Owner produk tsb (kalau ada)
    → Tim internal (Super Admin/QA/Developer) lihat tiket di Bugs Incident seperti tiket biasa
    → Lanjut alur Update Progress normal (lihat Alur Bugs Incident di atas)
```

---

## 5. Arsitektur Teknis

### Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | React 18 + Vite, Tailwind CSS, React Router v6 |
| **Backend** | Spring Boot 2.7.18 (Java 21), JdbcTemplate (no ORM) |
| **Database** | PostgreSQL 13+ |
| **Auth** | JWT Bearer Token (HS256), disimpan di `localStorage` |
| **Container** | Docker + Docker Compose |
| **HTTP Client** | Axios dengan auto-interceptor untuk token dan redirect 401 |

### Struktur Database (tabel utama)

| Tabel | Keterangan |
|---|---|
| `users` | Akun user dengan `role`, `password_hash`, `avatar_color` |
| `products` | Produk dengan member assignments (`user_products`) |
| `backlog_items` | Item dengan hierarki self-referencing via `parent_id`; kolom `estimated_hours` untuk tipe `independent`; `created_by` (FK `users`) menyimpan pembuat item dan ditampilkan sebagai **Author** di modal Edit |
| `sprints` | Sprint per produk |
| `standups` | Standup harian, `UNIQUE(user_id, standup_date)`; `progress` (`SMALLINT`, nullable, CHECK 0–100) dan `progress_detail` (`TEXT`, JSON status → jumlah item, mis. `{"done":1,"in_progress":2}`), keduanya `migration_v30.sql` = snapshot progress pekerjaan penulis di sprint aktif saat standup hari ini disimpan |
| `item_activities` | Log perubahan dan komentar per backlog item |
| `qa_test_cases` | Test case dengan link ke backlog item; `feature_id` (FK `features`, opsional, `ON DELETE SET NULL`, `migration_v23.sql`) menautkan ke Feature produk; `deadline` (`DATE`, opsional, `migration_v29.sql`) |
| `qa_attachments` | Lampiran test case (`test_case_id` FK `qa_test_cases` `ON DELETE CASCADE`, `filename` UUID di disk, `original_name`, `file_size`, `mime_type`, `uploaded_by`); mirror `bug_attachments` — `migration_v25.sql` |
| `qa_test_runs` | Sesi pengujian |
| `bugs` | Data bug/incident; link ke backlog item opsional; `feature_id` (FK `features`, opsional, `ON DELETE SET NULL`, `migration_v23.sql`) menautkan ke Feature produk; `deadline` (`DATE`, opsional, `migration_v29.sql`); kolom `type` (`code` dari `bug_types`, `NOT NULL DEFAULT 'bug'`, FK `bug_types(code)` `ON DELETE RESTRICT` sejak `migration_v31.sql`; sebelumnya CHECK `bug`/`inquiry` di `migration_v24.sql`) membedakan bug nyata dari tiket yang perlu klarifikasi; kolom `stage` menyimpan stage terkini (`code` dari `bug_stages`, FK `bugs_stage_fkey` → `bug_stages(code)` `ON DELETE RESTRICT` sejak `migration_v32.sql`; sebelumnya free-text tanpa CHECK), `closed_at` terisi otomatis saat stage ber-flag `is_closed` (bawaan: `done`), `converted_backlog_id` (FK `backlog_items`, opsional, `ON DELETE SET NULL`, `migration_v32.sql`) = kartu Backlog hasil tombol Buat Backlog. Kolom `reported_by` (FK `users`, otomatis diisi dari user pembuat saat create, ditampilkan sebagai kolom **Incident Author** di tabel Bugs) sudah ada sejak `migration_v12.sql` — baru ditampilkan di UI mulai versi 2.4. Kolom `reporter_name`/`reporter_email` (`migration_v18.sql`, versi 2.5) menyimpan identitas pelapor sebagai teks bebas untuk tiket dari jalur Lapor Bug Publik (3.15) — dipakai saat `reported_by` bernilai `NULL` |
| `bug_progress_updates` | Histori perubahan stage bug (append-only log, tidak ada `updated_at`) |
| `bug_activities` | Komentar & log perubahan per bug (`type`: `comment`/`change_log`), mirror `item_activities` milik Backlog |
| `notifications` | Notifikasi per user |
| `user_presence` | Status online/away/offline per user: `last_seen_at` (heartbeat apa pun), `last_active_at` (heartbeat dari tab terlihat & aktif); satu baris per user, dihapus saat logout (`migration_v22.sql`, lihat 3.16) |
| `backlog_item_features` | Impacted Features backlog item (`migration_v27.sql`, 3.2): `backlog_item_id` + `roadmap_id` (FK `product_roadmap`), PK gabungan, `ON DELETE CASCADE` di kedua sisi. `backlog_items.feature_id` tetap ada sebagai feature pertama (pola sama seperti `assignee_id` vs `backlog_item_assignees`) |
| `clients` | Daftar client/bank (`migration_v26.sql`, 3.17): satu baris = satu kontrak; `bank_name` tidak unik; `status_id` (FK `client_statuses`, `ON DELETE RESTRICT`), `contract_no`, `revenue` (`NUMERIC(18,2)`, per kontrak), `contract_start`/`contract_end` (CHECK akhir ≥ mulai), `pic_id` (FK `users`, `ON DELETE SET NULL`), `created_by` |
| `client_statuses` | Status client yang bisa diatur (`code` slug unik, `name`, `color`, `sort_order`); 5 status awal di-seed oleh `migration_v26.sql` |
| `bug_stages` | Stage tiket Bugs Incident yang bisa diatur (`code` slug unik & permanen, `name`, `color`, `sort_order`, `is_builtin`, flag perilaku `is_closed`/`not_late`/`counts_open`); 6 Stage awal bawaan di-seed `migration_v32.sql` dengan flag yang menjaga perilaku lama. Dirujuk `bugs.stage` (FK); `bug_progress_updates.stage` sengaja tanpa FK (riwayat). Lihat 3.9 |
| `bug_types` | Type tiket Bugs Incident yang bisa diatur (`code` slug unik & permanen, `name`, `color`, `sort_order`); 2 Type awal (`bug`, `inquiry`) di-seed oleh `migration_v31.sql`. Dirujuk `bugs.type` (3.9) |
| `client_products` | Produk yang dipakai client, many-to-many (PK `client_id`+`product_id`, keduanya `ON DELETE CASCADE`), mirror `user_products` |
| `client_comments` | Riwayat catatan update per client (`client_id` `ON DELETE CASCADE`, `user_id` `ON DELETE SET NULL`, `content`) |
| `app_settings` | Key-value store untuk setting yang bisa diubah lewat UI tanpa restart — dipakai untuk config SMTP (`mail.*`, 3.14) dan awal pencatatan Management Dashboard (`management.tracking_start` = Senin minggu pertama yang dicatat, diisi backend saat pertama kali jalan, tidak tampil di UI; 3.18) |
| `personal_tasks` | Task pribadi dari My Tasks → Add Task (`migration_v33.sql`, 3.3): `owner_id`, `product_id` (wajib), `backlog_item_id` (relasi opsional, `ON DELETE SET NULL`), `title`, `notes`, `status` (CHECK `todo`/`in_progress`/`in_review`/`done`/`blocked`), `deadline`, `completed_at` (diisi trigger) |
| `backlog_status_events` / `roadmap_status_events` / `personal_task_status_events` | Riwayat status (satu baris per perubahan, item baru dicatat dengan `from_status` NULL), diisi **trigger** (`migration_v33.sql`, 3.18). Backlog dan Roadmap punya kolom `source` (`live`/`backfill`) |
| `weekly_snapshots` | Satu baris per (minggu, produk) yang sudah dibekukan (`week_start` selalu Senin, `source` `scheduled`/`manual`/`backfill`), 3.18 |
| `weekly_snapshot_items` | Isi Open Item minggu yang dibekukan: salinan item (`item_source` backlog/mytask/qa/bug, `item_id` tanpa FK, kode, judul, `pic` JSONB, status, deadline, `is_late`, progress, `done_in_week`, `parent_item_id`, `sort_order`), 3.18 |
| `open_item_remarks` | PO Remarks per (minggu, item): `product_id`, `week_start` (Senin), `item_source`, `item_id` (tanpa FK), `expected_date`, `remark`, `updated_by`, `updated_at`; UNIQUE (`week_start`, `item_source`, `item_id`). Baris dengan tanggal dan teks kosong = remark dihapus mulai minggu itu, 3.18 |
| `weekly_notes` | Catatan Product Owner per (produk, minggu): `content`, `updated_by`, `updated_at`; UNIQUE (`product_id`, `week_start`), 3.18 |

### Port

| Service | Port |
|---|---|
| Frontend (dev) | 5173 |
| Frontend (prod Docker) | 3000 |
| Backend | 4000 |
| PostgreSQL | 5432 |

---

## 6. Referensi API

### Auth
```
POST /api/auth/login              Login, kembalikan JWT token
GET  /api/auth/me                 Data user yang sedang login
PUT  /api/auth/change-password    Ganti password sendiri (perlu currentPassword + newPassword)
```

### Presence
```
POST /api/presence/heartbeat      Heartbeat dari tab yang terbuka; body {state: "online" | "away"}
POST /api/presence/offline        Tandai user offline seketika (dipanggil saat logout)
GET  /api/presence                Status semua user: user_id, last_seen_at, last_active_at, status (online/away/offline)
```

### Backlog
```
GET    /api/backlog               List item
                                  Params: product_id, sprint_id, type, status, priority,
                                          assignee_id, parent_id, deadline_from, deadline_to,
                                          search, page, limit, hide_done
                                  hide_done=true → sembunyikan item status 'done' (default UI)
                                  Setiap item berisi `progress` (0–100, dihitung otomatis; lihat 3.2) — juga di detail, POST, dan PUT
                                  Juga related_bug_count, related_bug_open_count, related_bug_codes, related_tc_count (Related Card, 3.2)
GET    /api/backlog/:id           Detail satu item
GET    /api/backlog/:id/related   Related Card (3.2): { bugs: [...], test_cases: [...] }. bugs = tiket Bugs Incident dengan
                                  backlog_item_id = :id (relation "related") atau converted_backlog_id = :id (relation "source"),
                                  plus type_name/type_color, stage_name/stage_color/stage_is_closed/stage_not_late, assigned_to_name.
                                  test_cases = id, code, title, status, priority, last_result. Semua user login; 404 bila item tidak ada
POST   /api/backlog               Buat item baru (auto-cascade SP ke parent)
                                  400 jika parent_id akan membentuk siklus
PUT    /api/backlog/:id           Update item (auto-cascade SP; type/parent_id fallback ke nilai DB)
                                  400 jika parent_id akan membentuk siklus (termasuk ke diri sendiri)
PATCH  /api/backlog/:id/status    Update status saja
PATCH  /api/backlog/:id/sprint    Update sprint saja (400 jika item tipe independent)
DELETE /api/backlog/:id           Hapus item (auto-cascade SP ke parent yang tersisa)

GET    /api/backlog/:id/activities     Log perubahan + komentar
POST   /api/backlog/:id/activities     Tambah komentar (mendukung @[Nama] mention format)
POST   /api/backlog/:id/comments       Alias untuk endpoint activities di atas
DELETE /api/activities/:id             Hapus komentar

GET    /api/backlog/:id/attachments    List lampiran
POST   /api/backlog/:id/attachments    Upload lampiran (max 10MB, gambar/PDF/Word/Excel/PowerPoint/ZIP/CSV/TXT, multipart/form-data)
DELETE /api/attachments/:id            Hapus lampiran Backlog (khusus Backlog; bug dan QA punya endpoint hapus sendiri)
GET    /api/attachments/file/:filename Serve file lampiran (akses langsung ke file)
```

**Format mention:** `@[Nama Lengkap]` — disimpan sebagai teks, dirender sebagai badge indigo di UI. Setiap nama yang cocok persis dengan `users.name` (selain komentator sendiri) menerima notifikasi bell tipe `mention` + email (lihat 3.13).

**Field `estimated_hours`:** Wajib untuk tipe `independent`, diabaikan untuk tipe lain. Nilai disimpan sebagai `NUMERIC(6,1)`.

### Sprint
```
GET  /api/sprints               List sprint (params: product_id)
POST /api/sprints               Buat sprint baru (fields: name, start_date, end_date, capacity, status)
GET  /api/sprints/:id           Detail sprint beserta items
PUT  /api/sprints/:id           Update sprint (termasuk ubah status: active/completed)
DELETE /api/sprints/:id         Hapus sprint (PO/Manager/Admin only)
GET  /api/sprints/:id/burndown  Data burndown chart
POST /api/sprints/:id/burndown  Catat titik burndown harian
```

### Standup
```
GET    /api/standups              List standup (default: standup user sendiri)
                                   Berisi `progress` (0–100), `progress_detail` (JSON status → jumlah item), `prev_progress`, dan
                                   `prev_progress_date` (standup terakhir penulis yang punya progress) — lihat 3.7
                                  Params: date_from, date_to, user_id (Manager+ untuk filter user lain)
POST   /api/standups              Buat standup (1 per user per hari, duplikat ditolak)
                                   Standup hari ini (POST dan PUT) otomatis diberi snapshot progress dari item di sprint aktif
PUT    /api/standups/:id          Edit standup
GET    /api/standups/today        Cek apakah user sudah submit standup hari ini
GET    /api/standups/achievement  Statistik konsistensi standup per user (streak, persentase, dll.)
POST   /api/standups/import       Import bulk dari CSV atau Excel (Manager+ only)
                                  Accepts: multipart/form-data, file .csv / .xlsx / .xls
```

### Users
```
GET    /api/users                 List user aktif (Admin/Manager only)
GET    /api/users/roles           List semua role yang tersedia
POST   /api/users                 Buat user baru
GET    /api/users/:id/products    Lihat produk yang di-assign ke user
PUT    /api/users/:id/products    Update product assignments untuk user
PUT    /api/users/:id             Update user (role, is_active, dll.) — Admin only
PUT    /api/users/:id/password    Reset password user oleh admin (tanpa perlu password lama)
DELETE /api/users/:id             Soft delete (set is_active=false, data tetap ada)
DELETE /api/users/:id/permanent   Permanent delete (hapus dari DB, tidak bisa dibatalkan)
PUT    /api/users/me              Update profil sendiri (nama, email, avatar_color)
PUT    /api/users/me/password     Ganti password sendiri (perlu current_password)
```

### Products, Epics & Roadmap
```
GET/POST          /api/products         List & buat produk
                                            List berisi `progress` (0–100, rata-rata item kerja produk; null bila belum ada item; lihat 3.6)
GET/PUT/DELETE    /api/products/:id     Detail, update, hapus produk
CRUD              /api/epics            Epic per produk (params: product_id)
CRUD              /api/features         Feature / kategori per produk
CRUD              /api/roadmap          Roadmap item (timeline feature per produk)
```

### QA
```
GET/POST          /api/qa/test-cases           List & buat test case
                                             POST/PUT menerima `deadline` opsional (`YYYY-MM-DD`; `""`/null mengosongkan; PUT tanpa key `deadline`
                                             mempertahankan nilai lama; format salah → `400`). List menambah `deadline`, `progress` (0–100, dari run
                                             terakhir; null untuk `deprecated`), dan `last_result` (lihat 3.8)
PUT/DELETE        /api/qa/test-cases/:id       Update & hapus test case
GET/POST          /api/qa/test-cases/:id/attachments List & upload lampiran test case (max 10MB; gambar/PDF/Word/Excel/PowerPoint/ZIP/CSV/TXT)
DELETE            /api/qa/attachments/:id      Hapus lampiran test case (butuh qa.update)
GET/POST          /api/qa/test-runs            List & buat test run
PUT               /api/qa/test-runs/:id        Update test run (nama, status)
GET               /api/qa/dashboard            Statistik QA (coverage, pass rate, dll.; params: product_id)
```
**Bugs per Feature:** response `/api/qa/dashboard` menambah `bugOverviewAllowed` (boolean) dan `bugsByFeature` — array `{feature_id, feature_code, feature_name, product_code, product_name, total, open, in_progress, ready_to_test, reopen, done, improvement}`, satu baris per feature yang punya bug (urut total terbanyak) plus satu baris `feature_id: null` untuk bug tanpa Feature; ikut `product_id`. Hanya diisi untuk role `manager`/`po`/`developer`/`qa`/Super Admin; role lain mendapat `bugOverviewAllowed: false` dan array kosong (bukan `403`, karena sisa dashboard QA tetap untuk semua role).

**Feature:** body POST/PUT test case menerima `feature_id` (opsional, `""`/null = kosong); backend membalas `400` kalau feature bukan milik produk test case (di PUT dicek terhadap produk yang tersimpan, karena `product_id` tidak bisa diubah). Response list menambah `feature_id`, `feature_code`, `feature_name`.

**Import CSV test case:** lihat `POST /api/import/qa-test-cases` di bagian Import di bawah.

### Bugs Incident
```
GET/POST          /api/bugs                List & buat bug (params: product_id, backlog_item_id, stage). POST menerima
                                            `stage` awal `open` (default) atau `improvement`; nilai lain jatuh ke `open`.
                                            POST/PUT menerima `feature_id` opsional (`400` kalau bukan feature produk bug
                                            tsb); response list menambah `feature_id`, `feature_code`, `feature_name`
                                            POST/PUT menerima `deadline` opsional (`YYYY-MM-DD`; `""`/null mengosongkan; PUT tanpa key `deadline`
                                            mempertahankan nilai lama; format salah → `400`); response list berisi `deadline` (lihat 3.9)
                                            POST/PUT menerima `type` (`code` Type; kosong saat POST → `bug`; PUT tanpa key `type` mempertahankan
                                            nilai lama; Type tidak terdaftar → `400`); response list/detail menambah `type_name` dan `type_color`
PUT/DELETE        /api/bugs/:id            Update (tanpa field stage) & hapus bug (cascade ke progress)
GET/POST          /api/bugs/progress       List & buat entry progress (params: bug_id, product_id). POST juga dipakai dropdown
                                            Stage di tabel Bugs (body: bug_id, stage, note opsional) — stage bebas ke salah satu
                                            Stage terdaftar (6 bawaan + tambahan); Stage tidak dikenal → `400`. `closed_at` mengikuti flag
                                            `is_closed` Stage tujuan; pesan log/notifikasi memakai nama Stage
GET               /api/bugs/dashboard      Statistik bug (total, open, ready to test, resolution rate, byFeature [per baris `counts`: kode Stage → jumlah],
                                            byStage, bugStages [daftar Stage = kolom kartu], recentActivity, recentComments — masing-masing 10 terbaru; params: product_id).
                                            `byFeature` sama persis dengan `bugsByFeature` di /api/qa/dashboard dan ikut
                                            product_id; field lama `byProduct` dihapus di v3.19 (hanya dipakai grafik
                                            Bugs per Produk yang sudah diganti)
GET/POST          /api/bugs/:id/attachments List & upload lampiran bug (max 10MB; gambar/PDF/Word/Excel/PowerPoint/ZIP/CSV/TXT, multipart/form-data)
DELETE            /api/bugs/attachments/:id Hapus lampiran bug
GET/POST          /api/bugs/:id/activities List & tambah komentar bug (mirror endpoint activities Backlog Item, termasuk dukungan @[Nama] mention)
DELETE            /api/bugs/activities/:id Hapus komentar bug (pemilik sendiri atau Super Admin; log perubahan tidak bisa dihapus)
```
**Akses:** Semua endpoint di atas membalas `403` untuk role selain Super Admin/QA Engineer, kecuali role tsb diberi permission `access_bugs` (saat ini juga diberikan ke role Developer). Lampiran bug memakai `GET /api/attachments/file/:filename` yang sama dengan lampiran Backlog Item, tetapi hapus lewat `DELETE /api/bugs/attachments/:id` (bukan `DELETE /api/attachments/:id`, yang kini khusus Backlog — id lampiran hanya unik per tabel, jadi satu endpoint lintas tabel bisa menghapus lampiran yang salah). Endpoint publik `POST /api/public/bugs/:id/attachments` (3.15) tetap hanya menerima gambar karena tanpa login. Filter "Sembunyikan Closed/Done" dan sort kolom tidak punya parameter backend sendiri — keduanya murni client-side di atas response `GET /api/bugs`. Sejak versi 2.5, list ini juga berisi tiket yang dibuat lewat jalur publik (3.15) — tidak ada endpoint/parameter terpisah untuk membedakannya, cukup dilihat dari `reported_by` yang `NULL`.

### Public (tanpa autentikasi)
```
GET  /api/public/products              List produk aktif (id, code, name saja) — untuk dropdown form Lapor Bug Publik
POST /api/public/bugs                  Buat tiket bug publik (body: product_id, title, description,
                                        steps_to_reproduce, severity, reporter_name, reporter_email,
                                        report_type opsional: `bug` (default) | `improvement`)
POST /api/public/bugs/:id/attachments  Upload lampiran gambar ke tiket publik (max 10MB, image only,
                                        multipart/form-data) — menolak 403 kalau :id bukan tiket publik
```
**Akses:** Tidak memerlukan JWT sama sekali — lihat 3.15 dan Bagian 7 (Keamanan). Endpoint lain di luar tiga ini (`/api/bugs`, `/api/products`, dst.) tetap memerlukan login seperti biasa.

### Dashboard
```
GET /api/dashboard/stats       Statistik per produk (total items, status breakdown, delayed — tidak menghitung status done/backlog/in_review —, active sprint)
GET /api/dashboard/velocity    Sprint velocity (committed vs completed points, per produk)
GET /api/dashboard/workload    Beban kerja per user — hanya task & bug aktif (story & epic dikecualikan)
                               Kapasitas maks: 20 pts
GET /api/dashboard/occupation  Okupasi per user dalam jam:
                               - Item sprint aktif non-independent: story_points × 6 jam
                               - Item tipe independent: estimated_hours langsung
                               Kapasitas: 80 jam | Label: Ringan (<40) / Normal (40–64) / Padat (64–80) / Overload (>80)
GET /api/dashboard/delayed     Item yang melewati deadline (maks 20 item, urut dari paling lama; status done/backlog/in_review dikecualikan)
```

### Management Dashboard (3.18)
Semua butuh `management_dashboard.view` + akses produk (Super Admin/Manager/Commissioner semua produk, lainnya `user_products` + produk yang ia jadi Owner-nya). Produk tidak ada → 404, tanpa akses → 403. Menulis PO Remarks/catatan: Owner produk, Manager, Super Admin (lainnya 403).
```
GET /api/management/products                    Produk untuk sidebar dan pilihan di header
GET /api/management/sprints?product_id=         { active_sprint_id, sprints: [..., progress, work_items, done_items] }
GET /api/management/features?product_id=        Features + target_date, linked_items, progress (done/released = 100, tanpa item = null)
GET /api/management/weeks?product_id=           { current_week_start, tracking_start, weeks: [minggu berjalan (source live),
                                                minggu tersimpan terbaru dulu, tidak termasuk minggu sebelum tracking_start] }
GET /api/management/open-items?product_id=&week=yyyy-MM-dd
                                                Open Item satu minggu (tanggal mana pun di minggu itu; default minggu ini).
                                                Minggu ini dihitung langsung (live: true), minggu lalu dari salinan beku.
                                                Minggu belum mulai → 400, minggu sebelum awal pencatatan / tidak tersimpan → 404.
                                                Response: week_start, week_end, source, captured_at, live, items[], bug_stages[],
                                                note, can_edit_remarks (minggu ini + boleh menulis), can_edit_note.
                                                Tiap item punya remark: { expected_date, text, week_start, carried,
                                                updated_by_name, updated_at } atau null
PUT /api/management/remarks                     { product_id, item_source (backlog|mytask|qa|bug), item_id, expected_date?, remark? }
                                                Remark item untuk MINGGU BERJALAN; keduanya kosong = hapus (berhenti ikut ke
                                                minggu berikutnya). Item bukan milik produk → 400, item tidak ada → 404,
                                                remark > 300 karakter / tanggal salah format → 400. Response { remark }
PUT /api/management/notes                       { product_id, week (tanggal mana pun di minggu itu), content }
                                                Catatan minggu ini atau minggu lalu; minggu depan / sebelum awal pencatatan → 400;
                                                > 5000 karakter → 400;
                                                isi kosong = hapus. Response { note }
```

### Task Pribadi (3.3)
Semua user yang login; ubah/hapus hanya pemilik atau Super Admin (lainnya 403).
```
GET    /api/personal-tasks              Task pribadi milik sendiri (+ product_name, related_code/title, progress, is_delayed)
GET    /api/personal-tasks/by-item/:itemId  Task (milik siapa pun) yang terkait item Backlog: id, owner_id, owner_name, title, status, deadline, progress, is_delayed (tanpa notes)
POST   /api/personal-tasks              { title*, product_id*, backlog_item_id?, status?, deadline?, notes? }
                                        Item terkait menentukan produk; produk lain → 400; produk di luar akses → 403
PUT    /api/personal-tasks/:id          Field sama dengan POST
PATCH  /api/personal-tasks/:id/status   { status } — todo/in_progress/in_review/done/blocked
DELETE /api/personal-tasks/:id
```

### Notifications
```
GET    /api/notifications              List notifikasi user yang login
GET    /api/notifications/unread-count Jumlah notifikasi belum dibaca
PATCH  /api/notifications/:id/read    Tandai satu notifikasi sebagai dibaca
PATCH  /api/notifications/read-all   Tandai semua notifikasi sebagai dibaca
```

### Import
```
POST /api/import/jira    Import dari CSV export Jira ke Backlog (multipart/form-data, body: file, product_id).
                          Akses: PO/Manager/Admin
POST /api/import/bugs    Import dari CSV ke Bugs Incident (multipart/form-data, body: file) — format kolom sama
                          seperti hasil Export CSV di tab Bugs (3.9); produk di-resolve per baris, duplikat kode
                          (per produk) di-skip, kode kosong digenerate otomatis. Akses: sama seperti modul Bugs
                          Incident (permission access_bugs), bukan gate PO/Manager/Admin seperti import Jira
POST /api/import/qa-test-cases
                          Import dari CSV ke QA Test Cases (multipart/form-data, body: file) — format kolom sama
                          seperti hasil Export CSV di tab Test Cases (3.8); produk & Backlog Item di-resolve per
                          baris, Backlog Item wajib ditemukan (baris tanpa match masuk daftar error, beda dari
                          import bugs yang field ini opsional — qa_test_cases.backlog_item_id NOT NULL di skema).
                          Duplikat kode (per produk) di-skip, kode kosong digenerate TC-### otomatis. Akses:
                          permission qa.create
```

### Roles (Admin only)
```
GET                /api/roles        List semua role (termasuk permissions penuh tiap role)
POST               /api/roles        Buat role. Body: {name, display_name, permissions}
                                       permissions berbentuk nested {"modul": {"aksi": true}},
                                       mis. {"qa": {"create": true, "run": true}}. Aksi: roles.create
PUT                /api/roles/:id    Update display_name & permissions. Aksi: roles.update
DELETE             /api/roles/:id    Hapus role (ditolak 409 kalau masih dipakai user). Aksi: roles.delete
```
Daftar lengkap modul & aksi yang valid: lihat `MODULE_CATALOG` di `frontend/src/pages/Users.jsx`
(sumber kebenaran untuk UI matrix, dibaca juga sebagai referensi oleh backend per endpoint).

### Client Management
```
GET                /api/clients                    List client + produk + PIC + catatan terbaru. Aksi: clients.access
GET                /api/clients/options            Semua produk (dengan owner), kandidat PIC, dan status untuk form. Aksi: clients.access
GET                /api/clients/:id                Detail satu client. Aksi: clients.access
POST               /api/clients                    Buat client. Body: {bank_name*, status_id*, city, contract_no, revenue,
                                                     contract_start, contract_end, pic_id, product_ids[]}. Aksi: clients.create
PUT                /api/clients/:id                Ubah client (field yang tidak dikirim dikosongkan; product_ids hanya
                                                     mengganti produk bila dikirim). Aksi: clients.update
DELETE             /api/clients/:id                Hapus client beserta catatannya. Aksi: clients.delete
GET                /api/clients/:id/comments       Riwayat catatan (terbaru dulu). Aksi: clients.access
POST               /api/clients/:id/comments       Tambah catatan. Body: {content} (maks 5000 karakter). Aksi: clients.update
DELETE             /api/clients/comments/:id       Hapus catatan — hanya penulis atau Super Admin
GET                /api/bug-types                  List Type + bug_count. Aksi: bugs.access atau settings.update
POST/PUT/DELETE    /api/bug-types[/:id]            Kelola Type. Aksi: settings.update (Super Admin); hapus Type yang dipakai
                                                     tiket atau Type bawaan `bug`/`improvement` → 409
GET                /api/bug-stages                 List Stage + bug_count + flag. Aksi: bugs.access atau settings.update
POST/PUT/DELETE    /api/bug-stages[/:id]           Kelola Stage. Aksi: settings.update (Super Admin). Stage bawaan: hanya nama/warna/urutan
                                                     yang berubah, hapus → 409; Stage yang dipakai tiket → 409; nama kembar → 409
POST               /api/bugs/:id/convert-to-backlog  Buat kartu Backlog (story/backlog) dari tiket Type improvement. Aksi: bugs.access + backlog.create.
                                                     201 {bug, backlog_item, attachments_copied}; Type lain → 400; sudah dikonversi → 409; tanpa backlog.create → 403
GET                /api/client-statuses            List status + client_count. Aksi: clients.access atau settings.update
POST/PUT/DELETE    /api/client-statuses[/:id]      Kelola status. Aksi: settings.update (Super Admin); hapus status yang
                                                     dipakai client → 409
```
Validasi gagal membalas `400` dengan pesan jelas (nama bank/status wajib, tanggal akhir sebelum mulai, revenue negatif,
status/PIC/produk tidak valid).

### Settings (Super Admin only)
```
GET  /api/settings/mail        Ambil config SMTP saat ini (password tidak pernah dikembalikan — hanya password_set: true/false)
PUT  /api/settings/mail        Simpan config SMTP (host, port, username, password, from, smtp_auth, smtp_starttls;
                                password kosong/tidak dikirim = tidak diubah)
POST /api/settings/mail/test   Kirim satu email tes ke alamat di body {to}, balas {success, error}
```
**Akses:** Semua endpoint di atas membalas `403` untuk role selain Super Admin.

---

## 7. Keamanan

- Password di-hash dengan **BCrypt** (tidak disimpan plaintext)
- JWT token dengan expiry (konfigurasi via `JWT_SECRET` env var)
- Token tidak valid / kedaluwarsa mengembalikan **HTTP 401** (bukan 403)
- Axios interceptor di frontend: 401 di luar halaman login → redirect ke `/login`; 401 di halaman login → tampilkan pesan error (tidak redirect)
- Setiap endpoint yang butuh otorisasi divalidasi lewat matrix **Modul × Aksi** (`PermissionHelper.can(principal, module, action)`, lihat 3.10) sebelum diproses — bukan lagi whitelist nama role hardcode. `super_admin` selalu bypass (hardcode, bukan dari matrix) sebagai jaring pengaman supaya tidak ada skenario Super Admin terkunci sendiri dari sistem
- Modul/halaman yang sepenuhnya privat (Users & Roles, Bugs Incident, C-Level Dashboard, Settings, Import Jira) digerbang juga di level **route** frontend (redirect kalau tidak punya aksi yang sesuai), bukan cuma menyembunyikan link di sidebar — modul lain (Backlog, Sprints, Products, QA, dll.) tetap open-read untuk semua user login sesuai desain awal, cuma aksi tulis (create/update/delete) yang digerbang
- Input file di-parse server-side; format xlsx divalidasi via magic bytes ZIP
- Email dinormalisasi ke lowercase sebelum disimpan
- Self-update profil dibatasi hanya ke field yang aman (nama, email, avatar) — role tidak bisa diubah sendiri
- **`/api/public/**` (3.15) sengaja tanpa autentikasi** — dirancang untuk deployment LAN kantor saja (semua pengakses ada di jaringan WiFi yang sama), bukan internet-facing. Tidak ada rate limiting/CAPTCHA di versi ini karena volumenya diperkirakan rendah; kalau nanti trafiknya naik atau deployment berubah jadi internet-facing, ini perlu ditinjau ulang. Satu-satunya guard yang ada: upload lampiran publik menolak (`403`) kalau target tiketnya bukan tiket yang juga dibuat lewat jalur publik, supaya pengunjung anonim tidak bisa menambah file ke tiket internal manapun dengan menebak ID

---

## 8. Deployment

### Development
```bash
# Backend (Spring Boot)
cd backend-java
mvn package -DskipTests
java -jar target/product-tracker-1.0.0.jar

# Frontend (Vite dev server)
cd frontend
npm install && npm run dev
```

### Production (Docker)
```bash
docker compose up -d --build backend frontend
```

### Environment Variables (backend)
```
SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/product_tracker
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<password>
APP_JWT_SECRET=<random-string-panjang>
APP_CORS_ORIGIN=http://<server-ip>:3000
TEAMS_WEBHOOK_URL=<optional>

# Email notification — hanya dipakai sebagai fallback awal (sebelum halaman
# Notification Settings, 3.14, pernah dibuka/disimpan sekali oleh Super Admin;
# setelah itu config production sebenarnya disimpan di tabel app_settings)
MAIL_NOTIFICATIONS_ENABLED=false
MAIL_HOST=smtp.office365.com
MAIL_PORT=587
MAIL_USERNAME=<optional>
MAIL_PASSWORD=<optional>
MAIL_FROM=<optional>
MAIL_SMTP_AUTH=true
MAIL_SMTP_STARTTLS=true
```

**Mailpit (khusus local development):** `docker-compose.yml` menyertakan service `mailpit` (SMTP catcher, UI di `localhost:8025`) untuk menguji pengiriman email tanpa perlu akun SMTP asli. Untuk deployment production, arahkan config di halaman Notification Settings (3.14) ke SMTP provider sungguhan — service `mailpit` boleh dihapus dari stack production kalau tidak dipakai.

### Database Migrations

Jalankan migration secara berurutan pada database production yang sudah berjalan:

```bash
# Contoh via docker exec
docker exec pt_postgres psql -U postgres -d product_tracker -f /path/to/migration_vN.sql
```

| File | Isi |
|---|---|
| `migration_v7.sql` | Perbaikan FK `backlog_items.feature_id` → `product_roadmap(id)` |
| `migration_v8.sql` | Tambah kolom `estimated_hours NUMERIC(6,1)` di `backlog_items` |
| `migration_v12.sql` | Modul Bugs Incident: tabel `bugs` & `bug_progress_updates`, permission `access_bugs` di-seed ke role `qa` |
| `migration_v13.sql` | Tabel `bug_attachments` (lampiran gambar bug), mirror `backlog_attachments` |
| `migration_v14.sql` | Tabel `bug_activities` (komentar + log perubahan bug), mirror `leader_task_activities` |
| `migration_v15.sql` | Re-code bug existing dari `BUG-001` ke format `{KODE_PRODUK}-001` |
| `migration_v16.sql` | Sederhanakan stage Bugs Incident jadi 4 tahap (`open, in_progress, ready_to_test, done`), tambah kolom `bugs.closed_at` |
| `migration_v17.sql` | Tabel `app_settings` (key-value store) — dipakai pertama kali untuk config SMTP Notification Settings (3.14) |
| `migration_v18.sql` | Kolom `bugs.reporter_name`, `bugs.reporter_email` (nullable) — identitas pelapor untuk tiket dari Lapor Bug Publik (3.15) |
| `migration_v19.sql` | Multi-assignee untuk Backlog item |
| `migration_v20.sql` | Multi-assignee untuk Bugs Incident |
| `migration_v21.sql` | Matrix Modul × Aksi untuk `roles.permissions` (overwrite penuh 7 role default, lihat 3.10). **Belum dipasang di initdb `docker-compose.yml`** (mount berhenti di v20 lalu lompat ke v22), jadi jalankan manual pada database baru maupun lama |
| `migration_v22.sql` | Tabel `user_presence` (status online/away/offline di avatar, 3.16). Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database production yang sudah ada wajib menjalankannya manual** sebelum/saat backend baru naik, kalau tidak endpoint `/api/presence` gagal (titik status tidak muncul, bagian aplikasi lain tidak terpengaruh) |
| `migration_v23.sql` | Kolom `feature_id` (FK `features`, nullable, `ON DELETE SET NULL`) + index di `bugs` dan `qa_test_cases` untuk kolom/dropdown **Features** (3.8, 3.9). Additive. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (INSERT/UPDATE bug & test case di backend baru menyebut kolom ini, jadi tanpa migrasi create/edit gagal `500`) |
| `migration_v24.sql` | Kolom `bugs.type` (`VARCHAR(20) NOT NULL DEFAULT 'bug'`, CHECK `bug`/`inquiry`) + index untuk kolom/dropdown **Type** di Bugs Incident (3.9). Additive; baris lama dan INSERT yang tidak menyebut kolom (mis. Lapor Bug Publik) otomatis `bug`. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (INSERT/UPDATE bug di backend baru menyebut kolom ini, jadi tanpa migrasi create/edit gagal `500`) |
| `migration_v25.sql` | Tabel `qa_attachments` + index untuk lampiran test case (3.8). Additive dan idempotent. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (endpoint unduh file mencari nama asli di tabel ini, dan upload/list lampiran QA gagal `500` tanpa tabelnya) |
| `migration_v26.sql` | Modul Client Management (3.17): tabel `client_statuses` (+5 status awal), `clients`, `client_products`, `client_comments` dan permission modul `clients` yang **digabung** (`||`, bukan ditimpa) ke `roles.permissions` Super Admin/Manager (penuh) dan PO (`access`+`update`). Additive dan idempotent. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (endpoint `/api/clients` membaca tabel-tabelnya, jadi tanpa migrasi gagal `500`) |
| `migration_v27.sql` | Impacted Features (3.2): tabel `backlog_item_features` + backfill dari `backlog_items.feature_id` yang sudah ada. Additive & idempotent. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (list/create/edit Backlog membaca tabel ini, jadi tanpa migrasi gagal `500`) |
| `migration_v28.sql` | Permission **Export MD** (3.6): `{"export": {"md": true}}` **digabung** (`||`) ke `roles.permissions` Super Admin, Manager, PO, dan QA. Tanpa tabel/kolom baru dan backend tidak berubah, jadi **opsional dan aman dijalankan kapan saja**. Tanpa migrasi ini hanya Super Admin yang melihat tombol Export MD sampai role lain dicentang manual di Roles & Permissions. Idempotent; dipasang di initdb `docker-compose.yml` |
| `migration_v29.sql` | Kolom **Deadline** (3.8, 3.9): `bugs.deadline` dan `qa_test_cases.deadline` (`DATE`, nullable). Additive & idempotent (`ADD COLUMN IF NOT EXISTS`), data lama tidak berubah. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (INSERT/UPDATE bug dan test case menyebut kolom ini, jadi tanpa migrasi Buat/Edit gagal `500`) |
| `migration_v30.sql` | Kolom `standups.progress` (`SMALLINT`, nullable, CHECK 0–100) dan `standups.progress_detail` (`TEXT`) untuk snapshot **Progress Pekerjaan** (3.7). Additive & idempotent, data lama tidak berubah (`NULL`). Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (list/create/edit Standup menyebut kolom ini, jadi tanpa migrasi halaman Standup gagal `500`). Progress di Backlog, My Tasks, Products, dan QA **tidak butuh migrasi** (dihitung saat dibaca) |
| `migration_v32.sql` | Stage Bugs Incident yang bisa diatur + Buat Backlog dari tiket Improvement (3.9): tabel `bug_stages` (+6 Stage bawaan dengan flag yang menjaga perilaku lama), `bugs.stage`/`bug_progress_updates.stage` diperlebar ke `VARCHAR(50)`, FK `bugs_stage_fkey` → `bug_stages(code)` `ON DELETE RESTRICT` (nilai stage asing di data lama didaftarkan dulu sebagai Stage biasa), Type `improvement` bawaan di `bug_types` bila belum ada, kolom `bugs.converted_backlog_id`. Idempotent; tiket lama tidak berubah. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (backend baru membaca tabel dan kolom ini) |
| `migration_v33.sql` | Management Dashboard + task pribadi (3.3, 3.6, 3.18): `backlog_items.completed_at`; tabel riwayat `backlog_status_events`, `roadmap_status_events`, `personal_task_status_events` beserta **trigger** pencatatnya; `features.target_date`; `personal_tasks`; `weekly_snapshots` + `weekly_snapshot_items`; `open_item_remarks` (PO Remarks) dan `weekly_notes` (catatan Product Owner); permission `management_dashboard.view` **digabung** (`||`) ke Super Admin, Manager, Commissioner, Product Owner (role yang sudah punya key tidak ditimpa). Backfill riwayat sekali jalan dari log teks `item_activities` (perkiraan; `updated_at` tidak berubah). Idempotent, satu transaksi. **Wajib dijalankan sebelum backend baru naik**: backend membaca tabel ini saat start (tanpa tabel, pembekuan mingguan hanya memberi peringatan di log, tetapi Management Dashboard, My Tasks → Add Task, dan simpan Feature gagal). Dipasang di initdb `docker-compose.yml` (`35_migration_v33.sql`), tetapi initdb hanya jalan untuk volume baru — database yang sudah ada harus manual
| `migration_v31.sql` | Type tiket Bugs Incident yang bisa diatur (3.9): tabel `bug_types` (+2 Type awal `bug`, `inquiry`), `bugs.type` diperlebar ke `VARCHAR(50)`, CHECK `bugs_type_check` dihapus dan diganti FK `bugs_type_fkey` → `bug_types(code)` `ON DELETE RESTRICT`. Idempotent; semua tiket lama tetap valid dan tidak berubah. Dipasang di initdb `docker-compose.yml`, tetapi initdb hanya jalan saat volume pertama dibuat — **database yang sudah ada wajib menjalankannya manual SEBELUM backend baru naik** (list/create/edit bug dan import menyebut tabel ini, jadi tanpa migrasi Bugs Incident gagal `500`) |

---

## 9. Riwayat Perubahan

| Tanggal | Versi | Perubahan |
|---|---|---|
| 24 Jun 2026 | 1.0 | Dokumen PRD pertama dibuat |
| 24 Jun 2026 | — | Fix MyTask tidak menampilkan task yang di-assign |
| 24 Jun 2026 | — | Epic Story Points auto-cascade dari Task → Story → Epic |
| 24 Jun 2026 | — | Fitur Edit Profil & Ubah Password |
| 24 Jun 2026 | — | Fitur Import Standup dari CSV (Manager+) |
| 26 Jun 2026 | 1.1 | Fix token kedaluwarsa mengembalikan 401 bukan 403 |
| 26 Jun 2026 | 1.1 | Fix login error toast hilang akibat redirect dari axios interceptor |
| 26 Jun 2026 | 1.1 | Fix standup list menampilkan semua user — sekarang default tampil standup sendiri |
| 26 Jun 2026 | 1.1 | Tambah favicon inline SVG (hilangkan 404 vite.svg) |
| 26 Jun 2026 | 1.2 | Tambah Story Points hints (skala 1–13) di form backlog |
| 26 Jun 2026 | 1.2 | Tambah card User Occupation di Dashboard (1 SP = 6 jam, kapasitas 80 jam) |
| 26 Jun 2026 | 1.2 | Fix backlog PUT 500 — `type` fallback ke nilai DB jika tidak dikirim di body |
| 26 Jun 2026 | 1.2 | Tambah dukungan upload Excel (.xlsx/.xls) di Import Standup |
| 26 Jun 2026 | 1.2 | Parser xlsx berbasis Java ZIP+XML — tidak bergantung Apache POI |
| 26 Jun 2026 | 1.2 | Alias kolom fleksibel untuk header bahasa Indonesia/Inggris di import standup |
| 26 Jun 2026 | 1.3 | Tambah fitur @mention di kolom komentar backlog item |
| 26 Jun 2026 | 1.3 | Tambah shortcut filter chips: Backlog, Story, Epic di toolbar backlog |
| 26 Jun 2026 | 1.3 | Fix Team Workload — story & epic dikecualikan dari perhitungan |
| 26 Jun 2026 | 1.3 | Item status `done` disembunyikan by default; tambah chip filter ✅ Selesai |
| 26 Jun 2026 | 1.4 | Tambah tipe backlog `independent` — tidak terikat sprint/epic/story |
| 26 Jun 2026 | 1.4 | Field `estimated_hours` untuk tipe independent, dipakai di Dashboard Occupation |
| 26 Jun 2026 | 1.4 | Dashboard Occupation mendukung jam independent (langsung) + sprint item (SP×6) |
| 26 Jun 2026 | 1.4 | migration_v8: kolom `estimated_hours` di tabel `backlog_items` |
| 26 Jun 2026 | 1.5 | Perbaikan PRD: status sprint `planned` (bukan `planning`), kapasitas workload 20 pts & occupation 80 jam, level Ringan/Normal/Padat/Overload, soft vs permanent delete user, capacity field sprint, API reference dilengkapi (notifications, attachments, burndown POST, user roles, roadmap, import Jira) |
| 31 Agu 2026 | 1.6 | Tambah modul **Bugs Incident** (3.9): pelacakan bug terpisah dari QA Test Case, dengan histori progres perbaikan bertahap (`open → in_progress → fixed → verified → closed`). Akses default dibatasi Super Admin & QA Engineer, bisa diperluas lewat permission `access_bugs` (pola sama seperti `access_c_level`). Backlog item bersifat opsional (beda dari Test Case yang wajib). `migration_v12.sql`: tabel `bugs`, `bug_progress_updates` |
| 31 Agu 2026 | 1.7 | Bugs Incident (3.9): tambah **Lampiran Gambar** pada bug — unggah screenshot/bukti visual, klik thumbnail untuk preview penuh layar. Pola sama dengan lampiran Backlog Item (3.2), muncul setelah bug pertama kali disimpan. `migration_v13.sql`: tabel `bug_attachments` |
| 02 Sep 2026 | 1.8 | Bugs Incident (3.9): role **Developer** diberi permission `access_bugs`, dengan akses setara Super Admin/QA Engineer (termasuk tombol Aksi di tabel Bugs yang sebelumnya ter-hardcode hanya Super Admin/QA). Tambah **Aktivitas & Komentar** pada bug (thread komentar + @mention di modal Edit Bug), mirror fitur yang sama di Backlog Item (3.2). `migration_v14.sql`: tabel `bug_activities` |
| 02 Sep 2026 | 1.8 | Bugs Incident (3.9): kode bug sekarang mengikuti kode produk (`{KODE_PRODUK}-001`, bukan `BUG-001`), pola sama seperti kode Backlog Item. Tambah **filter bar** (pencarian judul/kode, filter multi-select stage/severity/prioritas/assignee) dan tombol **Export CSV** di tab Bugs. `migration_v15.sql`: re-code bug existing ke format baru |
| 04 Sep 2026 | 1.9 | Bugs Incident (3.9): sederhanakan stage jadi 4 tahap — `fixed` direname jadi **Ready to Test** (menandai QA fix siap diretest), `verified` & `closed` digabung jadi satu stage **Done**. Tambah tracking **Tanggal Incident**, **Tanggal Closed** (auto-terisi/kosong mengikuti stage `done`), dan **Update Terakhir** (tanggal + nama user dari Progress terakhir) di tabel Bugs. `migration_v16.sql`: kolom `bugs.closed_at`, remap data stage lama |
| 04 Sep 2026 | 2.0 | Backlog (3.2): **Lampiran** sekarang menerima PDF, Word, Excel, PowerPoint, ZIP, CSV, dan TXT — sebelumnya gambar saja. Preview inline untuk gambar/PDF/TXT/CSV (CSV dirender sebagai tabel), tipe lain dibuka/diunduh di tab baru |
| 09 Sep 2026 | 2.1 | Bugs Incident (3.9): tambah **sort kolom** di tabel Bugs (klik header Severity/Prioritas/Stage/Tanggal Incident/Tanggal Closed/Update Terakhir, siklus klik: default → kebalikan → asli). Tambah **grafik tren Dibuka vs Ditutup** di Bugs Dashboard dengan toggle Mingguan (8 minggu) / Bulanan (6 bulan) / Tahunan (3 tahun). Keduanya dihitung client-side dari data yang sudah dimuat — tidak ada perubahan skema database atau endpoint baru |
| 09 Sep 2026 | 2.2 | Bugs Incident (3.9): tambah stage **`reopen`** ("Re-Open", untuk bug yang gagal retest QA dan perlu diperbaiki ulang) — dihitung sebagai open di ringkasan dashboard, tidak ada validasi transisi (semua stage bisa dipilih kapan pun, sama seperti stage lain). Tambah toggle **"Sembunyikan Closed/Done"** (default aktif) di filter bar tab Bugs. Tambah panel **Recent Comments** di Bugs Dashboard, bersebelahan dengan Recent Activity — endpoint `GET /api/bugs/dashboard` sekarang juga mengembalikan `recentComments` (10 komentar terbaru lintas bug). Tidak ada perubahan skema database |
| 10 Sep 2026 | 2.3 | Tambah **Notifikasi Email** (3.13): email personal ke assignee/yang di-mention saat assignment & update (Backlog), status berubah (Backlog), assignment & stage berubah (Bugs Incident, modul yang sebelumnya sama sekali tidak punya notifikasi), assignment (Leader Task), dan mention di komentar (Backlog & Bugs Incident — pipeline mention backend dibangun dari nol, sebelumnya UI-nya ada tapi tidak pernah memicu apa pun). Global, dikontrol Super Admin — bukan preferensi per-user |
| 10 Sep 2026 | 2.3 | Tambah halaman **Notification Settings** (3.14, Super Admin only): toggle nyala/mati + form config SMTP + tombol Kirim Email Tes, tersimpan di database dan aktif langsung tanpa restart backend. `migration_v17.sql`: tabel `app_settings` |
| 10 Sep 2026 | 2.3 | Fix: generate kode otomatis (Backlog, Bugs Incident, Leader Task, Import Jira) memakai `ORDER BY code DESC` yang sort sebagai teks bukan angka — menyebabkan kode bentrok begitu ada campuran format lama (tidak zero-padded, mis. seed data `DEMO-6`) dan format baru (`DEMO-007`). Diperbaiki di 5 controller (`ORDER BY` sekarang berdasarkan angka trailing kode, bukan teks) |
| 10 Sep 2026 | 2.4 | Bugs Incident (3.9): tambah kolom **Incident Author** di tabel Bugs — menampilkan nama user yang membuat bug (`reported_by`), read-only (otomatis diisi dari user yang login saat create, tidak ada field untuk mengubahnya manual). Tidak ada perubahan skema database — kolom `reported_by` sudah ada sejak `migration_v12.sql` dan `reported_by_name` sudah dikembalikan `GET /api/bugs` sebelumnya, hanya belum ditampilkan di tabel |
| 10 Sep 2026 | 2.4 | Backlog (3.2), QA (3.8), Bugs Incident (3.9): field pemilihan backlog item (Parent User Story & Parent Epic di form Backlog; Backlog Item di form Test Case & Bug) diganti dari dropdown native jadi dropdown dengan kotak pencarian — komponen baru `SearchableSelect`, filter berdasarkan kode/judul secara client-side dari data yang sudah dimuat. Mempermudah pencarian saat daftar backlog item sudah banyak. Tidak ada perubahan skema database atau endpoint baru |
| 11 Sep 2026 | 2.5 | Tambah modul **Lapor Bug Publik** (3.15) — form `/report-bug` tanpa login untuk karyawan kantor yang tidak punya akun Product Tracker, jadi bagian dari deployment LAN yang sama (bukan sistem/domain terpisah). Tiket masuk langsung ke tabel `bugs` yang sama dengan Bugs Incident (3.9): produk dipilih dari dropdown, auto-assign ke Product Owner produk tsb, identitas pelapor (nama+email) disimpan sebagai teks bebas (`reported_by` tetap `NULL`), lampiran screenshot opsional. Endpoint baru tanpa autentikasi: `GET /api/public/products`, `POST /api/public/bugs`, `POST /api/public/bugs/:id/attachments` (lihat Bagian 6 & 7 untuk detail akses/keamanan). `migration_v18.sql`: kolom `bugs.reporter_name`, `bugs.reporter_email` |
| 11 Sep 2026 | 2.5 | Bugs Incident (3.9): tabel Bugs sekarang default sort **Tanggal Incident terbaru di atas** (sebelumnya urutan asli dari backend, per produk lalu kode) — supaya tiket yang baru dibuat/dilaporkan (termasuk dari Lapor Bug Publik) langsung terlihat tanpa perlu klik sort dulu. Klik header kolom lain tetap berfungsi seperti biasa. Tidak ada perubahan skema database atau endpoint baru, murni default state client-side |
| 25 Sep 2026 | 2.6 | Backlog (3.2), Bugs Incident (3.9): filter **Assignee** dan field **Assignee**/**Assigned To** di form Tambah/Edit diganti dari checklist polos (tanpa pencarian) jadi dropdown checklist dengan kotak pencarian — ketik nama untuk menyaring, tetap multi-select. Komponen baru `SearchableMultiSelect` (drop-in pengganti `MultiSelect` khusus untuk daftar assignee). Tidak ada perubahan skema database atau endpoint baru, murni komponen client-side |
| 25 Sep 2026 | 2.7 | Backlog (3.2): kolom **Sprint** di tabel Backlog jadi dropdown — pindahkan item ke sprint lain (atau lepas ke "Backlog (no sprint)") langsung dari tabel, tanpa buka form edit, pola sama seperti quick-update Status. Item tipe `independent` tidak bisa diedit lewat kolom ini. Endpoint baru `PATCH /api/backlog/:id/sprint`, permission sama dengan quick-status. Perubahan tercatat di log aktivitas, tidak mengirim notifikasi email. Tidak ada perubahan skema database |
| 25 Sep 2026 | 2.8 | Bugs Incident (3.9): tambah **Import CSV** — upload file CSV untuk bikin bug secara massal, format kolom persis sama dengan hasil **Export CSV** di tab yang sama (round-trip: export → edit di Excel → import balik — pakai "Save As → CSV UTF-8" saat edit di Excel, bukan "CSV" polos, biar karakter non-standar tidak rusak). Produk di-resolve per baris (satu file boleh lintas produk); kode kosong → auto-generate, kode yang sudah ada di produk yang sama → di-skip (create-only, bukan upsert). Assignee/Reported By dicocokkan ke akun user (nama/email) — Reported By yang tidak match akun manapun tetap tersimpan sebagai teks bebas alih-alih hilang. Tanggal Incident/Closed dari CSV dipakai kalau terisi & valid (penting untuk migrasi data bug historis). Parser CSV men-strip BOM UTF-8 di awal file supaya kolom pertama (`Kode`) dari hasil Export CSV kebaca benar — ikut membetulkan potensi masalah yang sama di `/api/import/jira`. Endpoint baru `POST /api/import/bugs`, akses ikut permission `access_bugs` (beda dari gate PO/Manager/Admin di Import Jira). Tidak ada notifikasi/email dikirim untuk bug hasil import, tidak ada perubahan skema database |
| 28 Sep 2026 | 2.9 | Bugs Incident (3.9): **QA manual Import CSV** (2.8) selesai dilakukan di stack Docker lokal, lintas produk lama maupun produk baru — tidak ditemukan bug, semua sesuai spesifikasi di atas. Cakupan yang diverifikasi: auto-generate kode kosong mengambil nomor tertinggi yang berlaku **saat itu juga** (termasuk kode eksplisit dari baris sebelumnya di file yang sama, bukan cuma yang sudah ada di database sebelum import dimulai); dedup kode exact-match ter-**scope per produk** (kode yang sama di produk berbeda tidak dianggap duplikat) dan berlaku juga untuk duplikat di dalam satu file yang sama; baris dengan Judul kosong di-skip diam-diam, baris dengan Produk kosong/tidak ditemukan masuk daftar error; Severity/Prioritas/Stage tidak valid fallback ke default; Assigned To/Reported By ter-resolve lewat nama maupun email, dan kalau tidak match user manapun tetap NULL/tersimpan sebagai teks bebas tanpa error; Backlog Item dengan kode tidak ditemukan tetap NULL tanpa error; Tanggal Incident kosong atau format tidak valid fallback ke waktu proses import; header case-insensitive, menerima alias Inggris, urutan kolom bebas, dan tetap aman kalau ada kolom opsional yang hilang total dari header (bukan cuma nilainya kosong); error dari pelanggaran panjang kolom (exception generik, bukan validasi terkontrol) maupun dari baris CSV yang rusak strukturnya (koma tanpa quote) tertangkap per-baris tanpa menghentikan baris lain di file yang sama; karakter Unicode/simbol khusus tersimpan utuh lewat file BOM UTF-8; ekstensi selain `.csv` ditolak. Tidak ada perubahan kode atau skema database |
| 14 Okt 2026 | 3.0 | **Users & Roles (3.10): ganti total sistem Roles & Permissions.** Bug yang jadi pemicu: Developer diberi izin "Kelola QA" lewat Roles & Permissions tapi tetap tidak bisa Add Test Case — investigasi membuktikan dari 17 permission key yang ada di UI lama, cuma 3 yang benar-benar dibaca kode (`manage_users`, `access_bugs`, `access_c_level`); semua modul lain (Backlog, Sprints, Products, QA, Features/Epics, Roadmap, Roles, Standup, Import, Departments, Settings) digerbang daftar role hardcode di kode — centang izin di UI lama tidak berefek apa pun. Diganti dengan matrix **Modul × Aksi** per role: `roles.permissions` (JSONB) sekarang nested `{"modul": {"aksi": true}}` (dulu flat `{"key": true}`), role dibuat bebas lewat UI baru (bukan 5 role tetap). Semua hardcode role-name di 22 controller backend dan 11 halaman frontend diganti ke `PermissionHelper.can(principal, module, action)` / `useAuth().can(module, action)` — tidak ada lagi floor role hardcode yang tersisa. Celah API lama yang tertutup tanpa pengecekan sama sekali (Epic/Feature/Product create-update-delete, Sprint create/update, semua aksi QA, Import Jira, User create/update/reset-password/deactivate) sekarang ditegakkan, meniru floor tombol UI yang sudah dipakai hari ini (tidak mengurangi akses siapa pun). Tambah **route-level blocking** nyata untuk 5 halaman full-private (Users, Bugs, C-Level, Settings, Import Jira) — sebelumnya cuma nav link disembunyikan, URL langsung tetap bisa diakses. Role SME diberi akses `c_level` (perbaikan bug lama: datanya sejak `migration_v10.sql` terlihat seperti SME seharusnya bisa akses Leader Notes/Task tapi key itu tidak pernah dibaca kode mana pun). 7 role default (termasuk SME/Commissioner yang sebelumnya tidak terdokumentasi di PRD) dimigrasikan otomatis supaya akses efektifnya persis sama seperti sebelum migrasi. `migration_v21.sql`: overwrite bentuk `roles.permissions` untuk 7 role; fix bug serialisasi JSON nested di `RoleController` (hand-rolled serializer lama cuma menangani value `String`/`Boolean`, akan merusak bentuk nested — diganti Jackson `ObjectMapper`) |
| 14 Okt 2026 | 3.1 | QA Module (3.8): tambah **Export CSV** & **Import CSV** di tab Test Cases, pola sama seperti Bugs Incident (2.8) — round-trip export → edit → import balik, format kolom Kode/Judul/Deskripsi/Langkah/Expected Result/Status/Prioritas/Backlog Item/Produk (tanpa Run Count/Pass/Fail, karena itu agregat dari `qa_test_runs`, bukan field test case). Beda dari import bugs: kolom **Backlog Item wajib ditemukan** — baris tanpa match masuk daftar error, bukan dibuat dengan `backlog_item_id` kosong (kolom ini `NOT NULL` di skema `qa_test_cases`, beda dari bugs yang nullable). Kode kosong → auto-generate `TC-###` (algoritma sama dengan create manual via `QaController`, per produk); kode yang sudah ada di produk yang sama → di-skip (create-only). Status/Prioritas tidak valid fallback ke `draft`/`medium`. Endpoint baru `POST /api/import/qa-test-cases`, akses permission `qa.create` (sama seperti tombol "Buat Test Case", bukan permission module terpisah). Diverifikasi manual di stack Docker lokal: export test case existing → import balik file yang sama persis menghasilkan 1 baris di-skip (duplikat kode), sesuai ekspektasi create-only. Tidak ada perubahan skema database |
| 14 Okt 2026 | 3.2 | **Fix Backlog (3.2): `StackOverflowError` saat update item dengan `parent_id` melingkar.** Bug yang ditemukan: `recalcAncestorSp()` (cascade Story Points Task → Story → Epic) rekursi mengikuti rantai `parent_id` tanpa deteksi siklus — kalau sebuah item punya `parent_id` yang balik mengarah ke dirinya sendiri (langsung atau lewat beberapa item), update item mana pun di rantai itu bikin backend rekursi tak berhenti sampai crash (`NestedServletException` / `StackOverflowError`). Direproduksi: edit item bertipe Epic → ubah Tipe ke Story → pilih item itu sendiri di dropdown **Parent Epic** (saat itu masih tersimpan sebagai Epic di database sehingga ikut muncul di daftar pilihannya sendiri) → simpan. Diperbaiki di dua lapis: (1) backend — `recalcAncestorSp` sekarang pakai *visited set* jadi tidak crash lagi walau ada data lama yang sudah melingkar, dan `POST`/`PUT /api/backlog` menolak (`400`, "Parent item membentuk siklus") `parent_id` yang akan membentuk siklus baru, termasuk ke diri sendiri; (2) frontend — dropdown **Parent User Story**/**Parent Epic** di form Backlog sekarang mengecualikan item yang sedang diedit dari daftar pilihannya sendiri. Tidak ada perubahan skema database — perbaikan data lama yang sudah terlanjur melingkar dilakukan manual per kasus lewat query (lihat `deployment/diagnosa-backlog-cycle.sh`) |
| 19 Okt 2026 | 3.3 | QA (3.8), Bugs Incident (3.9): dropdown **Backlog Item** sekarang menampilkan hierarki — opsi disusun Epic → Story → Task/Bug mengikuti `parent_id` (terindentasi per level, item tanpa parent yang valid tetap tampil sebagai root alih-alih hilang), item `independent` dikelompokkan terpisah di bawah. Tiap opsi dapat **badge warna tipe** (Story/Task/Bug/Epic/Independent) di kiri kode, warna sama seperti tabel Backlog (3.2). Di tiap level, urutan **tipe lebih diutamakan dari kode** (semua Story dulu baru Task, dst — bukan murni sort kode) supaya tipe yang sejenis tidak tercampur. Komponen `SearchableSelect` (2.4) diperluas dengan properti opsional `depth`/`badge`; dua pemakaian lain komponen ini (Parent User Story/Parent Epic di form Backlog, 3.2) tidak mengirim properti ini sehingga tampilannya tidak berubah. Fetch data backlog untuk kedua picker ini dinaikkan dari `limit=500` ke `limit=2000` supaya tree tidak terpotong di produk dengan ratusan item. Murni perubahan frontend (file baru `frontend/src/utils/backlogHierarchy.js`), tidak ada perubahan skema database atau endpoint baru |
| 19 Okt 2026 | 3.3 | QA (3.8), Bugs Incident (3.9): item berstatus **`done` disembunyikan** dari pilihan baru di dropdown Backlog Item — mengurangi risiko salah pilih item yang sudah selesai saat membuat Test Case/Bug baru. Pengecualian: item yang sedang jadi pilihan pada Test Case/Bug yang **sedang diedit** tetap ditampilkan meski statusnya `done`, supaya form edit tidak terlihat seperti kehilangan link-nya. Filter ini murni baca `status` yang sudah ter-load (tidak ada request/endpoint baru), dan tidak pernah menulis ulang status apa pun — item kembali muncul di dropdown secara otomatis begitu statusnya diubah dari `done` lewat halaman Backlog (3.2) seperti biasa |
| 28 Okt 2026 | 3.4 | Bugs Incident (3.9): tambah stage ke-6 **`improvement`** untuk masukan/ide yang ditemukan di produk dan bukan bug (stage biasa, bisa dipindah ke stage lain). Bisa dipilih langsung saat **Buat Bug** (field *Stage Awal*: Open/Improvement) dan lewat *Jenis Laporan* di form publik `/report-bug`; import CSV menerima Stage "Improvement". Kolom **Stage** di tabel Bugs sekarang dropdown untuk ganti stage cepat (memakai `POST /api/bugs/progress`, jadi histori/`closed_at`/notifikasi tetap konsisten). Tidak ada perubahan skema database |
| 30 Okt 2026 | 3.5 | **UI Revamp ala ClickUp** (3.16) — palet merah/putih/hitam, app shell baru (top bar hitam, icon rail, sidebar per section, tema terang/gelap), Backlog List per status + Board, status pill, bendera prioritas, command palette Ctrl K, shortcut produk di sidebar. **Hanya perubahan UI**, tidak ada fitur yang dihapus (audit paritas original vs revamp: `TESTING_UI_REVAMP.md`). Tambah **status presence** online/away/offline di avatar: tabel `user_presence` (`migration_v22.sql`) + `GET /api/presence`, `POST /api/presence/heartbeat`, `POST /api/presence/offline`. QA (3.8): grafik Test Results per Sprint jadi tren per produk (backend `/api/qa/dashboard` `bySprint` sekarang ikut filter `product_id` dan mengambil 6 sprint **terbaru** per produk — sebelumnya 12 sprint terlama dan filter diabaikan) |
| 2 Nov 2026 | 3.6 | Perbaikan dari uji paritas UI revamp: (1) QA (3.8) — Run Test tanpa memilih Sprint tidak lagi gagal `500` (`QaController.toLong` memperlakukan string kosong sebagai null); (2) Backlog (3.2), Bugs (3.9) — menghapus komentar tidak lagi menutup modal; (3) PRD 3.5 diluruskan: kartu Kanban Sprint display-only, status diubah dari Backlog/My Tasks. Backlog (3.2): mengganti baris per halaman (10/30/50/100) langsung memuat ulang data (sebelumnya baru berubah setelah menekan Group Status karena `perPage` tidak masuk dependency `useCallback`). QA (3.8) & Bugs Incident (3.9): daftar produk di sidebar (filter `?product=ID`), pilihan baris per halaman 10/30/50/100 yang berubah seketika, dan otomatis pindah ke halaman terakhir berisi data bila halaman aktif melewati batas. Tidak ada perubahan skema database |
| 2 Nov 2026 | 3.7 | QA Module (3.8) dan Bugs Incident (3.9): tambah kolom **Features** di tabel Test Cases dan Bugs, serta dropdown **Feature (opsional)** yang bisa dicari (opsi `[KODE_PRODUK] KODE_FEATURE · Nama`, disaring per produk) di form Buat/Edit. Feature diambil dari tabel `features` (Products → Features), bukan roadmap. Export CSV memuat kolom `Features`; Import CSV menerima kolom opsional `Features`. Backend memvalidasi feature milik produk yang sama. `migration_v23.sql`: `bugs.feature_id` dan `qa_test_cases.feature_id` (nullable, `ON DELETE SET NULL`) |
| 2 Nov 2026 | 3.8 | **Pencarian menyeluruh (Ctrl K)** (3.16): command palette kini juga mencari Bug, Test Case, Sprint, Produk, Epic, Feature, Roadmap, Leader Task, User, Role, dan Departemen (selain Backlog item), serta menyediakan aksi **"… baru"** (Backlog, Bug, Test Case, Sprint, Produk, Epic, Roadmap, Leader Task, User, Role, Departemen, Feature/Epic per produk). Semua hasil dan aksi mengikuti permission role (menu & route gate yang sama). Hasil membuka form/detail langsung lewat deep link satu-kali (`?bug=`, `?case=`, `?sprint=`, `?epic=`, `?task=`, `?new=…`, dst). Memperbaiki link notifikasi `/bugs?bug=ID` yang sebelumnya tidak membuka bug, dan Backlog `?item=` yang tidak terbuka ulang bila item yang sama dipilih lagi. Frontend saja — tidak ada perubahan backend/database |
| 2 Nov 2026 | 3.9 | Bugs Incident (3.9): tambah **Type** tiket — `bug` (default) atau `inquiry` (**Inquiry / Clarification**, untuk laporan yang kurang jelas dan perlu klarifikasi). Kolom **Type** di tabel Bugs, dropdown **Type (opsional)** di form Buat/Edit, filter Type, Export/Import CSV ikut memuat kolom `Type`. Backend memvalidasi nilai (`400` bila bukan `bug`/`inquiry`) dan Edit tanpa `type` tidak menimpa nilai lama. `migration_v24.sql`: `bugs.type` (NOT NULL DEFAULT `bug`, CHECK) |
| 2 Nov 2026 | 3.10 | Author tiket: (1) QA Module (3.8) — kolom **Author** (pembuat test case) di tabel Test Cases, mengikuti kolom Incident Author di Bugs Incident (3.9, tidak berubah); `Author` ikut di Export CSV QA; baris tabel QA kini bisa diklik untuk membuka detail test case. (2) Backlog (3.2) — saat item diklik, modal Edit menampilkan baris read-only **Author: <nama> · <tanggal dibuat>** di paling atas (tanpa kolom baru di tabel; tampil dari tampilan List, Board, maupun item anak). Backend Backlog kini mengirim `created_by_name` (JOIN ke `users`). Semua memakai `created_by` yang sudah ada, tanpa migrasi |
| 2 Nov 2026 | 3.11 | Lampiran: (1) Bugs Incident (3.9) — lampiran tidak lagi hanya gambar; kini sama seperti Backlog (gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, max 10MB) dengan preview PDF/TXT/CSV. (2) QA Module (3.8) — test case kini punya lampiran (sebelumnya tidak ada), tabel `qa_attachments`. Keduanya memakai komponen UI bersama `AttachmentSection`. (3) Perbaikan: `DELETE /api/attachments/:id` kini khusus Backlog dan bug/QA punya rute hapus sendiri (`/api/bugs/attachments/:id`, `/api/qa/attachments/:id`) — sebelumnya endpoint mencari id di tabel backlog dulu lalu tabel bug, sehingga menghapus lampiran bug bisa salah menghapus lampiran backlog yang kebetulan berid sama. Form Lapor Bug Publik (3.15) tetap hanya menerima gambar. `migration_v25.sql` |
| 3 Nov 2026 | 3.12 | Backlog (3.2): **status Epic dan Story otomatis mengikuti anaknya, maju saja.** Cukup 1 anak yang pindah ke `todo`/`in_progress`/`in_review` dan induknya ikut ke status itu (walau anak lain berbeda); `done` hanya bila semua anak `done` (Epic menghitung semua Story/Task/Bug di bawahnya, Story menghitung Task/Bug langsungnya, dari bawah ke atas sehingga satu aksi `done` bisa menyelesaikan Story lalu Epic). Tidak pernah mundur otomatis, induk `done` tetap `done`, `blocked` tidak memengaruhi dan tidak ditimpa, perubahan manual tetap boleh. Berlaku di `POST`/`PUT`/`PATCH /api/backlog/:id/status`; dicatat di log aktivitas induk, tanpa email. Batasan yang diketahui: hitung ulang hanya dipicu perubahan status atau pembuatan anak (bukan ganti parent, hapus anak, atau Import Jira); anak yang langsung `done` dari `backlog` belum menaikkan induk selama anak lain belum `done`; halaman My Tasks baru menampilkan status induk yang berubah setelah refresh. Backend saja, tanpa migrasi database, dan data lama tidak diperbaiki otomatis |
| 3 Nov 2026 | 3.13 | Backlog (3.2), Epic Board, QA (3.8), Bugs Incident (3.9): **toast sukses saat membuat item menampilkan kode barunya** (`Item HRS-098 ditambahkan`, `Bug HRS-053 dibuat`, `Test case TC-045 dibuat`, `Epic HRS-104 dibuat`), kode ditebalkan dan toast tampil 6 detik supaya mudah dibaca/disalin dan dicari di tabel. Epic Board yang sebelumnya tidak punya toast sukses kini ikut. Toast edit/error/import tidak berubah. Frontend saja (komponen bersama `utils/createdToast.jsx`), tanpa perubahan backend atau database |
| 11 Nov 2026 | 3.14 | Products (3.6) → tab Roadmap: tambah status **Testing** (badge amber) untuk menandai fitur yang sedang tahap testing, di antara On Progress dan Active. Muncul di badge tabel, filter status, kartu ringkasan (kini 6 kartu), dan form Tambah/Edit Item Roadmap; urutan status kini mengikuti alur hidup fitur: Planned → Research → On Progress → Testing → Active → Offline. Frontend saja (`Products.jsx`); kolom `product_roadmap.status` berupa `VARCHAR` tanpa constraint sehingga tidak ada migrasi dan tidak ada perubahan backend. Data lama tidak berubah |
| 11 Nov 2026 | 3.15 | **Tempel lampiran dengan Ctrl+V** di semua form berlampiran: Backlog (3.2), Bugs Incident (3.9), QA Test Case (3.8), dan Lapor Bug Publik (3.15). Gambar/file di clipboard langsung menjadi lampiran (screenshot dinamai `screenshot-YYYYMMDD-HHMMSS.png`); paste teks atau salinan sel Excel/Word tidak diganggu. Form Backlog kini memakai komponen lampiran bersama (`AttachmentSection`, sama seperti Bugs/QA) sehingga **lampiran juga bisa ditambahkan saat membuat item baru** (diantrekan, diunggah setelah item tersimpan; tetap opsional). Frontend saja (`utils/pasteFiles.js`, `AttachmentSection.jsx`, `Backlog.jsx`, `ReportBug.jsx`); endpoint, batas 10MB, dan tipe file yang diizinkan tidak berubah |
| 11 Nov 2026 | 3.16 | **Modul baru Client Management** (3.17) — daftar bank/klien pemakai produk internal: kota, status (bisa diatur di Admin → Client Statuses), no kontrak, produk (beberapa), PIC inhouse (otomatis Product Owner produk, bisa diganti), revenue per kontrak, start/end kontrak, dan riwayat catatan update. Satu baris = satu kontrak. Permission modul baru `clients` (Super Admin & Manager penuh, PO lihat+ubah). Butuh `migration_v26.sql` (jalankan manual SEBELUM backend baru naik). Menu Clients, halaman Client Statuses, dan Ctrl K (aksi "Client baru" + pencarian client) |
| 11 Nov 2026 | 3.17 | **Impacted Features** (3.2): field Feature di form Tambah/Edit Backlog item kini multi-select ber-label "Impacted Features" — satu item bisa menandai banyak feature roadmap; tabel Backlog dan My Tasks menampilkan semuanya sebagai chip. Hanya di Backlog (Bugs/QA tidak berubah). `migration_v27.sql`: tabel `backlog_item_features` + backfill; `feature_id` lama dipertahankan sebagai feature pertama |
| 11 Nov 2026 | 3.18 | **Share link kartu** (3.2): tombol **Salin link** di semua modal/kartu/baris yang punya deep link (Backlog, Bugs, QA, Sprint, Produk, Client, Leader Task, My Tasks, Epic Board), fallback salin untuk server http, **redirect kembali ke link setelah login** (juga untuk link notifikasi), dan Backlog **baca-saja** untuk role tanpa izin edit. Tampilan Impacted Features di tabel Backlog diubah jadi feature pertama + badge **+N**. Frontend saja |
| 16 Nov 2026 | 3.19 | **Bugs per Feature** — tabel angka jumlah bug per Feature produk per stage (Open, In Progress, Ready to Test, Re-Open, Done, Improvement + Total; bug tanpa Feature di baris "Tanpa Feature"), ikut filter produk. **QA Dashboard (3.8):** kartu baru di bawah Overall Result Distribution, hanya untuk role Manager/PO/Developer/QA (+Super Admin) tanpa memberi akses modul Bugs Incident. **Bugs Dashboard (3.9):** menggantikan grafik **Bugs per Produk** (2/3 lebar, Distribusi Stage 1/3). Satu komponen (`BugsPerFeatureCard`) dan satu query (`BugStats`) untuk kedua halaman. API: `/api/qa/dashboard` + `bugOverviewAllowed`/`bugsByFeature`; `/api/bugs/dashboard` + `byFeature`, `byProduct` dihapus. Tanpa migrasi database |
| 16 Nov 2026 | 3.20 | **Export MD (untuk AI)** (3.6): tombol **Export MD** di setiap kartu produk (Products) mengunduh satu file Markdown berisi paket data lengkap produk itu — Roadmap, Product Features, Epic, Sprint, Backlog (pohon Epic → Story → Task/Bug), Bugs Incident, dan QA Test Case, lengkap dengan komentar, riwayat aktivitas, riwayat progress bug, dan riwayat test run — supaya bisa diolah AI apa pun. Isi mengikuti hak akses akun pengekspor; Client Management, e-mail, dan lampiran tidak disertakan. Permission baru `export.md` di Roles & Permissions (3.10), default Super Admin/Manager/PO/QA lewat `migration_v28.sql` (opsional, tanpa perubahan skema). Frontend saja (`utils/exportMarkdown.js`, `components/ExportMdButton.jsx`); `utils/backlogHierarchy.js` kini mengekspor `flattenBacklogTree` (dipakai juga oleh dropdown Backlog Item QA/Bugs, yang kini juga menampilkan item dari rantai parent melingkar alih-alih menghilangkannya). Tanpa perubahan backend. Hasil uji keterbacaan AI dan keterbatasannya dicatat di 3.6 (17 Nov); temuan bug lama assignee Import Jira dicatat di 3.11 |
| 17 Nov 2026 | 3.21 | **Deadline di Bugs Incident & QA Module** (3.8, 3.9): input tanggal **Deadline (opsional)** di form Buat/Edit Bug dan Buat/Edit Test Case, kolom **Deadline** di tabel Bugs (setelah Stage, bisa di-sort) dan tabel Test Cases (setelah Status), tanggal merah bila hari deadline sudah lewat (Bugs: kecuali stage Done; QA: tanpa syarat status), dihitung dengan tanggal lokal pengguna. Ikut di Export CSV; Import CSV dan Export MD belum memuatnya. `migration_v29.sql` (kolom `deadline DATE` di `bugs` dan `qa_test_cases`) **wajib sebelum backend baru naik**. Backend: `BugController`/`QaController` menyimpan deadline, menolak format salah (`400`), dan Edit tanpa field `deadline` mempertahankan nilai lama. Komponen baru `components/DeadlineDate.jsx` |
| 17 Nov 2026 | 3.22 | **Progress % otomatis** di Backlog, My Tasks, Products, QA Module, dan Standup (3.2, 3.3, 3.6, 3.7, 3.8): bar + angka, selalu dihitung (tidak diisi manual). Backlog/My Tasks: item tanpa anak dari status (0/0/50/80/100, blocked 25), Story/Epic = rata-rata item di bawahnya berbobot story point. Products: rata-rata semua item kerja produk, **menggantikan "% selesai" lama** (angka bergeser, mis. HRS 30% → 37%). QA: dari hasil run terakhir (pass 100, fail 50, blocked 25, belum dijalankan 0; deprecated `—`), bar berwarna sesuai hasil. Standup: snapshot **Progress Pekerjaan** (item di sprint aktif; tanpa sprint aktif tidak ada bar) saat standup hari ini disimpan, dengan selisih dari standup sebelumnya dan rincian jumlah item per status. Ikut di Export MD. Backend: service baru `ProgressSupport` (satu sumber kebenaran), field `progress` di API backlog/products/qa/standups; frontend: komponen baru `ProgressBar`. `migration_v30.sql` (`standups.progress`) **wajib sebelum backend baru naik** — hanya untuk Standup; empat modul lain tanpa migrasi |
| 17 Nov 2026 | 3.23 | **Type tiket Bugs Incident bisa diatur** (3.9): daftar Type tidak lagi tetap `bug`/`inquiry` — Super Admin (`settings.update`) menambah, mengganti nama/warna/urutan, dan menghapus Type lewat **Admin → Bug Types** (`/settings/bug-types`) atau tombol **Atur Type** di tab Bugs; user lain hanya memilih. Dropdown Type di form, filter Type, badge Type di tabel, Export MD, dan Import CSV (cocok ke `code` atau nama Type) memakai daftar ini. Endpoint baru `/api/bug-types` (GET: `bugs.access` atau `settings.update`; tulis: `settings.update`); `GET /api/bugs` menambah `type_name`/`type_color`. Type yang dipakai tiket dan Type bawaan `bug` tidak bisa dihapus (`409`). `migration_v31.sql`: tabel `bug_types`, FK `bugs.type` → `bug_types(code)` menggantikan CHECK — **wajib dijalankan manual di database yang sudah ada sebelum backend baru naik** |
| 17 Nov 2026 | 3.24 | **Status In Review tidak dihitung terlambat** (3.1, 3.2, 3.3, 3.9, dan C-Level Dashboard): item Backlog dan Leader Task berstatus `in_review` tidak lagi menandai tanggal merah/ikon peringatan dan tidak masuk hitungan Delayed (Dashboard stats + daftar Delayed Items, My Tasks, Epic Board, C-Level, tulisan TERLAMBAT di Export MD). Di Bugs Incident, stage `ready_to_test` (padanan In Review: perbaikan selesai, menunggu QA) ikut dikecualikan dari tanggal merah selain `done`. QA Test Case tidak berubah (tidak punya status in review). Tanpa migrasi database — cukup deploy backend dan frontend baru |
| 18 Nov 2026 | 3.25 | **Stage Bugs Incident bisa diatur + Buat Backlog dari tiket Improvement** (3.9): Super Admin menambah Stage baru (nama/warna/urutan + flag selesai / tidak terlambat) lewat **Admin → Bug Stages** atau tombol **Atur Stage**; 6 Stage bawaan tidak bisa dihapus dan perilakunya terkunci. Dashboard, kartu Bugs per Feature (Bugs & QA Dashboard), filter, sort, dan Import CSV mengikuti daftar Stage; pesan log/notifikasi memakai nama Stage. Type `improvement` kini bawaan; tiket bertype itu mendapat tombol **Buat kartu Backlog** (story/backlog; judul, prioritas, assignee, deadline disalin; sekali per tiket, bug tetap ada, penanda + dialog + banner). Endpoint baru `/api/bug-stages`, `POST /api/bugs/:id/convert-to-backlog`; `GET /api/bugs` menambah `stage_name`/`stage_color`/`stage_is_closed`/`stage_not_late`/`converted_backlog_*`; `bugsByFeature` kini `counts` per kode Stage + `bugStages`. Buat Backlog juga menyalin lampiran, mencatat pelapor asli di Catatan kartu, dan tersedia di header modal Edit Bug (kiri Salin link). `migration_v32.sql` — **wajib dijalankan manual di database yang sudah ada sebelum backend baru naik** |
| 19 Nov 2026 | 3.26 | **Management Dashboard + Add Task di My Tasks** (3.3, 3.6, 3.18): menu baru **Home → Management** (`/management`, permission `management_dashboard.view`, default Super Admin/Manager/Commissioner; ketiganya melihat semua produk di dashboard ini). Satu halaman per produk: **Sprint Aktif** (pilih sprint atau "–", progress), **Features** (Status, **Target** tanggal, Progress % dari item Backlog terhubung), **Open Item · Minggu Ini** (Backlog, My Task, QA, Bug: terbuka + selesai minggu ini, status bisa diubah langsung), dan **Minggu Lalu** (minggu yang dibekukan otomatis tiap Senin 00:00 WIB, baca-saja, pencatatan dimulai minggu fitur dipasang — minggu sebelumnya dibiarkan kosong tanpa estimasi; chip 1–4 minggu lalu + kalender bernomor minggu ala Google Calendar dengan pilihan bulan & tahun). Kolom **PO Remarks** (ekspektasi selesai, diisi manual, ikut ke minggu berikutnya sampai diganti) dan **Catatan Product Owner** per minggu di bawah kedua tabel; yang mengisi Owner produk, Manager, Super Admin. Produk dipilih dari daftar **Products** di sidebar Home (atau header). Role PO mendapat akses dashboard. Detail Backlog menampilkan **Task Pribadi Terkait** (info saja). **My Tasks → Add Task**: task pribadi dengan produk wajib (dropdown + cari) dan relasi opsional ke item Backlog (rujukan, bukan konversi; tidak masuk sprint/progress). Form Feature dapat field **Target (tanggal)**. KPI, insight, grafik tren, dan panel roadmap dari spesifikasi mentor ditunda. `migration_v33.sql` wajib dijalankan sebelum backend baru |
| 19 Nov 2026 | 3.27 | **Sort & scroll tabel Roadmap + Related Card di Backlog** (3.2, 3.6). Products → Roadmap: header Fitur, Produk, Status (urut alur), Versi (natural), dan Target Rilis bisa diklik untuk sort naik/turun/kembali ke urutan awal; tabel kini punya lebar minimum dan bisa digeser ke kanan/kiri di layar sempit (frontend saja). Backlog: chip **Related Card** di baris List dan kartu Board (jumlah tiket Bugs Incident — merah bila masih ada yang open — dan jumlah QA Test Case), plus section **Related Card** yang bisa dibuka di detail item berisi tiket Bugs Incident terkait (termasuk tiket asal Buat Backlog) dan test case; klik baris membuka modulnya. User tanpa `bugs.access` melihat baris tiket tanpa link. Hanya info, tidak mengubah logika lain. Endpoint baru `GET /api/backlog/:id/related`; item Backlog menambah `related_*`. Tanpa migrasi |
| 19 Nov 2026 | 3.28 | **Tampilan app shell** (3.16), dokumentasi perubahan 18 Nov 2026 yang sebelumnya hanya ada di PR #30: top bar + icon rail dari hitam menjadi **bingkai abu terang ala ClickUp** (rail setinggi layar dengan logo PTAP; mode gelap tetap hampir hitam; warna lewat variabel CSS `--frame*`/`--side`), **toggle tema** baru (pil amber/biru dengan ikon matahari + bulan selalu terlihat), **aksen merah** di tab aktif, bar progress, dan menu aktif sidebar, serta **Group: Status** Backlog dipindah ke baris tab. Frontend saja, tanpa perubahan backend/database |
