# PRD — Product Tracker Internal
**Product Requirements Document**

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 24 Juni 2026 |
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

Sistem menggunakan 5 role hierarkis dengan hak akses berbeda:

| Role | Deskripsi | Hak Akses Utama |
|---|---|---|
| **Super Admin** | Akses penuh tanpa batasan | Semua modul + manajemen user + konfigurasi sistem |
| **Manager** | Kepala tim / manajemen | Baca semua produk, manajemen user, laporan, import CSV standup |
| **Product Owner (PO)** | Pemilik produk | Kelola backlog, sprint, feature, epics untuk produk yang di-assign |
| **Developer** | Anggota tim dev | Lihat & update item yang di-assign ke diri sendiri |
| **QA Engineer** | Penguji | Kelola test case, test run, eksekusi pengujian |

**Aturan akses produk:** Developer dan QA hanya melihat item dari produk tempat mereka terdaftar sebagai member. Exception: semua user selalu dapat melihat item yang di-assign langsung ke mereka (My Tasks).

---

## 3. Modul & Fitur

### 3.1 Dashboard

**Tujuan:** Memberikan gambaran lintas produk secara real-time kepada manajemen dan PO.

**Fitur:**
- **Overview stats** — total backlog, sprint aktif, item selesai bulan ini, item terlambat
- **Sprint velocity chart** — grafik poin yang diselesaikan per sprint (6 sprint terakhir)
- **Workload per developer** — distribusi jumlah task aktif per orang
- **Delayed items list** — item yang melewati due date atau target sprint

**Akses:** Semua role (data disesuaikan dengan scope produk masing-masing role)

---

### 3.2 Backlog Management

**Tujuan:** Kelola semua backlog item dalam hierarki Epic → Story → Task/Bug.

**Fitur:**
- CRUD item dengan 4 tipe: `epic`, `story`, `task`, `bug`
- Hierarki parent-child: Task/Bug adalah anak dari Story; Story adalah anak dari Epic
- **Story Points auto-cascade:** SP pada Task otomatis dijumlahkan ke Story parent → lalu ke Epic grandparent. Berlaku untuk create, update, dan delete item
- **Epic SP read-only:** Form Epic menampilkan SP sebagai kalkulasi otomatis (tidak bisa diinput manual)
- Filter: produk, sprint, tipe, status, assignee, prioritas, pencarian teks
- Status item: `backlog`, `in_progress`, `review`, `done`
- Prioritas: `low`, `medium`, `high`, `critical`
- Assign ke developer, set due date, set sprint, hubungkan ke epic/feature
- Pagination dengan limit per halaman yang dapat dikonfigurasi

**Akses:**
- PO, Super Admin, Manager: CRUD penuh
- Developer: update status dan lihat item saja

---

### 3.3 My Tasks

**Tujuan:** Tampilan personal yang menampilkan semua task/bug yang di-assign ke user yang sedang login.

**Fitur:**
- Menampilkan semua item dengan `assignee_id = current_user` tanpa filter produk
- Kartu item menampilkan: judul, tipe, prioritas, status, produk, sprint, due date
- Filter lokal: status, prioritas
- Update status langsung dari kartu (inline)

**Catatan implementasi:** Bypass filter produk khusus untuk query ini — developer yang belum terdaftar di `user_products` tetap bisa melihat task yang di-assign ke mereka.

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
- **Sprint board (Kanban):** Drag & drop item antar kolom status
- **Burndown chart:** Grafik poin tersisa vs ideal burndown per sprint
- Sprint planning: pindahkan item dari backlog ke sprint
- Lihat sprint aktif dan riwayat sprint

**Status sprint:** `planning`, `active`, `completed`

---

### 3.6 Product Management

**Tujuan:** Kelola produk, epic, dan feature sebagai kontainer hierarki item.

**Fitur:**
- CRUD produk (nama, deskripsi, warna)
- Kelola epics per produk
- Kelola features per produk
- Assign member ke produk (menentukan scope akses Developer/QA)
- Roadmap produk (timeline feature)

