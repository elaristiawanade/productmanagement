# Product Tracker — Internal Development System

Sistem tracking internal product development berbasis web dengan React + Node.js + PostgreSQL.

## Fitur

| Modul | Deskripsi |
|-------|-----------|
| **Dashboard** | Cross-project overview: workload, delayed items, sprint velocity, status distribution. Item berstatus **In Review** tidak dihitung terlambat (tanggal tidak merah) di semua halaman — Backlog, Epic Board, My Tasks, C-Level, Dashboard; di Bugs Incident stage **Ready to Test** diperlakukan sama |
| **Management Dashboard** | Menu **Home → Management** (`/management`), satu halaman per produk untuk manajemen: **Sprint Aktif** (pilih sprint atau "–", progress), **Features** (Status, **Target** tanggal, Progress % dari item Backlog yang terhubung), **Open Item · Minggu Ini** (Backlog, My Task, QA, Bug yang terbuka + selesai minggu ini; status bisa diubah langsung), dan **Minggu Lalu** (dibekukan otomatis tiap Senin 00:00 WIB, baca-saja; pencatatan dimulai minggu fitur dipasang, minggu sebelumnya kosong tanpa estimasi; chip 1–4 minggu lalu + kalender bernomor minggu dengan pilihan bulan & tahun). Kedua tabel punya kolom **PO Remarks** (ekspektasi selesai, diisi manual, ikut ke minggu berikutnya sampai diganti) dan **Catatan Product Owner** per minggu di bawahnya — diisi Owner produk, Manager, atau Super Admin. Produk dipilih dari daftar **Products** di sidebar Home atau header. Permission `management_dashboard.view` (default Super Admin, Manager, Commissioner — ketiganya melihat semua produk di sini — dan Product Owner). Butuh `migration_v33.sql` |
| **Backlog** | CRUD backlog items dengan filter (assignee bisa diketik untuk mencari nama), quick-status & quick-sprint update langsung dari tabel, **Author** (pembuat item + tanggal) di paling atas modal saat item diklik, pagination server-side (10/30/50/100 baris, berubah langsung), tampilan List per status & Board, **status Epic & Story otomatis mengikuti anak** (naik mengikuti anak paling maju, `done` hanya bila semua anak `done`, tidak pernah mundur otomatis), toast sukses create menampilkan **kode baru** (mis. `Item HRS-098 ditambahkan`, juga di Bugs, QA, dan Epic Board), **lampiran opsional** yang juga bisa ditambahkan saat membuat item baru, dan **tempel gambar/file dengan Ctrl+V** langsung jadi lampiran (berlaku di semua form berlampiran: Backlog, Bugs, QA, Lapor Bug Publik), **Impacted Features** (satu kartu bisa memilih beberapa feature dari produknya; tabel menampilkan feature pertama + badge `+N`; butuh `migration_v27.sql`), dan **tombol Salin link** di setiap kartu/record semua modul (link membuka langsung kartunya; belum login → setelah login kembali ke link itu; tanpa hak ubah → tampilan baca-saja). **Related Card**: chip di baris List / kartu Board menunjukkan jumlah tiket Bugs Incident yang terhubung (merah bila masih ada yang open) dan QA Test Case; di detail item ada section **Related Card** (bisa dibuka-tutup) berisi tiket tersebut — termasuk tiket asal *Buat Backlog* — dan test case, klik untuk membuka modulnya |
| **My Tasks** | Semua item yang di-assign ke user login, plus **Add Task**: task pribadi dengan produk wajib (produk yang bisa diakses) dan relasi opsional ke item Backlog — hanya rujukan, bukan konversi, jadi tidak masuk Backlog/sprint/progress produk. Berlabel **Pribadi**, status bisa diganti inline, hanya pemilik (dan Super Admin) yang bisa mengubah/menghapus; ikut tampil di Management Dashboard sebagai sumber "My Task". Butuh `migration_v33.sql` |
| **Sprints** | Sprint board (Kanban), burndown chart, epic overview, sprint planning |
| **Products** | Manajemen produk, epic, dan feature per produk. Tab **Roadmap** dengan status Planned → Research → On Progress → **Testing** → Active → Offline; tabelnya bisa di-**sort** per kolom (Fitur, Produk, Status, Versi, Target Rilis) dan digeser ke kanan/kiri di layar sempit. Form Feature punya field **Target (tanggal)** (kolom Target di Management Dashboard; butuh `migration_v33.sql`) |
| **Export MD (untuk AI)** | Tombol **Export MD** di setiap kartu produk (menu Products) mengunduh **satu file Markdown** berisi paket data lengkap produk itu untuk diunggah ke AI apa pun (Claude, ChatGPT, Gemini, dll.): legenda cara membaca, ringkasan, Roadmap, Product Features, Epic, Sprint, Backlog (pohon Epic → Story → Task/Bug), Bugs Incident, dan QA Test Case — **lengkap dengan komentar, riwayat aktivitas, riwayat progress bug, dan riwayat test run**, plus link ke tiap kartu. Isi mengikuti hak akses akun pengekspor; Client Management, e-mail, dan lampiran tidak ikut. Diatur lewat permission **Export MD** di Roles & Permissions (default Super Admin, Manager, PO, QA lewat `migration_v28.sql` — opsional, tanpa perubahan skema). Frontend saja |
| **Progress % (otomatis)** | Bar progress di **Backlog** (list dan board), **My Tasks**, kartu **Products**, tabel **QA Test Cases**, dan kartu **Standup** — selalu dihitung otomatis, tidak ada input manual. Item Backlog tanpa anak dari status (In Progress 50%, In Review 80%, Done 100%, Blocked 25%); Story/Epic = rata-rata item di bawahnya berbobot story point; produk = rata-rata semua item kerjanya (menggantikan "% selesai" lama); QA dari hasil test run terakhir; Standup = snapshot progress pekerjaan penulis di **sprint aktif** saat standup hari ini disimpan (tanpa item di sprint aktif tidak ada bar), dengan selisih dari standup sebelumnya dan rincian jumlah item per status. Ikut di Export MD. Hanya Standup yang butuh migrasi (`migration_v30.sql`, sebelum backend baru naik); modul lain tanpa migrasi |
| **Client Management** | Daftar bank/klien pemakai produk internal (menu **Clients**): kota, **status yang bisa diatur** (Approaching/Declined/Active/Sunset/Deactivated sebagai data awal, kelola di Admin → Client Statuses), no kontrak, **beberapa produk** per client, **PIC inhouse** (otomatis Product Owner produk yang dipilih, bisa diganti), revenue per kontrak, start/end kontrak, dan **riwayat catatan update**. Satu baris = satu kontrak (kontrak kedua bank yang sama = baris baru). Kartu ringkasan per status, pencarian, filter Produk/PIC, Ctrl K. Permission modul `clients` (Super Admin & Manager penuh, PO lihat+ubah); butuh `migration_v26.sql` |
| **Users & Roles** | Role dibuat bebas lewat UI (bukan daftar tetap) — tiap role diberi hak akses lewat matrix **Modul × Aksi** (Buat/Ubah/Hapus/dll per modul, cuma aksi yang relevan yang tampil). 7 role default ter-seed: Super Admin, Manager, PO, Developer, QA, SME, Commissioner |
| **QA Module** | Test case management, test execution, QA dashboard, **Export/Import CSV** test case (format sama seperti Export CSV — duplikat kode di-skip, kode kosong auto-generate, Backlog Item wajib). Dropdown Backlog Item tersusun **hierarkis** (Epic → Story → Task/Bug, badge warna tipe di kiri kode, tipe diutamakan sebelum kode saat sort) dan menyembunyikan item berstatus `done` dari pilihan baru. Kolom **Features** + dropdown **Feature (opsional)** yang bisa dicari (opsi `[KODE_PRODUK] KODE_FEATURE · Nama`, tersaring per produk; butuh `migration_v23.sql`). Kolom **Author** (siapa yang membuat test case; tanpa migrasi). **Lampiran** test case (gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, max 10MB, sama seperti Backlog; butuh `migration_v25.sql`). Daftar produk di sidebar (filter `?product=ID`), pagination tabel 10/30/50/100 baris yang berubah langsung, tren Test Results per Sprint per produk. Run Test boleh tanpa Sprint. Kolom **Progress** (otomatis dari hasil test run terakhir: pass 100%, fail 50%, blocked 25%, belum dijalankan 0%; bar berwarna sesuai hasil; tanpa migrasi). Kolom **Deadline** + input tanggal **Deadline (opsional)** di form Buat/Edit Test Case (merah bila hari deadline sudah lewat; ikut Export CSV; butuh `migration_v29.sql`). Kartu **Bugs per Feature** di QA Dashboard (tabel angka bug per Feature produk per stage, termasuk baris "Tanpa Feature", ikut filter produk; hanya untuk Manager/PO/Developer/QA/Super Admin tanpa membuka akses Bugs Incident; tanpa migrasi) |
| **Bugs Incident** | Bug tracking + histori progress perbaikan (open→in_progress→ready_to_test→reopen→done, plus stage **improvement** untuk masukan/ide non-bug; stage bisa diganti langsung lewat dropdown di tabel; Super Admin bisa menambah Stage baru lewat Admin → Bug Stages, dan tiket Type **Improvement** bisa dibuat menjadi kartu Backlog lewat tombol di kolom Aksi), komentar/@mention, tanggal incident/closed/update terakhir, kolom Incident Author (pelapor bug), filter sembunyikan closed/done, default sort tanggal incident terbaru di atas, **Import CSV** massal (format sama seperti Export CSV — duplikat kode di-skip, kode kosong auto-generate). Dropdown Backlog Item sama seperti QA Module (hierarkis + badge tipe + item `done` disembunyikan). Kolom **Features** + dropdown **Feature (opsional)** sama seperti QA Module; Export/Import CSV ikut memuat kolom `Features`. **Lampiran** tidak lagi hanya gambar — gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT (max 10MB, sama seperti Backlog). Kolom **Type** + dropdown **Type (opsional)** + filter Type: bawaan **Bug** (default) dan **Inquiry / Clarification** (laporan kurang jelas yang perlu klarifikasi); daftar Type **bisa diatur Super Admin** di **Admin → Bug Types** (tambah/ubah/hapus; user lain hanya memilih); Export/Import CSV ikut memuat kolom `Type` (butuh `migration_v24.sql` dan `migration_v31.sql`). Kolom **Deadline** (bisa di-sort) + input tanggal **Deadline (opsional)** di form Buat/Edit Bug — merah bila hari deadline sudah lewat dan stage belum Done; ikut Export CSV (butuh `migration_v29.sql`). Daftar produk di sidebar dan pagination 10/30/50/100 baris seperti QA Module. Bugs Dashboard memakai tabel **Bugs per Feature** (sama dengan QA Dashboard) menggantikan grafik Bugs per Produk. Default Super Admin & QA Engineer; role lain (misal Developer) bisa diberi akses lewat permission `access_bugs` |
| **Lapor Bug Publik** | Halaman `/report-bug` tanpa login — siapa pun di jaringan kantor (bukan cuma user terdaftar) bisa lapor bug atau masukan ide lewat form: pilih aplikasi, jenis laporan (Bug / Improvement), judul, deskripsi, langkah reproduksi, severity, nama+email pelapor, screenshot opsional (bisa **tempel dengan Ctrl+V**). Tiket masuk langsung ke Bugs Incident yang sama, auto-assign ke Product Owner produk terkait |
| **Antarmuka (UI Revamp)** | Tampilan ala ClickUp (merah/putih/hitam): bingkai abu terang (top bar + icon rail setinggi layar) + sidebar per section, aksen merah di tab aktif / progress / menu aktif, toggle tema terang/gelap (amber/biru), command palette **Ctrl K** (cari halaman, aksi "… baru", dan semua record — Bug, Test Case, Sprint, Produk, Epic, Feature, Roadmap, Leader Task, User, Role, Departemen — sesuai permission role), shortcut produk di sidebar (Backlog/QA/Bugs), dan titik status **online/away/offline** di avatar (butuh `migration_v22.sql` — lihat `DEVELOPMENT.md`). Hanya perubahan tampilan; fitur lain tidak berubah. Detail: PRD 3.16, uji paritas: `TESTING_UI_REVAMP.md` |
| **Notifikasi In-App** | Bell di header dengan badge jumlah belum dibaca (assignment, stage berubah, mention), tandai satu/semua dibaca. Jumlahnya juga tampil di **tab browser** — judul `(3) Product Tracker — Internal Dev` + titik merah berangka di ikon tab — jadi notif baru terlihat walau sedang di tab lain (frontend saja, tanpa migrasi) |
| **Notifikasi Email** | Email personal ke assignee/yang di-mention saat assignment, status/stage berubah, atau mention (Backlog, Bugs Incident, Leader Task). Global, dikonfigurasi lewat halaman **Notification Settings** (Super Admin only) — toggle, config SMTP, kirim email tes, aktif tanpa restart |

