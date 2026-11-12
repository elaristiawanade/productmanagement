# Product Tracker — Internal Development System

Sistem tracking internal product development berbasis web dengan React + Node.js + PostgreSQL.

## Fitur

| Modul | Deskripsi |
|-------|-----------|
| **Dashboard** | Cross-project overview: workload, delayed items, sprint velocity, status distribution |
| **Backlog** | CRUD backlog items dengan filter (assignee bisa diketik untuk mencari nama), quick-status & quick-sprint update langsung dari tabel, **Author** (pembuat item + tanggal) di paling atas modal saat item diklik, pagination server-side (10/30/50/100 baris, berubah langsung), tampilan List per status & Board, **status Epic & Story otomatis mengikuti anak** (naik mengikuti anak paling maju, `done` hanya bila semua anak `done`, tidak pernah mundur otomatis), toast sukses create menampilkan **kode baru** (mis. `Item HRS-098 ditambahkan`, juga di Bugs, QA, dan Epic Board), **lampiran opsional** yang juga bisa ditambahkan saat membuat item baru, dan **tempel gambar/file dengan Ctrl+V** langsung jadi lampiran (berlaku di semua form berlampiran: Backlog, Bugs, QA, Lapor Bug Publik), **Impacted Features** (satu kartu bisa memilih beberapa feature dari produknya; tabel menampilkan feature pertama + badge `+N`; butuh `migration_v27.sql`), dan **tombol Salin link** di setiap kartu/record semua modul (link membuka langsung kartunya; belum login → setelah login kembali ke link itu; tanpa hak ubah → tampilan baca-saja) |
| **Sprints** | Sprint board (Kanban), burndown chart, epic overview, sprint planning |
| **Products** | Manajemen produk, epic, dan feature per produk. Tab **Roadmap** dengan status Planned → Research → On Progress → **Testing** → Active → Offline |
| **Client Management** | Daftar bank/klien pemakai produk internal (menu **Clients**): kota, **status yang bisa diatur** (Approaching/Declined/Active/Sunset/Deactivated sebagai data awal, kelola di Admin → Client Statuses), no kontrak, **beberapa produk** per client, **PIC inhouse** (otomatis Product Owner produk yang dipilih, bisa diganti), revenue per kontrak, start/end kontrak, dan **riwayat catatan update**. Satu baris = satu kontrak (kontrak kedua bank yang sama = baris baru). Kartu ringkasan per status, pencarian, filter Produk/PIC, Ctrl K. Permission modul `clients` (Super Admin & Manager penuh, PO lihat+ubah); butuh `migration_v26.sql` |
| **Users & Roles** | Role dibuat bebas lewat UI (bukan daftar tetap) — tiap role diberi hak akses lewat matrix **Modul × Aksi** (Buat/Ubah/Hapus/dll per modul, cuma aksi yang relevan yang tampil). 7 role default ter-seed: Super Admin, Manager, PO, Developer, QA, SME, Commissioner |
| **QA Module** | Test case management, test execution, QA dashboard, **Export/Import CSV** test case (format sama seperti Export CSV — duplikat kode di-skip, kode kosong auto-generate, Backlog Item wajib). Dropdown Backlog Item tersusun **hierarkis** (Epic → Story → Task/Bug, badge warna tipe di kiri kode, tipe diutamakan sebelum kode saat sort) dan menyembunyikan item berstatus `done` dari pilihan baru. Kolom **Features** + dropdown **Feature (opsional)** yang bisa dicari (opsi `[KODE_PRODUK] KODE_FEATURE · Nama`, tersaring per produk; butuh `migration_v23.sql`). Kolom **Author** (siapa yang membuat test case; tanpa migrasi). **Lampiran** test case (gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, max 10MB, sama seperti Backlog; butuh `migration_v25.sql`). Daftar produk di sidebar (filter `?product=ID`), pagination tabel 10/30/50/100 baris yang berubah langsung, tren Test Results per Sprint per produk. Run Test boleh tanpa Sprint |
| **Bugs Incident** | Bug tracking + histori progress perbaikan (open→in_progress→ready_to_test→reopen→done, plus stage **improvement** untuk masukan/ide non-bug; stage bisa diganti langsung lewat dropdown di tabel), komentar/@mention, tanggal incident/closed/update terakhir, kolom Incident Author (pelapor bug), filter sembunyikan closed/done, default sort tanggal incident terbaru di atas, **Import CSV** massal (format sama seperti Export CSV — duplikat kode di-skip, kode kosong auto-generate). Dropdown Backlog Item sama seperti QA Module (hierarkis + badge tipe + item `done` disembunyikan). Kolom **Features** + dropdown **Feature (opsional)** sama seperti QA Module; Export/Import CSV ikut memuat kolom `Features`. **Lampiran** tidak lagi hanya gambar — gambar, PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT (max 10MB, sama seperti Backlog). Kolom **Type** + dropdown **Type (opsional)** + filter Type: tiket berjenis **Bug** (default) atau **Inquiry / Clarification** (laporan kurang jelas yang perlu klarifikasi); Export/Import CSV ikut memuat kolom `Type` (butuh `migration_v24.sql`). Daftar produk di sidebar dan pagination 10/30/50/100 baris seperti QA Module. Default Super Admin & QA Engineer; role lain (misal Developer) bisa diberi akses lewat permission `access_bugs` |
| **Lapor Bug Publik** | Halaman `/report-bug` tanpa login — siapa pun di jaringan kantor (bukan cuma user terdaftar) bisa lapor bug atau masukan ide lewat form: pilih aplikasi, jenis laporan (Bug / Improvement), judul, deskripsi, langkah reproduksi, severity, nama+email pelapor, screenshot opsional (bisa **tempel dengan Ctrl+V**). Tiket masuk langsung ke Bugs Incident yang sama, auto-assign ke Product Owner produk terkait |
| **Antarmuka (UI Revamp)** | Tampilan ala ClickUp (merah/putih/hitam): top bar + icon rail + sidebar per section, tema terang/gelap, command palette **Ctrl K** (cari halaman, aksi "… baru", dan semua record — Bug, Test Case, Sprint, Produk, Epic, Feature, Roadmap, Leader Task, User, Role, Departemen — sesuai permission role), shortcut produk di sidebar (Backlog/QA/Bugs), dan titik status **online/away/offline** di avatar (butuh `migration_v22.sql` — lihat `DEVELOPMENT.md`). Hanya perubahan tampilan; fitur lain tidak berubah. Detail: PRD 3.16, uji paritas: `TESTING_UI_REVAMP.md` |
| **Notifikasi Email** | Email personal ke assignee/yang di-mention saat assignment, status/stage berubah, atau mention (Backlog, Bugs Incident, Leader Task). Global, dikonfigurasi lewat halaman **Notification Settings** (Super Admin only) — toggle, config SMTP, kirim email tes, aktif tanpa restart |