---

### 3.7 Daily Standup

**Tujuan:** Pencatatan dan arsip standup pagi seluruh tim.

**Fitur:**

**Input Standup:**
- Form standup harian: kemarin, hari ini, blocker, rencana atasi blocker
- Satu standup per user per hari (sistem mencegah duplikat)
- Edit standup hari ini selama hari berjalan

**Riwayat:**
- Lihat semua standup dengan filter tanggal dan user
- Manager/Super Admin dapat melihat standup seluruh tim
- Developer hanya melihat standup sendiri

**Achievement:**
- Statistik konsistensi standup per user
- Streak harian, total standup, dll.

**Import CSV (Manager/Super Admin only):**
- Upload file CSV untuk migrasi data standup historis
- Format kolom: `standup_date`, `email`, `yesterday`, `today`, `has_blocker`, `blocker`, `blocker_plan`
- Duplikat (user + tanggal sudah ada) dilewati otomatis
- Laporan hasil import: jumlah berhasil, dilewati, error per baris
- Template CSV dapat diunduh langsung dari UI
- Support drag & drop upload

**Format nilai `has_blocker`:** `true/false`, `1/0`, `yes/no`, `ya/tidak`

---

### 3.8 QA Module

**Tujuan:** Manajemen test case dan eksekusi pengujian.

**Fitur:**
- CRUD test case dengan link ke backlog item
- Test run management (kumpulan test case untuk satu sesi pengujian)
- Eksekusi test case: `pass`, `fail`, `skip`, `blocked`
- QA dashboard: statistik coverage, pass rate, item yang belum di-test

---

### 3.9 Users & Roles (Admin only)

**Tujuan:** Manajemen akun dan hak akses.

**Fitur:**
- CRUD user
- Assign/ubah role
- Reset password user oleh admin
- Lihat daftar produk yang di-assign ke user

**Akses:** Super Admin, Manager

---

### 3.10 Import Jira (PO/Manager/Admin)

**Tujuan:** Migrasi data dari Jira ke Product Tracker.

**Fitur:**
- Upload file CSV export dari Jira
- Mapping kolom Jira ke format Product Tracker
- Preview hasil mapping sebelum import
- Laporan hasil import

---

### 3.11 Profil & Keamanan Akun

**Tujuan:** Memungkinkan user mengelola akun mereka sendiri.

**Fitur:**

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

### 3.12 Notifikasi

**Tujuan:** Memberitahu user tentang perubahan yang relevan.

**Fitur:**
- Bell notifikasi di header
- Notifikasi saat item di-assign ke user
- Notifikasi saat status item berubah
- Integrasi Microsoft Teams webhook (opsional, untuk notifikasi ke channel)

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

### Alur Daily Standup
```
Developer login setiap pagi
    → Isi form standup (kemarin, hari ini, blocker)
    → Manager lihat ringkasan tim di Riwayat
    → Untuk data historis: Manager upload CSV via Import CSV
```

### Alur QA
```
QA Engineer buat Test Case → link ke backlog item
    → Buat Test Run (kumpulan test case)
    → Eksekusi satu per satu: pass/fail/skip/blocked
    → QA Dashboard: pantau coverage & pass rate
```

---

## 5. Arsitektur Teknis

### Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | React 18 + Vite, Tailwind CSS, React Router v6 |
| **Backend** | Spring Boot 3.3 (Java 21), JdbcTemplate (no ORM) |
| **Database** | PostgreSQL 15 |
| **Auth** | JWT Bearer Token (HS256), disimpan di `localStorage` |
| **Container** | Docker + Docker Compose |
| **HTTP Client** | Axios dengan auto-interceptor untuk token |

### Struktur Database (tabel utama)

