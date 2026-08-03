# PRD — C-Level Dashboard
**Product Requirements Document (Modul Baru)**

| | |
|---|---|
| **Versi** | 0.2 |
| **Tanggal** | 3 Agustus 2026 |
| **Status** | **Draft — Belum Diimplementasikan** |
| **Pemilik** | Tim Internal |
| **Berlaku sebagai** | Tambahan (extension) dari [PRD - Product Tracker Internal.md](./PRD%20-%20Product%20Tracker%20Internal.md) v1.5 |

---

## 1. Latar Belakang & Tujuan

Product Tracker saat ini melayani level tim (Developer/QA/PO) melalui Backlog, Sprint, dan Standup. Belum ada ruang khusus bagi jajaran pimpinan lintas departemen (HC, Sales, PMG, IT, Finance, Product) untuk mencatat progres mingguan dan mengelola task level kepemimpinan secara terstruktur.

**Tujuan:** Menyediakan modul **C-Level** — satu dashboard baru berisi tiga sub-fitur:

1. **Leader Notes** — catatan mingguan per departemen (mirip Daily Standup, tapi berbasis departemen dan mingguan, bukan per-hari-per-orang)
2. **Leader Task** — task board level kepemimpinan (mirip Backlog, tapi scoped ke departemen bukan produk)
3. **My Task** — task milik user yang login, difilter dari Leader Task (mirip My Tasks yang sudah ada, tapi sumber datanya `leader_tasks`, bukan `backlog_items`)

---

## 2. Pengguna & Peran

**Revisi dari draft v0.1:** Akses C-Level tidak memakai role baru tunggal — melainkan dua mekanisme terpisah: **department** (menentukan scope *lihat*) dan **role** (menentukan siapa yang boleh *menulis*).

### 2.1 Department — atribut baru di `users`, bukan role

Kolom baru `users.department` (nullable, salah satu dari **HC, Sales, PMG, IT, Finance, Product**) menentukan departemen mana yang datanya bisa dilihat user tsb di C-Level.

| Departemen | Dipetakan dari role sistem | Cara pengisian |
|---|---|---|
| **IT** | `developer`, `qa` | Default otomatis berdasarkan role saat migrasi |
| **PMG** | `po` (Product Owner), `manager` | Default otomatis berdasarkan role saat migrasi |
| **HC, Sales, Finance, Product** | Tidak ada role sistem yang cocok | Admin set `department` secara manual per user via halaman Users & Roles, terlepas dari role sistem user tsb |

**Aturan lihat (view):** User dengan `department` terisi melihat Leader Notes & Leader Task **untuk departemennya sendiri saja**. Super Admin melihat semua departemen tanpa batasan.

### 2.2 Role — menentukan siapa yang boleh menulis

Melihat (view) berbeda dari menulis (create/edit Leader Notes & Leader Task). Hanya role-role berikut yang boleh menulis, terlepas dari departemen apa yang mereka lihat:

| Role penulis | Status |
|---|---|
| **Super Admin** | Sudah ada |
| **Manager** | Sudah ada |
| **Product Owner (PO)** | Sudah ada |
| **SME (Subject Matter Expert)** | **Role baru** — perlu ditambahkan ke tabel `roles` |
| **Commissioner** | **Role baru** — perlu ditambahkan ke tabel `roles` |

**Developer dan QA (anggota departemen IT) hanya bisa melihat** Leader Notes & Leader Task departemen IT — tidak bisa membuat atau mengedit. Aturan yang sama berlaku untuk anggota departemen lain di luar 5 role penulis di atas (mis. staf biasa di HC/Sales/Finance/Product yang bukan Manager/PO/SME/Commissioner/Super Admin).

**⚠️ Perlu dikonfirmasi:** Apakah 5 role penulis ini (Manager/PO/SME/Commissioner/Super Admin) boleh menulis **lintas semua departemen** (bertindak sebagai satu dewan C-Level yang mengelola seluruh departemen), atau tulisan mereka tetap **dibatasi ke departemen mereka sendiri** (mis. PO/Manager cuma bisa menulis untuk PMG)? Draft ini berasumsi **lintas departemen**, karena SME & Commissioner secara alami bersifat lintas-fungsi/eksekutif dan tidak otomatis terikat satu departemen seperti Developer/QA/PO/Manager. Lihat juga Bagian 5.

