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
| 4 Agustus 2026 | 0.3 | **Diimplementasikan** (lihat Bagian 8): daftar departemen dipindah dari hardcode ke tabel `departments` yang bisa dikelola tanpa deploy kode; `users.department` (1 user = 1 departemen) diganti model many-to-many `user_departments` (1 user bisa lebih dari 1 departemen) — request tambahan dari mentor setelah draft 0.2 ditulis |
| 6 Agustus 2026 | 0.4 | **Diimplementasikan** (lihat Bagian 9): tab "Departemen" baru di Users & Roles untuk Tambah/Edit/Hapus departemen dari UI (sebelumnya endpoint backend saja, belum ada UI); assignment user→departemen dipindah dari form Tambah/Edit User ke form Edit Departemen, supaya semua pengaturan departemen terpusat di satu tab |
| 28 Agustus 2026 | 0.5 | **Diimplementasikan** (lihat Bagian 10): default akses C-Level Dashboard dipersempit ke role Super Admin & Commissioner saja — tier akses lihat-saja berbasis departemen (Bagian 2, 8) dihapus; permission baru `access_c_level`, bisa diberikan ke role apa pun lewat tab Roles & Permissions, memberi akses setara Commissioner |

---

## 8. Update Implementasi — Departemen Sebagai Config, Bukan Hardcode (4 Agustus 2026)

**Status: Diimplementasikan & sudah ditest lokal.** Bagian ini adalah addendum di atas draft 0.1/0.2 di Bagian 1–7 di atas (dipertahankan apa adanya sebagai riwayat) — bukan pengganti. Dua permintaan tambahan dari mentor setelah draft 0.2 selesai:

1. *"buat config khusus untuk divisi nya, jadi ga hardcoded"* — daftar 6 departemen (HC, Sales, PMG, IT, Finance, Product) yang di draft 0.2 diasumsikan sebagai konstanta tetap, sebetulnya perlu bisa dikelola sebagai data.
2. *"user bisa di assign ke divisi, jadi c-level hanya bisa liat yang dia masuk divisinya, mau di buat global juga gapapa"* — `users.department` di skema 0.2 (kolom tunggal, 1 user = 1 departemen) diperluas jadi bisa lebih dari satu departemen per user. Skema akses "global" (lihat semua departemen) tetap dipertahankan **by-role** seperti draft 0.2 (Manager/PO/SME/Commissioner/Super Admin) — dikonfirmasi tidak perlu mekanisme flag baru.

### 8.1 Perubahan skema DB (`migration_v11.sql`, setelah `migration_v10.sql`)

| Perubahan | Mengganti | Keterangan |
|---|---|---|
| Tabel `departments` baru | Konstanta hardcode di `DepartmentHelper.java` / `CLevel.jsx` / `Users.jsx` | `id, code, name, code_prefix, color, sort_order`. Diseed dengan 6 departemen existing agar behavior tidak berubah saat migrasi. `code_prefix` menggantikan `CODE_PREFIX` map (untuk auto-generate kode task `HC-001`, dst), `color` menggantikan mapping warna Tailwind hardcode di frontend. |
| Tabel `user_departments` baru | Kolom `users.department` (VARCHAR tunggal) | Many-to-many, pola identik dengan `user_products` yang sudah ada — `user_id, department_id`. Satu user bisa masuk lebih dari satu departemen. |
| `leader_notes.department` / `leader_tasks.department` | Divalidasi hardcode di kode Java | Tetap kolom VARCHAR (bukan FK id) supaya kode existing yang membandingkan by-code tidak perlu berubah, tapi sekarang punya **FK constraint** ke `departments(code)` — validitas dijamin di level DB, bukan cuma di app. |
| Kolom `users.department` | — | Di-drop setelah data lama dimigrasikan ke `user_departments`. |

### 8.2 Perubahan API (`backend-java`)

