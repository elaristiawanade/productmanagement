# Product Tracker — Internal Development System

Sistem tracking internal product development berbasis web dengan React + Node.js + PostgreSQL.

## Fitur

| Modul | Deskripsi |
|-------|-----------|
| **Dashboard** | Cross-project overview: workload, delayed items, sprint velocity, status distribution |
| **Backlog** | CRUD backlog items dengan filter, quick-status update, pagination |
| **Sprints** | Sprint board (Kanban), burndown chart, epic overview, sprint planning |
| **Products** | Manajemen produk, epic, dan feature per produk |
| **Users & Roles** | 5 role: Super Admin, Manager, PO, Developer, QA |
| **QA Module** | Test case management, test execution, QA dashboard |
| **Bugs Incident** | Bug tracking + histori progress perbaikan (open→in_progress→ready_to_test→reopen→done), komentar/@mention, tanggal incident/closed/update terakhir, kolom Incident Author (pelapor bug), filter sembunyikan closed/done, default sort tanggal incident terbaru di atas. Default Super Admin & QA Engineer; role lain (misal Developer) bisa diberi akses lewat permission `access_bugs` |
| **Lapor Bug Publik** | Halaman `/report-bug` tanpa login — siapa pun di jaringan kantor (bukan cuma user terdaftar) bisa lapor bug lewat form: pilih aplikasi, judul, deskripsi, langkah reproduksi, severity, nama+email pelapor, screenshot opsional. Tiket masuk langsung ke Bugs Incident yang sama, auto-assign ke Product Owner produk terkait |
| **Notifikasi Email** | Email personal ke assignee/yang di-mention saat assignment, status/stage berubah, atau mention (Backlog, Bugs Incident, Leader Task). Global, dikonfigurasi lewat halaman **Notification Settings** (Super Admin only) — toggle, config SMTP, kirim email tes, aktif tanpa restart |

## Roles

| Role | Akses |
|------|-------|
| Super Admin | Full access |
| Manager | Read all, manage users, view reports |
| Product Owner | Manage backlog, sprints, features |
| Developer | View & update assigned items |
| QA Engineer | Manage test cases & executions |

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
CRUD /api/epics?product_id=
CRUD /api/features?product_id=
CRUD /api/backlog             ← Full filter support
CRUD /api/sprints?product_id=
GET  /api/sprints/:id/burndown
CRUD /api/users
GET  /api/users/roles
CRUD /api/qa/test-cases
CRUD /api/qa/test-runs
GET  /api/qa/dashboard

CRUD /api/bugs                ← Default: Super Admin & QA Engineer only (403 lainnya, kecuali diberi permission access_bugs)
CRUD /api/bugs/progress       ← Histori progress perbaikan bug
GET  /api/bugs/dashboard      ← summary, byProduct, byStage, recentActivity, recentComments
GET/POST   /api/bugs/:id/activities   ← Komentar bug (mirror activities Backlog)
DELETE     /api/bugs/activities/:id

GET  /api/settings/mail       ← Config SMTP notifikasi email (Super Admin only)
PUT  /api/settings/mail       ← Simpan config SMTP
POST /api/settings/mail/test  ← Kirim email tes

GET  /api/public/products              ← Tanpa login. List produk aktif untuk dropdown form Lapor Bug Publik
POST /api/public/bugs                  ← Tanpa login. Buat tiket bug publik (auto-assign ke Product Owner)
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