Permission baru mengikuti pola JSONB yang sudah ada di `roles.permissions`, ditambahkan ke role Manager/PO/SME/Commissioner/Super Admin:
```json
{ "manage_leader_notes": true, "manage_leader_tasks": true }
```

---

## 3. Modul & Fitur

### 3.1 Leader Notes

**Tujuan:** Catatan progres mingguan per departemen oleh pimpinan — apa yang sudah dicapai, apa target minggu ini, dan task turunannya.

**Pola input** (mengadaptasi pola Daily Standup: tanggal + isian terstruktur, satu entry per konteks):

| Field | Tipe | Keterangan |
|---|---|---|
| `note_date` | Date | Default hari ini, seperti Standup |
| `department` | Dropdown | Salah satu dari: **HC, Sales, PMG, IT, Finance, Product**. Opsi yang muncul tergantung hak tulis user (lihat 2.2) — jika role penulis dibatasi lintas-departemen sesuai asumsi draft ini, dropdown menampilkan semua 6 departemen; jika ternyata dibatasi per-departemen sendiri, dropdown hanya menampilkan departemen milik user tsb |
| `goals_this_week` | Text area | Target/goals minggu ini untuk departemen tsb |
| **Add Task** | Aksi inline | Menambahkan satu atau lebih task langsung dari form notes — setiap task yang ditambahkan otomatis membuat entry baru di **Leader Task** (lihat 3.1.1) |

**Aturan uniqueness (diusulkan):** satu Leader Note per **user + department + tanggal** — mengikuti pola `UNIQUE(user_id, standup_date)` di Standup, ditambah dimensi department karena satu leader berpotensi mengisi catatan untuk lebih dari satu departemen (dropdown per-entry, bukan per-user tetap).

**Riwayat:** Sama seperti Standup — tab riwayat dengan filter departemen + rentang tanggal, dan filter user (untuk sesama C-Level/Super Admin saling melihat catatan).

#### 3.1.1 Linkage Notes → Task

Saat leader menekan "Add Task" di dalam form Leader Notes:
- Sistem membuat row baru di `leader_tasks` dengan `department` dan `created_by` yang diwarisi dari note tersebut, `status = 'todo'` default.
- Task tersebut disimpan dengan referensi balik `source_note_id` → task ini akan tampil baik di halaman Leader Notes (sebagai daftar kecil di bawah goals minggu itu) maupun di board Leader Task secara penuh.
- Leader Notes bisa berisi 0 atau banyak task pada saat pembuatan; task tambahan juga bisa ditambahkan belakangan dari halaman Leader Task langsung (tanpa `source_note_id`).

---

### 3.2 Leader Task

**Tujuan:** Task board level kepemimpinan per departemen — setara Backlog, namun scoped ke `department` alih-alih `product_id`.

**Tipe & struktur mengikuti kekayaan fitur Backlog** (sesuai keputusan produk untuk full Backlog-style richness):

| Field | Keterangan |
|---|---|
| `department` | HC / Sales / PMG / IT / Finance / Product — pengganti `product_id` |
| `code` | Auto-generate, mis. `HC-001`, `SLS-001` (prefix per departemen, pola sama seperti `PB-001` di Backlog) |
| `title`, `notes` | Judul & deskripsi task |
| `priority` | `critical / high / medium / low` — sama seperti Backlog |
| `status` | `backlog / todo / in_progress / in_review / done / blocked` — sama seperti Backlog |
| `story_points` | Opsional, skala 1–13 seperti Backlog, untuk task besar yang perlu breakdown |
| `assignee_id` | User yang mengerjakan |
| `deadline` | Tanggal target selesai |
| `parent_id` | Self-referencing, untuk breakdown task besar → sub-task (opsional, mengikuti pola hierarki Backlog) |
| `source_note_id` | Nullable FK ke `leader_notes` — diisi otomatis jika task dibuat dari Leader Notes |
| **Attachments** | Sama seperti Backlog — upload gambar/lampiran per task |
| **Activity & Comments** | Sama seperti Backlog — log perubahan + komentar dengan @mention |