## Roles & Permissions

Role bukan daftar tetap di kode — role apa pun bisa dibuat lewat halaman **Users & Roles → Roles & Permissions**, dan hak aksesnya ditentukan oleh matrix **Modul × Aksi** yang disimpan di `roles.permissions` (JSONB, bentuk `{"modul": {"aksi": true}}`). Backend menegakkan ini lewat `PermissionHelper.can(principal, module, action)`, frontend lewat `useAuth().can(module, action)` — satu sumber kebenaran untuk keduanya (tidak ada lagi role hardcode di kode).

7 role default yang ter-seed (bisa diubah/dihapus kapan saja oleh Super Admin, kecuali `super_admin` sendiri yang selalu bypass semua pengecekan):

| Role | Akses default |
|------|-------|
| Super Admin | Bypass semua pengecekan (hardcode, bukan dari matrix) |
| Manager | Hampir semua modul (create/update/delete) termasuk Client Management, kecuali Bugs Incident & C-Level |
| Product Owner | Backlog, Epics, Features, Sprints, QA (create/update), Roadmap, Import Jira, Client Management (access/update), Management Dashboard (lihat; mengisi PO Remarks & catatan untuk produk yang ia jadi Owner-nya) |
| Developer | Backlog (create/update/update_assigned), Epics |
| QA Engineer | QA (penuh), Backlog (create/update), Bugs Incident |
| SME | C-Level Dashboard (Leader Notes/Task) |
| Commissioner | C-Level Dashboard (Leader Notes/Task), Management Dashboard (lihat, semua produk) |