| Endpoint | Keterangan |
|---|---|
| `GET /api/departments` | List semua departemen (semua user login) |
| `POST/PUT/DELETE /api/departments` | CRUD departemen, dibatasi `super_admin` — pola identik `RoleController`. Delete ditolak kalau departemen masih dipakai `leader_notes`/`leader_tasks`. |
| `GET/PUT /users/{id}/departments` | Assign departemen ke user (`department_ids: [...]`) — pola identik `GET/PUT /users/{id}/products` yang sudah ada. |

`DepartmentHelper` (dipakai `LeaderTaskController`/`LeaderNotesController` untuk validasi & scoping) diubah dari static utility hardcode jadi Spring bean yang query tabel `departments`/`user_departments`. `visibleDepartments()` sekarang balikin **list** departemen (bisa lebih dari satu) untuk user view-only, bukan satu nilai — filter query juga diubah dari `department = ?` jadi `department IN (...)` supaya user dengan >1 departemen benar-benar melihat semuanya (bug laten di draft 0.2 kalau langsung dipakai untuk multi-departemen: hanya elemen pertama yang kepakai).

Login (`/api/auth/login`, `/api/auth/me`) sekarang mengirim field `departments` (array of code) menggantikan `department` (string tunggal) di response user.

### 8.3 Perubahan UI (`frontend`)

- **Users & Roles** (`Users.jsx`): field "Departemen" di form edit user — yang sudah ada dari draft 0.2 sebagai dropdown 1 pilihan — diupgrade jadi checkbox multi-select, pola identik section "Akses Produk" yang sudah ada di form yang sama. Ini satu-satunya tempat assignment user→departemen dilakukan.
- **C-Level Dashboard** (`CLevel.jsx`): daftar & warna departemen (dulu `const DEPARTMENTS` dan `DEPT_CLS` hardcode di file) sekarang di-fetch dari `/api/departments` sekali di komponen atas dan dibagikan ke semua tab lewat React Context (dipakai di banyak tempat: Leader Notes card, Leader Task table, Dashboard bar chart, dsb).
- **Sidebar**: visibility menu "C-Level Dashboard" (Bagian 6 draft asli) diubah dari `!!user?.department` jadi `!!user?.departments?.length`.

### 8.4 Yang sengaja TIDAK berubah dari draft 0.1/0.2

- Model akses **view vs write** di Bagian 2 tetap seperti draft asli: `department` (sekarang jamak) menentukan scope lihat, role (`WRITE_ROLES`: Manager/PO/SME/Commissioner/Super Admin) menentukan siapa yang boleh menulis lintas-departemen. Tidak ada flag "global" baru per-user.
- Pertanyaan terbuka di Bagian 5 (scope tulis lintas vs per-departemen, periode Leader Task, siapa boleh assign ke siapa, Achievement tab, department kosong untuk SME/Commissioner) **masih belum dijawab** — di luar cakupan update ini.

> **⚠️ Koreksi (lihat Bagian 9):** Poin pertama di 8.3 — *"field Departemen di form Tambah/Edit User... satu-satunya tempat assignment user→departemen dilakukan"* — sudah tidak berlaku sejak update 6 Agustus 2026. Assignment sekarang dilakukan dari tab Departemen, bukan form User. Sisa Bagian 8.1–8.2 (skema DB, endpoint API) tetap berlaku apa adanya.

---

## 9. Update Implementasi — Manajemen Departemen Terpusat di Tab Departemen (6 Agustus 2026)

**Status: Diimplementasikan & sudah ditest lokal.** Addendum di atas Bagian 8 (dipertahankan apa adanya sebagai riwayat) — dua permintaan lanjutan setelah update 0.3:

1. *"bisa add department dan edit department-nya... dipindah ke tab department jadi semua settingannya di tab, dan tetap jangan hardcode"* — CRUD departemen (create/update/delete) sebelumnya baru ada sebagai endpoint backend (Bagian 8.2), belum ada UI-nya sama sekali. Sekarang ada tab "Departemen" baru di halaman Users & Roles.
2. *"di form Tambah User ada department checkbox, itu dipindah ke tab department"* — checkbox assignment user→departemen yang didokumentasikan di 8.3 sebagai bagian dari form Tambah/Edit User dipindah ke form Edit Departemen, supaya satu tab menampung seluruh pengaturan departemen: buat/edit/hapus departemen **dan** kelola anggotanya.