**Catatan desain — Sprint:** Backlog menautkan item ke `sprints` per produk. Leader Task **tidak mengadopsi konsep Sprint** pada draft ini, karena task level departemen umumnya tidak dikerjakan dalam ritme sprint 2 mingguan seperti tim engineering. Jika ke depan dibutuhkan (mis. OKR per kuartal), ini bisa ditambahkan sebagai iterasi terpisah — **mohon konfirmasi apakah ini asumsi yang benar sebelum masuk ke tahap desain teknis/DB.**

**Filter:** departemen, status, prioritas, assignee, rentang deadline, pencarian teks — sama seperti Backlog.

**Akses:**
- **Tulis (CRUD):** Super Admin, Manager, PO, SME, Commissioner — lihat 2.2 untuk detail scope lintas/per-departemen
- **Lihat saja:** siapa pun dengan `department` yang cocok (mis. Developer/QA melihat task departemen IT), tidak bisa create/edit
- Task hanya terlihat dalam scope `department` milik user (kolom `users.department`, lihat 2.1) — tidak perlu tabel join terpisah seperti `user_products`, karena satu user hanya punya satu departemen

---

### 3.3 My Task (C-Level)

**Tujuan:** Tampilan personal — task dari Leader Task yang di-assign ke user yang login. Mengikuti pola **persis sama** dengan My Tasks yang sudah ada di Backlog:

- Tidak ada endpoint baru khusus — cukup `GET /api/leader-tasks?assignee_id=me`, sama seperti pola `GET /api/backlog?assignee_id=me` yang sudah ada.
- Bypass filter departemen — user yang di-assign tetap melihat tasknya walau tidak terdaftar di departemen tsb (mengikuti komentar eksplisit `"MyTask module uses assignee_id=current_user"` yang sudah ada di `BacklogController`).
- UI: reuse pola `MyTask.jsx` — stat cards, status tabs, slide-in detail panel — hanya sumber data yang berbeda.

---

## 4. Alur Kerja Utama

### Alur Leader Notes → Leader Task
```
Leader login → buka C-Level → tab Leader Notes
    → Pilih tanggal (default hari ini) & departemen (dropdown)
    → Isi Goals of This Week
    → Klik "Add Task" → isi judul task → task tersimpan ke Leader Task
      (bisa tambah lebih dari satu task dalam satu note)
    → Simpan Leader Notes
    → Task yang baru dibuat langsung muncul di board Leader Task
      dengan status 'todo' dan department terisi otomatis
```

### Alur Leader Task
```
Leader/Super Admin buka tab Leader Task
    → Lihat board task lintas departemen (atau difilter per departemen)
    → Assign task ke diri sendiri atau leader lain
    → Update status saat dikerjakan (todo → in_progress → done)
    → Task yang di-assign otomatis muncul di tab My Task milik assignee
```

---

## 5. Pertanyaan Terbuka Sebelum Desain Teknis

~~1. Scoping akses per departemen~~ — **Resolved**: `users.department` + role penulis (Manager/PO/SME/Commissioner/Super Admin), lihat Bagian 2.

Sisa yang masih perlu dikonfirmasi sebelum lanjut ke skema database & implementasi:

1. **Scope tulis lintas-departemen vs per-departemen** — Apakah Manager/PO/SME/Commissioner boleh menulis Leader Notes/Task untuk **semua** departemen (dewan C-Level lintas fungsi), atau tulisan mereka dibatasi ke `department` milik mereka sendiri saja (mis. seorang PO yang departmentnya PMG tidak bisa menulis untuk IT)? Draft ini berasumsi lintas-departemen — lihat 2.2.
2. **Sprint/periode untuk Leader Task** — Dikonfirmasi tidak pakai sprint dulu (lihat 3.2), tapi apakah perlu pengelompokan mingguan/bulanan agar Leader Task bisa dikaitkan balik ke Leader Notes minggu tsb secara otomatis (bukan hanya link manual per-task)?
3. **Siapa yang boleh assign ke siapa** — Task Leader Task bisa di-assign ke siapa saja (termasuk Developer/QA yang hanya punya akses lihat), atau hanya ke sesama role penulis (Manager/PO/SME/Commissioner)? Ini penting karena assignee otomatis melihat tasknya di tab My Task meski mereka sendiri tidak bisa membuat/mengedit task.
4. **Achievement/riwayat** — Standup punya tab Achievement (statistik konsistensi). Apakah Leader Notes butuh hal serupa (mis. tingkat kepatuhan pengisian notes mingguan per departemen)?
5. **SME & Commissioner — scope departemen mereka sendiri** — Kedua role baru ini menulis lintas departemen (per asumsi Q1), tapi apakah mereka juga perlu `department` sendiri untuk keperluan lain (mis. tampil di dropdown assignee suatu departemen tertentu), atau `department` mereka dibiarkan kosong/null karena sifatnya lintas-fungsi?

---

## 6. Referensi Desain Teknis (Rancangan Awal — Belum Dibuat)

Bagian ini murni referensi arah teknis untuk diskusi lanjutan — **belum ada migrasi/kode yang dibuat.**

### Tabel & kolom baru (rencana `migration_v10.sql`)
| Perubahan | Mengacu pada pola |
|---|---|
| `users.department` _(kolom baru)_ | Nullable VARCHAR/enum: HC, Sales, PMG, IT, Finance, Product. Default terisi otomatis untuk role `developer`/`qa` → IT dan `po`/`manager` → PMG saat migrasi; sisanya manual oleh admin |
| `roles` — 2 baris baru | **SME** dan **Commissioner**, permission `{"manage_leader_notes": true, "manage_leader_tasks": true}` — pola sama seperti seed role lain (`po`, `manager`) |
| `leader_notes` | `standups` + kolom `department` |
| `leader_tasks` | `backlog_items`, dengan `department` menggantikan `product_id`, tanpa `sprint_id` |
| `leader_task_attachments` | `backlog_attachments` |
| `leader_task_activities` | `item_activities` |

### Endpoint API (rencana, mengikuti konvensi existing)
```
GET/POST        /api/leader-notes            (+ /today, filter department/user_id/date range)
PUT             /api/leader-notes/:id

GET/POST        /api/leader-tasks            (filter: department, status, priority, assignee_id, search)
GET/PUT/DELETE  /api/leader-tasks/:id
PATCH           /api/leader-tasks/:id/status
GET/POST        /api/leader-tasks/:id/activities
GET/POST/DELETE /api/leader-tasks/:id/attachments
```
`My Task` tidak butuh endpoint baru — reuse `GET /api/leader-tasks?assignee_id=me`.

### Navigasi
Sidebar: satu section baru "C-Level" — muncul untuk **siapa pun dengan `users.department` terisi**, atau Super Admin (bukan lagi gated oleh satu role khusus). Di dalamnya 3 tab dalam satu halaman — mengikuti pola halaman Standup yang sudah pakai tab (Input/Riwayat/Achievement) — bukan 3 item menu terpisah. Tombol "Add Task"/edit di tab Leader Notes & Leader Task hanya tampil untuk role penulis (Manager/PO/SME/Commissioner/Super Admin); user lain (Developer/QA/dll.) melihat versi read-only.

---

## 7. Riwayat Perubahan

| Tanggal | Versi | Perubahan |
|---|---|---|
| 3 Agustus 2026 | 0.1 | Draft awal PRD C-Level Dashboard — belum diimplementasikan, menunggu konfirmasi bagian 5 |
| 3 Agustus 2026 | 0.2 | Revisi model akses: department jadi atribut `users` (bukan role baru tunggal); IT↔Developer/QA (view-only), PMG↔PO/Manager; hak tulis dibatasi ke role Manager/PO/SME/Commissioner/Super Admin (SME & Commissioner adalah role baru); HC/Sales/Finance/Product di-assign manual oleh admin |