## Roles & Permissions

Role bukan daftar tetap di kode — role apa pun bisa dibuat lewat halaman **Users & Roles → Roles & Permissions**, dan hak aksesnya ditentukan oleh matrix **Modul × Aksi** yang disimpan di `roles.permissions` (JSONB, bentuk `{"modul": {"aksi": true}}`). Backend menegakkan ini lewat `PermissionHelper.can(principal, module, action)`, frontend lewat `useAuth().can(module, action)` — satu sumber kebenaran untuk keduanya (tidak ada lagi role hardcode di kode).

7 role default yang ter-seed (bisa diubah/dihapus kapan saja oleh Super Admin, kecuali `super_admin` sendiri yang selalu bypass semua pengecekan):

| Role | Akses default |
|------|-------|
| Super Admin | Bypass semua pengecekan (hardcode, bukan dari matrix) |
| Manager | Hampir semua modul (create/update/delete) termasuk Client Management, kecuali Bugs Incident & C-Level |
| Product Owner | Backlog, Epics, Features, Sprints, QA (create/update), Roadmap, Import Jira, Client Management (access/update) |
| Developer | Backlog (create/update/update_assigned), Epics |
| QA Engineer | QA (penuh), Backlog (create/update), Bugs Incident |
| SME | C-Level Dashboard (Leader Notes/Task) |
| Commissioner | C-Level Dashboard (Leader Notes/Task) |

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

CRUD /api/products
CRUD /api/clients               ← Client Management (modul clients: access/create/update/delete). /options, /:id/comments, DELETE /comments/:id
CRUD /api/client-statuses      ← Status client yang bisa diatur (tulis: settings.update / Super Admin)
CRUD /api/epics?product_id=
CRUD /api/features?product_id=
CRUD /api/backlog             ← Full filter support
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
