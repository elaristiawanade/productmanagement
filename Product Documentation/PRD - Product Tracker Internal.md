# PRD — Product Tracker Internal
**Product Requirements Document**

| | |
|---|---|
| **Versi** | 1.4 |
| **Tanggal** | 26 Juni 2026 |
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
| **Manager** | Kepala tim / manajemen | Baca semua produk, manajemen user, laporan, import standup |
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
- **Team Workload** — distribusi jumlah task aktif per orang. Hanya item bertipe `task` dan `bug` yang dihitung — tipe `story` dan `epic` dikecualikan
- **User Occupation** — beban kerja per user berdasarkan konversi jam:
  - Item sprint aktif: 1 Story Point = 6 jam
  - Item tipe `independent`: menggunakan `estimated_hours` langsung
  - Kapasitas baseline: 80 jam
  - Indikator beban: Ringan / Normal / Padat / Overload
  - Klik user untuk melihat detail item yang sedang dikerjakan
- **Delayed items list** — item yang melewati due date atau target sprint

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
- **Story Points auto-cascade:** SP pada Task otomatis dijumlahkan ke Story parent → lalu ke Epic grandparent. Berlaku untuk create, update, dan delete
- **Epic SP read-only:** Form Epic menampilkan SP sebagai kalkulasi otomatis (tidak bisa diinput manual)
- **Story Points hints:** Panduan skala SP (1–13) ditampilkan langsung di form untuk membantu estimasi
- **Independent task:** Tidak memiliki sprint, parent, atau epic. Field wajib: `estimated_hours` (jam kerja langsung). Nilai ini digunakan di Dashboard User Occupation
- Filter: produk, sprint, tipe, status, assignee, prioritas, range deadline, pencarian teks
- **Shortcut filter chips:** Backlog · Story · Epic · ✅ Selesai — klik sekali untuk filter cepat, klik lagi untuk hapus
- **Hide done by default:** Item berstatus `done` disembunyikan dari tampilan default. Gunakan chip "✅ Selesai" untuk melihat item yang sudah selesai
- Status item: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`
- Prioritas: `low`, `medium`, `high`, `critical`
- Assign ke developer, set due date, set sprint, hubungkan ke epic/feature
- Pagination dengan limit per halaman yang dapat dikonfigurasi
- Import dari Jira (CSV)

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
    → QA Dashboard: pantau coverage & pass rate
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
| `backlog_items` | Item dengan hierarki self-referencing via `parent_id`; kolom `estimated_hours` untuk tipe `independent` |
| `sprints` | Sprint per produk |
| `standups` | Standup harian, `UNIQUE(user_id, standup_date)` |
| `item_activities` | Log perubahan dan komentar per backlog item |
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
GET    /api/backlog           List item
                              Params: product_id, sprint_id, type, status, priority,
                                      assignee_id, parent_id, deadline_from, deadline_to,
                                      search, page, limit, hide_done
                              hide_done=true  → sembunyikan item status 'done' (default perilaku UI)
POST   /api/backlog           Buat item baru (auto-cascade SP ke parent)
PUT    /api/backlog/:id       Update item (auto-cascade SP; type/parent_id fallback ke nilai DB)
PATCH  /api/backlog/:id/status Update status saja
DELETE /api/backlog/:id       Hapus item (auto-cascade SP ke parent yang tersisa)
GET    /api/backlog/:id/activities     Log + komentar item
POST   /api/backlog/:id/activities     Tambah komentar (mendukung @[Nama] mention)
DELETE /api/activities/:id             Hapus komentar
GET    /api/backlog/:id/attachments    Lampiran gambar
POST   /api/backlog/:id/attachments    Upload lampiran (max 10MB, image only)
DELETE /api/attachments/:id            Hapus lampiran
```

**Format mention:** `@[Nama Lengkap]` — disimpan sebagai teks, dirender sebagai badge di UI.

**Field `estimated_hours`:** Wajib untuk tipe `independent`, diabaikan untuk tipe lain. Nilai disimpan sebagai `NUMERIC(6,1)`.

### Sprint
```
GET  /api/sprints             List sprint per produk
POST /api/sprints             Buat sprint baru
PUT  /api/sprints/:id         Update sprint (termasuk ubah status: active/completed)
GET  /api/sprints/:id/burndown  Data burndown chart
```

### Standup
```
GET    /api/standups          List standup (default: standup user sendiri)
                              Params: date_from, date_to, user_id (Manager+ untuk filter user lain)
POST   /api/standups          Buat standup (1 per user per hari)
PUT    /api/standups/:id      Edit standup
GET    /api/standups/today    Cek apakah sudah submit standup hari ini
GET    /api/standups/achievement  Statistik konsistensi per user
POST   /api/standups/import   Import bulk dari CSV atau Excel (Manager+ only)
                              Accepts: multipart/form-data, file .csv / .xlsx / .xls
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
CRUD /api/roadmap             Feature/roadmap per produk
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
GET /api/dashboard/stats      Statistik keseluruhan per produk
GET /api/dashboard/velocity   Sprint velocity per produk
GET /api/dashboard/workload   Workload per developer (task & bug aktif; story & epic dikecualikan)
GET /api/dashboard/occupation Okupasi per user dalam jam
                              - Item sprint aktif: story_points * 6 = jam
                              - Item independent: estimated_hours langsung
GET /api/dashboard/delayed    Item yang melewati deadline
```

---

## 7. Keamanan

- Password di-hash dengan **BCrypt** (tidak disimpan plaintext)
- JWT token dengan expiry (konfigurasi via `JWT_SECRET` env var)
- Token tidak valid / kedaluwarsa mengembalikan **HTTP 401** (bukan 403)
- Axios interceptor di frontend: 401 di luar halaman login → redirect ke `/login`; 401 di halaman login → tampilkan pesan error (tidak redirect)
- Setiap endpoint divalidasi role sebelum diproses
- Input file di-parse server-side; format xlsx divalidasi via magic bytes ZIP
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
```

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