Daftar lengkap modul & aksi yang tersedia: lihat `MODULE_CATALOG` di `frontend/src/pages/Users.jsx`.

## Quick Start (Docker)

```bash
# 1. Copy environment file
cp backend/.env.example backend/.env

# 2. Start semua service
docker-compose up -d

# 3. Akses aplikasi
# Frontend         : http://localhost:3000
# Backend          : http://localhost:4000
# DB               : localhost:5432
# Lapor Bug Publik : http://localhost:3000/report-bug (tanpa login)
```

## Development (tanpa Docker)

### Prasyarat
- Node.js 18+
- PostgreSQL 14+

### Setup Database
```bash
# Buat database & run schema
psql -U postgres -c "CREATE DATABASE product_tracker;"
psql -U postgres -d product_tracker -f backend/db/schema.sql
psql -U postgres -d product_tracker -f backend/db/seed.sql
```

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env sesuai konfigurasi PostgreSQL lokal
npm install
npm run dev   # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| admin@company.com | Super Admin | password |
| budi@company.com | Manager | password |
| citra@company.com | Product Owner | password |
| andi@company.com | Developer | password |
| rafi@company.com | QA Engineer | password |

## Struktur Proyek

```
product-tracker/
├── backend/
│   ├── db/
│   │   ├── schema.sql      ← Database schema
│   │   └── seed.sql        ← Data awal (dari Excel)
│   ├── src/
│   │   ├── config/db.js    ← PostgreSQL connection
│   │   ├── middleware/     ← JWT auth, role check
│   │   └── routes/         ← API endpoints
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/          ← Dashboard, Backlog, Sprints, Products, Users, QA
│   │   ├── components/     ← Layout, Sidebar, Modal, Badges
│   │   ├── context/        ← AuthContext (JWT)
│   │   └── api/client.js   ← Axios + interceptors
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API Endpoints

```
POST /api/auth/login          ← Login
GET  /api/auth/me             ← Current user