| Tabel | Keterangan |
|---|---|
| `users` | Akun user dengan `role`, `password_hash`, `avatar_color` |
| `products` | Produk dengan member assignments (`user_products`) |
| `backlog_items` | Item dengan hierarki self-referencing via `parent_id` |
| `sprints` | Sprint per produk |
| `standups` | Standup harian, `UNIQUE(user_id, standup_date)` |
| `qa_test_cases` | Test case dengan link ke backlog item |
| `qa_test_runs` | Sesi pengujian |
| `notifications` | Notifikasi per user |

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
POST /api/auth/login          Login, kembalikan JWT token
GET  /api/auth/me             Data user yang sedang login
```

### Backlog
```
GET    /api/backlog           List item (filter: product_id, sprint_id, type, status, assignee_id, search)
POST   /api/backlog           Buat item baru (auto-cascade SP ke parent)
PUT    /api/backlog/:id       Update item (auto-cascade SP jika SP atau parent_id berubah)
DELETE /api/backlog/:id       Hapus item (auto-cascade SP ke parent yang tersisa)
```

### Sprint
```
GET  /api/sprints             List sprint per produk
POST /api/sprints             Buat sprint baru
PUT  /api/sprints/:id         Update sprint (termasuk ubah status: active/completed)
GET  /api/sprints/:id/burndown  Data burndown chart
```

### Standup
```
GET    /api/standups          List standup (filter: date_from, date_to, user_id)
POST   /api/standups          Buat standup (1 per user per hari)
PUT    /api/standups/:id      Edit standup
POST   /api/standups/import   Import bulk dari CSV (Manager+ only, multipart/form-data)
```

### Users
```
GET    /api/users             List user (Admin/Manager only)
POST   /api/users             Buat user baru
PUT    /api/users/:id         Update user (Admin only)
DELETE /api/users/:id         Hapus user
PUT    /api/users/me          Update profil sendiri (nama, email, avatar_color)
PUT    /api/users/me/password Ganti password sendiri (perlu current_password)
```

### Products
```
CRUD /api/products            Manajemen produk
CRUD /api/epics               Epic per produk
CRUD /api/features            Feature per produk
```

### QA
```
CRUD /api/qa/test-cases       Test case
CRUD /api/qa/test-runs        Test run
POST /api/qa/test-runs/:id/execute  Eksekusi test case
GET  /api/qa/dashboard        Statistik QA
```

### Dashboard
```
GET /api/dashboard/stats      Statistik keseluruhan
GET /api/dashboard/velocity   Sprint velocity
GET /api/dashboard/workload   Workload per developer
GET /api/dashboard/delayed    Item terlambat
```

---

## 7. Keamanan

- Password di-hash dengan **BCrypt** (tidak disimpan plaintext)
- JWT token dengan expiry (konfigurasi via `JWT_SECRET` env var)
- Setiap endpoint divalidasi role sebelum diproses
- Input CSV di-sanitize sebelum insert ke database
- Email dinormalisasi ke lowercase sebelum disimpan
- Self-update profil dibatasi hanya ke field yang aman (nama, email, avatar) — role tidak bisa diubah sendiri

---

## 8. Deployment

### Development
```bash
# Backend (Spring Boot)
cd backend-java
mvn package -DskipTests
java -jar target/product-tracker-1.0.0.jar

# Frontend (Vite)
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
JWT_SECRET=<random-string-panjang>
CORS_ORIGIN=http://<server-ip>:3000
TEAMS_WEBHOOK_URL=<optional>
```

---

## 9. Riwayat Perubahan

| Tanggal | Versi | Perubahan |
|---|---|---|
| 24 Jun 2026 | 1.0 | Dokumen PRD pertama dibuat |
| 24 Jun 2026 | — | Fix MyTask tidak menampilkan task yang di-assign |
| 24 Jun 2026 | — | Epic Story Points auto-cascade dari Task → Story → Epic |
| 24 Jun 2026 | — | Fitur Edit Profil & Ubah Password |
| 24 Jun 2026 | — | Fitur Import Standup dari CSV (Manager+) |