### 9.1 UI baru: Tab "Departemen" (`Users.jsx`)

| Aksi | Detail |
|---|---|
| Tambah Departemen | Form: kode (immutable setelah dibuat), nama, prefix kode task, warna, urutan tampil. Memakai `POST /api/departments` (Bagian 8.2), tidak ada endpoint baru |
| Edit Departemen | Form sama minus kode (kode tidak bisa diubah setelah dibuat). Memakai `PUT /api/departments/:id` |
| Hapus Departemen | Ditolak (409) jika masih dipakai `leader_notes`/`leader_tasks` — behavior ini sudah ada sejak 8.2, baru sekarang ada tombolnya di UI |
| Kartu departemen | Grid card menampilkan nama, kode, prefix kode task, dan jumlah user anggota — dihitung client-side dari data `users` yang sudah di-load di halaman yang sama, tidak ada query count terpisah |

Tombol Tambah/Edit/Hapus dibatasi `super_admin` (disembunyikan untuk role lain) — pola sama seperti tab Roles & Permissions yang sudah ada di halaman yang sama.

### 9.2 Assignment user→departemen dipindah ke tab Departemen

Checkbox departemen di form Tambah/Edit User **dihapus**. Sebagai gantinya, form Edit Departemen (tab Departemen) punya section baru "Anggota Departemen" — daftar semua user dengan checkbox, tercentang jika user tsb sudah masuk departemen yang sedang diedit.

- **Endpoint tidak berubah** — tetap `PUT /users/{id}/departments` (Bagian 8.2), hanya dipanggil dari sisi form yang berbeda: tiap checkbox langsung memanggil API saat diklik (bukan menunggu tombol submit form seperti pola lama di form User), supaya keanggotaan banyak user bisa diatur satu per satu dari satu layar tanpa bolak-balik buka form tiap user.
- User baru yang dibuat lewat form Tambah User sekarang otomatis tidak masuk departemen manapun — admin assign departemen belakangan lewat tab Departemen.
- Section "Anggota Departemen" hanya muncul saat **edit** departemen (sudah punya `id`). Saat membuat departemen baru, section ini disembunyikan dengan pesan "Simpan departemen dulu untuk mengatur anggota" — karena endpoint assignment butuh `department_id` yang valid.

### 9.3 Yang sengaja TIDAK berubah

- **Tidak ada endpoint API baru** — seluruhnya reuse `GET/POST/PUT/DELETE /api/departments` dan `GET/PUT /users/{id}/departments` yang sudah didokumentasikan di 8.2.
- Skema DB (Bagian 8.1) — tidak tersentuh.
- Model akses view/write di Bagian 2 — tidak tersentuh.

> **⚠️ Koreksi (lihat Bagian 10):** Poin terakhir di atas — *"Model akses view/write di Bagian 2 — tidak tersentuh"* — sudah tidak berlaku sejak update 28 Agustus 2026. Tier akses lihat-saja berbasis departemen (Bagian 2.1, 8.4) dihapus; default akses sekarang dipersempit ke Super Admin & Commissioner saja. Bagian 8.1–8.2 dan 9.1–9.2 (skema DB, endpoint API, UI tab Departemen) tetap berlaku apa adanya — perubahan Bagian 10 murni pada lapisan otorisasi, bukan data departemen itu sendiri.

---

## 10. Update Implementasi — Default Akses Dibatasi ke Super Admin & Commissioner (28 Agustus 2026)

**Status: Diimplementasikan & sudah ditest lokal.** Addendum di atas Bagian 8–9 (dipertahankan apa adanya sebagai riwayat) — permintaan tambahan setelah update 9:

1. Secara default, hanya user dengan role **Super Admin** dan **Commissioner** yang boleh melihat dan mengakses seluruh fitur & inputan C-Level Dashboard — bukan lagi siapa pun yang kebetulan punya departemen ter-assign (perilaku Bagian 2.1/8 sebelumnya).
2. Role lain (Manager, PO, SME, atau role kustom apa pun) bisa diberi akses kembali lewat permission baru di tab Roles & Permissions, dengan level akses **setara Commissioner** (lintas departemen, lihat + tulis) — bukan tier lihat-saja per-departemen seperti model lama.

### 10.1 Perubahan kebijakan akses

| | Sebelum (Bagian 2, 8) | Sesudah (Bagian 10) |
|---|---|---|
| **Default write** (`WRITE_ROLES`) | `super_admin, manager, po, sme, commissioner` | `super_admin, commissioner` |
| **Default view** | Siapa pun dengan departemen ter-assign (`user_departments`) melihat departemennya sendiri, read-only | Tidak ada tier lihat-saja — role di luar Super Admin/Commissioner tidak melihat apa pun secara default |
| **Cara mendapat akses tambahan** | Otomatis lewat role sistem (Manager/PO/SME) atau assignment departemen | Eksplisit lewat permission `access_c_level` per role, di tab Roles & Permissions |
| **Level akses saat diberikan** | Bertingkat — tulis (5 role) vs lihat-saja per-departemen (sisanya) | Tunggal — setara Commissioner sepenuhnya (lintas departemen, lihat + tulis), tidak ada tier parsial |
| **Sidebar "C-Level Dashboard"** | Tampil untuk siapa pun dengan departemen ter-assign, atau Super Admin | Tampil untuk Super Admin/Commissioner, atau role dengan `access_c_level` |

Permission baru mengikuti pola JSONB `roles.permissions` yang sudah ada (lihat Bagian 2.2 untuk pola serupa `manage_leader_notes`/`manage_leader_tasks` yang sebelumnya didefinisikan di kode tapi tidak pernah punya UI toggle — sekarang digantikan satu key `access_c_level`):
```json
{ "access_c_level": true }
```

### 10.2 Perubahan kode

| File | Perubahan |
|---|---|
| `DepartmentHelper.java` | `WRITE_ROLES` dipersempit ke `{super_admin, commissioner}`; `canWrite()` cek `access_c_level` (menggantikan `manage_leader_notes`/`manage_leader_tasks` yang tidak pernah punya UI); `visibleDepartments()` disederhanakan jadi biner — `null` (semua departemen) jika `canWrite()`, `[]` (tidak ada) jika tidak, tanpa tier parsial |
| `CLevel.jsx` | `canWrite` di komponen utama memakai kondisi yang sama: `hasRole('super_admin','commissioner') \|\| hasPermission('access_c_level')` |
| `Sidebar.jsx` | Kondisi tampil menu "C-Level Dashboard" diubah dari `!!user?.departments?.length \|\| hasRole('super_admin')` menjadi kondisi yang sama seperti di atas; `show()` sekarang menerima `hasPermission` sebagai parameter tambahan |
| `Users.jsx` | Grup permission baru "C-Level Dashboard" ditambahkan di tab Roles & Permissions, ditempatkan setelah grup QA — satu item: `access_c_level` ("Akses C-Level Dashboard") |

### 10.3 Yang sengaja TIDAK berubah

- **Tidak ada migrasi/skema DB baru** — permission disimpan di kolom `roles.permissions` (JSONB) yang sudah ada sejak awal, sama seperti permission lain (`manage_backlog`, `manage_qa`, dst).
- **Tidak ada endpoint API baru** — otorisasi tetap lewat `DepartmentHelper.canWrite()`/`visibleDepartments()` yang sudah dipakai `LeaderNotesController`/`LeaderTaskController` sejak Bagian 8.
- Data departemen itu sendiri (tabel `departments`, `user_departments`, tab Departemen di Bagian 9) — tidak tersentuh. Perubahan ini murni di lapisan otorisasi C-Level, bukan pengelolaan departemen.
- My Task (Bagian 3.3) tetap bypass filter departemen untuk task yang di-assign ke user — tidak terpengaruh oleh perubahan ini.