GET  /api/dashboard/stats     ← Cross-project stats
GET  /api/dashboard/velocity  ← Sprint velocity
GET  /api/dashboard/workload  ← Team workload
GET  /api/dashboard/delayed   ← Delayed items

GET  /api/management/products|sprints|features|weeks|open-items  ← Management Dashboard (management_dashboard.view; ?product_id=, open-items juga ?week=)
PUT  /api/management/remarks|notes  ← PO Remarks (minggu berjalan) dan catatan mingguan (Owner produk, Manager, Super Admin)
CRUD /api/personal-tasks       ← Task pribadi My Tasks (milik sendiri). PATCH /:id/status. GET /by-item/:itemId = info task terkait di detail Backlog

CRUD /api/products
CRUD /api/clients               ← Client Management (modul clients: access/create/update/delete). /options, /:id/comments, DELETE /comments/:id
CRUD /api/client-statuses      ← Status client yang bisa diatur (tulis: settings.update / Super Admin)
CRUD /api/bug-types            ← Type tiket Bugs Incident yang bisa diatur (baca: bugs.access; tulis: settings.update / Super Admin)
CRUD /api/bug-stages           ← Stage tiket Bugs Incident yang bisa ditambah Super Admin (6 Stage bawaan tidak bisa dihapus)
POST /api/bugs/:id/convert-to-backlog ← Buat kartu Backlog dari tiket bertype Improvement (sekali per tiket)
CRUD /api/epics?product_id=
CRUD /api/features?product_id=
CRUD /api/backlog             ← Full filter support (item juga membawa related_bug_count / related_bug_open_count / related_bug_codes / related_tc_count)
GET  /api/backlog/:id/related ← Related Card: tiket Bugs Incident terkait (+ tiket asal Buat Backlog) dan QA test case item itu
CRUD /api/sprints?product_id=
GET  /api/sprints/:id/burndown
CRUD /api/users
GET  /api/users/roles
CRUD /api/roles               ← permissions: {"modul": {"aksi": true}} — lihat "Roles & Permissions" di atas
CRUD /api/qa/test-cases
CRUD /api/qa/test-runs
GET  /api/qa/dashboard

GET  /api/presence                 ← Status online/away/offline semua user
POST /api/presence/heartbeat       ← Heartbeat tab terbuka (state: online | away)
POST /api/presence/offline         ← Tandai offline saat logout

CRUD /api/bugs                ← Default: Super Admin & QA Engineer only (403 lainnya, kecuali role diberi aksi bugs.access). POST menerima stage awal: open | improvement
CRUD /api/bugs/progress       ← Histori progress perbaikan bug; POST juga dipakai dropdown Stage di tabel Bugs
GET  /api/bugs/dashboard      ← summary, byProduct, byStage, recentActivity, recentComments
GET/POST   /api/bugs/:id/activities   ← Komentar bug (mirror activities Backlog)
DELETE     /api/bugs/activities/:id

GET  /api/settings/mail       ← Config SMTP notifikasi email (Super Admin only)
PUT  /api/settings/mail       ← Simpan config SMTP
POST /api/settings/mail/test  ← Kirim email tes

GET  /api/public/products              ← Tanpa login. List produk aktif untuk dropdown form Lapor Bug Publik
POST /api/public/bugs                  ← Tanpa login. Buat tiket bug/improvement publik (report_type: bug | improvement; auto-assign ke Product Owner)
POST /api/public/bugs/:id/attachments  ← Tanpa login. Upload screenshot ke tiket publik (hanya tiket publik)
```

## Deployment (Internal Server)

```bash
# Build images
docker-compose build

# Start dengan environment production
CORS_ORIGIN=http://your-server-ip:3000 docker-compose up -d

# Update variabel penting di docker-compose.yml:
# - JWT_SECRET: ganti dengan string acak panjang
# - POSTGRES_PASSWORD: ganti password DB
# - CORS_ORIGIN: sesuaikan IP/domain server
```
