# Checklist Paritas Fitur — UI Original vs UI Revamp

Tujuan: memastikan semua fitur & fungsi versi **original** (commit `1ee9fbf`, sebelum revamp) masih ada dan bekerja di UI **baru** (branch `ui-revamp`, http://localhost:8500).

Legenda: ✅ sudah diuji otomatis & lulus · 🧑 perlu dites manual · ⬜ belum · ⚠️ catatan

## Cara pengujian otomatis (2 lapis)

1. **Banding langsung original vs baru** — UI original dijalankan di port lain dengan data & backend yang sama, lalu per halaman/tab/modal dibandingkan: tombol, kolom, label form, placeholder, opsi dropdown, 7 role × 14 route.
2. **Tes fungsional di UI baru** — Chrome headless mengklik UI sungguhan (buat/ubah/hapus), hasilnya diverifikasi lewat API. Semua data uji berawalan `ZZUJI` dan sudah dihapus.

## Hasil ringkas

- Banding struktur: **tidak ada fitur/tombol/kolom/field yang hilang**. Akses route 7 role identik (0 perbedaan).
- Tes fungsional: semua alur lulus. Kegagalan di tengah proses semuanya salah skrip tes (selector/label), bukan bug aplikasi, dan sudah diulang sampai lulus.
- Perubahan yang **disengaja** (bukan hilang): kolom *Kode* + *Tipe* di Backlog digabung jadi satu kolom *Item*; dropdown status/stage/sprint berubah jadi pill-menu; shortcut produk di sidebar; tampilan Board; Ctrl K; slider tema; titik presence.
- ⚠️ **Masalah lama (ada juga di original, bukan regresi revamp) — ketiganya sudah diperbaiki di branch ini:**
  1. **Test run tanpa memilih Sprint → gagal 500 "Internal server error"** (`sprint_id` dikirim `''`, backend `Long.parseLong("")`). Dengan Sprint dipilih berhasil.
  2. **Menghapus komentar di modal Backlog menutup modal** (perilaku sama di original).
  3. PRD 3.5 menulis kartu Kanban Sprint punya dropdown status inline — di kedua versi **tidak ada**; PRD yang usang.

## Status merge ke `main` (dicek 20 Nov 2026)

"Sudah di main" = kodenya sudah di-merge mentor ke branch `main`. **Belum tentu sudah di production**: deploy dan migrasi tetap lewat mentor (lihat butir 🧑 **Production** di tiap bagian).

| Bagian | Isi | PR | Status |
|---|---|---|---|
| §1–§17 | Paritas UI revamp + status presence | #18 (2 Nov 2026) | ✅ sudah di main |
| §18–§25 | Pagination & shortcut produk, Feature, Ctrl K menyeluruh, Type & Author tiket, lampiran Bugs/QA, status Epic/Story otomatis, toast kode baru | #21 (3 Nov 2026) | ✅ sudah di main |
| §26–§29 | Roadmap Testing, tempel Ctrl+V, Client Management, Impacted Features & Share link | #24 (12 Nov 2026) | ✅ sudah di main |
| §30 | Bugs per Feature | #26 (16 Nov 2026) | ✅ sudah di main |
| §31–§33 | Export MD, Deadline Bugs/QA, Progress % | #27 (17 Nov 2026) | ✅ sudah di main |
| §34–§35 | Bug Types, In Review tidak terlambat | #28 (17 Nov 2026) | ✅ sudah di main |
| §36 | Bug Stages + Buat Backlog dari Improvement | #29 (18 Nov 2026) | ✅ sudah di main |
| §37–§41 | Management Dashboard + Add Task, sort Roadmap + Related Card, bingkai terang + toggle tema, badge notifikasi tab, aksen merah dirapikan (PRD v3.26–v3.30) | #33 (20 Nov 2026) | ✅ sudah di main |
| §42 | Link antar kartu, bar progress selalu hijau, perbaikan form basi (PRD v3.31) | — | ⬜ belum di-commit, belum di main |
| §43 | Feature = master Roadmap, progress manual lewat status, progress produk = rata-rata Feature, `migration_v34.sql` (PRD v3.32) | — | ⬜ belum di-commit, belum di main (diuji user di lokal: oke) |
| §44 | Open Item hanya pekerjaan yang masih dikerjakan + diperbarui otomatis 30 detik (PRD v3.33) | — | ⬜ belum di-commit, belum di main (diuji user di lokal: oke) |

---

## 1. Login & Shell
- ✅ Login benar → Dashboard; password salah → tetap di /login
- ✅ Logout dari menu akun → /login
- ✅ Slider tema terang/gelap berpindah & tersimpan
- ✅ Command palette (Ctrl K): buka lewat tombol, cari item (HRS-2), Enter membuka halaman, Esc menutup
- ✅ Sidebar bisa disembunyikan/ditampilkan
- ✅ Menu per role identik dengan original (admin, manager, commissioner, SME, PO, dev, QA); selisih hanya shortcut produk baru
- ✅ Pencarian menyeluruh Ctrl K: halaman, aksi "… baru", dan semua record sesuai permission role (hasil uji lengkap: bagian 20)
- 🧑 Hotkey keyboard Ctrl+K sendiri, navigasi ↑↓ di palette
- 🧑 Tampilan terang & gelap di semua halaman, lebar layar kecil/tablet, hover/fokus
- 🧑 Sesi kedaluwarsa (token habis) → kembali ke login
- 🧑 Refresh halaman mempertahankan tema & status sidebar

## 2. Dashboard
- ✅ Kartu ringkasan, Team Workload, User Occupation, Delayed items, grafik velocity tampil
- ✅ Klik user / kartu statistik membuka panel drill-down item
- 🧑 Angka workload (kapasitas 20 pts) & occupation (80 jam, label Ringan/Normal/Padat/Overload) sesuai data
- 🧑 Klik batang velocity, tombol "Buka di Backlog" di panel

## 3. Backlog
- ✅ Buat Story / Task / Independent; validasi Task tanpa parent; Independent tanpa jam (HTML required)
- ✅ Dropdown parent berkotak pencarian; Story Points auto-cascade ke Story parent
- ✅ Edit lewat klik baris + tombol Perbarui; ubah status lewat menu; kontrol pindah sprint inline ada
- ✅ Komentar + @mention (dropdown, pilih dengan klik/Enter); hapus komentar sendiri
- ✅ Lampiran txt/csv/png: unggah, preview TXT, preview CSV sebagai tabel, hapus; Esc menutup preview saja
- ✅ Pencarian teks; chip Epic & ✅ Selesai; item done disembunyikan default; filter Assignee (cari + multi); deep link `?item=`; tombol Import Jira; tampilan Board
- ✅ Hapus Task/Independent/Story + toast "Item dihapus"
- ✅ Daftar item sama persis dengan original (23 dari 23, kode identik)
- ✅ Limit per halaman 10/30/50/100 langsung memuat ulang (lihat bagian 18)
- 🧑 Pindah sprint inline betul-betul dijalankan; filter Produk/Status/Prioritas/Tipe/range deadline
- 🧑 Lampiran PDF/Word/Excel/PowerPoint/ZIP (buka tab baru); batas 10 MB & tipe tidak didukung
- 🧑 Group Status: tutup/buka grup, tombol "Tambah item <status>" di header grup
- 🧑 Board: klik kartu membuka item, ikon status membuka menu
- 🧑 Ubah Tipe item (mis. Epic→Story) tidak menampilkan dirinya sebagai parent
- 🧑 Link "Buka di tab baru", sisip tautan di komentar
- ⚠️ Menghapus komentar menutup modal (sama dengan original)

## 4. My Tasks
- ✅ Daftar task developer tampil, ubah status inline, klik baris membuka panel detail
- ✅ Tab Aktif/Todo/In Progress/In Review/Blocked/Selesai/Semua identik dengan original
- 🧑 Tombol "Tandai selesai", filter pencarian, kartu statistik (Terlambat)

## 5. Epic Board
- ✅ Tambah Epic (popup), pencarian epic
- 🧑 Expand epic → story → task, progress bar, filter produk, "Buka di Backlog"

## 6. Sprints
- ✅ Buat sprint (nama, produk, goal, tanggal, kapasitas); pilih sprint; Kanban 5 kolom; burndown tampil
- ✅ Edit sprint (goal + status active); hapus sprint lewat konfirmasi
- 🧑 Mulai/selesaikan sprint, angka burndown vs ideal, Epic Overview expand
- 🧑 Sprint dengan nama sama di produk yang sama ditolak (toast)

## 7. Standup
- ✅ Kirim standup (developer), Riwayat, Achievement; Import CSV disembunyikan untuk Developer
- ✅ Import CSV (admin): baris valid diimpor, email tak dikenal masuk detail error
- 🧑 Edit standup hari ini; duplikat hari yang sama ditolak; blocker + rencana
- 🧑 Filter rentang tanggal & filter user (manager); angka Achievement
- 🧑 Import `.xlsx`/`.xls`; tombol Download Template

## 8. Products
- ✅ Buat/hapus produk; expand → buat Epic & Feature; form Tambah Item Roadmap terbuka
- 🧑 Edit produk, tautan Repo, warna, owner
- 🧑 Tab Roadmap: buat/edit/hapus item roadmap, filter
- 🧑 Assign member produk (scope akses Developer/QA)

## 9. QA Module
- ✅ Dashboard (kartu + grafik); buat test case (dropdown Backlog Item hierarkis + pencarian)
- ✅ Jalankan test (Pass, dengan Sprint) tersimpan; tab Test Runs menampilkan riwayat
- ✅ Export CSV (kolom Kode…Produk); Import CSV: baris valid dibuat, baris tanpa Backlog Item masuk error + modal Hasil Import
- ✅ Developer: Buat Test Case disembunyikan; QA: Buat Test Case + Run Test tersedia
- 🧑 Edit & hapus test case lewat UI; hasil Fail/Skip/Blocked; bug_reference
- 🧑 Filter produk di dashboard & grafik "Test Results per Sprint" (garis per produk)
- ⚠️ Run tanpa Sprint → 500 (masalah lama, lihat atas)

## 10. Bugs Incident
- ✅ Buat bug (kode `HRS-001`, Stage Awal improvement); Incident Author otomatis
- ✅ Stage lewat menu: Done mengisi `closed_at`, keluar dari Done mengosongkannya; bug Done tersembunyi default
- ✅ Update Progress + catatan; tab Progress memuat histori; komentar + @mention; lampiran gambar
- ✅ Sort header; Export CSV; Import CSV + modal Hasil Import; Dashboard (grafik tren, Recent Activity/Comments)
- ✅ QA & Developer punya akses; SME ditolak
- 🧑 Filter multi-select Stage/Severity/Prioritas/Assignee; produk; semua 6 kolom sort (3 klik: default → kebalikan → asli)
- 🧑 Toggle Mingguan/Bulanan/Tahunan: bentuk grafik & angka
- 🧑 Edit bug, hapus bug lewat UI, hapus lampiran bug, preview gambar penuh
- 🧑 Import CSV dari Excel "CSV UTF-8" (karakter non-ASCII)

## 11. Lapor Bug Publik (`/report-bug`, tanpa login)
- ✅ Form kosong tidak terkirim; kirim → tiket dibuat, kode tampil, auto-assign ke PO produk
- ✅ Jenis Improvement → stage improvement; pelapor tersimpan sebagai teks
- 🧑 Akses dari perangkat lain di jaringan kantor tanpa login; lampiran screenshot di layar kecil

## 12. C-Level Dashboard
- ✅ Dashboard (kartu + chip departemen); Leader Task: buat (kode prefix departemen), ubah status lewat menu, komentar
- ✅ Leader Notes + "Tambah" task turunan → task dibuat dengan `source_note_id`
- ✅ Commissioner punya tombol Tambah Task
- 🧑 Tab My Task; filter/riwayat Leader Notes (departemen, tanggal, user)
- 🧑 Edit & hapus Leader Task; lampiran; parent/sub-task; scope departemen per user
- 🧑 Notifikasi assignment Leader Task

## 13. Users & Roles
- ✅ Buat user (+ akses produk), user baru bisa login; edit; reset password; nonaktifkan → tak bisa login
- ✅ Roles: buat role + centang izin; Super Admin disabled; Departemen: buat
- 🧑 Edit role lalu cek efeknya di UI user lain; hapus role yang masih dipakai ditolak
- 🧑 Departemen: anggota, prefix kode, urutan; hapus permanen user lewat UI

## 14. Import Jira
- ✅ Pilih produk + CSV → preview → Mulai Import → 2 item dibuat
- 🧑 Export Jira nyata (kolom beda), hasil skip/error

## 15. Notification Settings
- ✅ Config dimuat (password tidak dikembalikan); Kirim Tes menampilkan hasil/galat dari server SMTP
- 🧑 **Simpan** config SMTP, toggle aktif, kirim tes sukses (pakai Mailpit http://localhost:8025)
- 🧑 Email nyata saat assignment / ganti status / mention; Teams webhook

## 16. Profil & Notifikasi
- ✅ Ubah nama profil (+ kembalikan); ubah password sukses; password lama salah ditolak; hint konfirmasi tak cocok
- ✅ Bell: badge belum dibaca, panel memuat penugasan, tandai semua dibaca, klik notifikasi membuka item (deep link)
- 🧑 Ganti warna avatar & email (duplikat ditolak) tampil langsung di header
- 🧑 Notifikasi mention & perubahan stage bug; tandai satu dibaca

## 17. Fitur baru (tidak ada di original)
- 🧑 Titik presence online/away/offline (perlu 2 browser/user)
- 🧑 Tampilan Board Backlog, tema gelap
- 🧑 Daftar produk di sidebar untuk QA Module & Bugs Incident (hasil uji otomatis: bagian 18)

## 18. Pagination & shortcut produk (ditambahkan setelah perbaikan)
Diuji otomatis (Chrome headless) dengan data dummy berawalan `ZZDUMMY`: Backlog 240 item, Bugs 150 + Progress 150, Test Case 150 + Test Run 150.
- ✅ **Backlog** — pilih 10/30/50/100 langsung memuat ulang tanpa menekan Group Status; 100 → 30 langsung; pager "1 / N" dan Next benar di mode 100
- ✅ **QA (Test Cases, Test Runs) & Bugs (Bugs, Progress)** — opsi baris sama seperti Backlog (10/30/50/100); 100 → 30 berubah seketika (±0,2 detik), 30 → 50 → 10 langsung, dari halaman 3 ganti ke 100 kembali ke halaman 1, dari halaman 2 (mode 100) ke 30 kembali ke halaman 1 (32 cek lulus)
- ✅ **Halaman melewati batas** — dari halaman jauh lalu ganti filter produk, tabel otomatis pindah ke halaman terakhir yang berisi data (sebelumnya "151–44 dari 44" kosong); 4 tabel lulus
- ✅ **Sidebar produk** — di `/backlog`, `/qa`, `/bugs` muncul daftar produk, klik memfilter lewat `?product=ID`, dropdown halaman ikut sinkron (12 cek lulus)
- 🧑 Cek manual di browser: 100 → 30 pada QA Module & Bugs Incident, filter produk dari sidebar, tema gelap
- ⚠️ Pilihan baris per halaman tiap halaman berdiri sendiri dan kembali ke default saat refresh; Standup & Users (10/50/100) dan My Tasks (10/20/50) belum disamakan

## 19. Kolom & dropdown Feature (QA Module, Bugs Incident)
Fitur baru setelah revamp (PRD 3.8, 3.9; `migration_v23.sql`). Diuji lewat API pada stack Docker lokal dengan data uji berawalan `ZZFEATTEST` (sudah dihapus setelah uji; jumlah bug/test case kembali seperti semula).
- ✅ **API list** — `GET /api/qa/test-cases` dan `GET /api/bugs` mengembalikan `feature_id`, `feature_code`, `feature_name` (`null` untuk data lama)
- ✅ **Create** test case dan bug dengan `feature_id` → tersimpan; `feature_id: ""` atau tanpa feature → `null` (opsional)
- ✅ **Update** — ganti feature, lalu kosongkan (`""`) → `null`
- ✅ **Validasi** — feature milik produk lain ditolak `400` di create dan update (test case dan bug)
- ✅ **Import CSV** (bugs dan test case) — kolom `Features` format `[KODE] Nama` dan kode saja terbaca; kode tidak dikenal atau kosong → feature kosong tanpa error
- ✅ Build frontend lolos; backend ter-compile lewat `docker compose build`
- ✅ Dicek manual di browser (pemilik, 2 Nov 2026): kolom **Features** muncul setelah *Item* di tabel Test Cases dan Bugs, `—` untuk data lama
- ✅ Dicek manual di browser (pemilik, 2 Nov 2026): form Buat/Edit, dropdown **Feature (opsional)** bisa dicari lewat kode produk (mis. `HRS`), kode feature, dan nama; opsi tersaring ke produk terpilih; ganti produk mereset Feature
- 🧑 Export CSV memuat kolom `Features`; round-trip export → import tidak error
- 🧑 Hapus sebuah feature di Products → test case/bug terkait tetap ada dengan Feature `—`
- ⚠️ Data lama tidak punya feature (tidak bisa diturunkan dari backlog item, relasinya ke roadmap); isi manual lewat Edit

## 20. Pencarian menyeluruh Ctrl K (branch `improvement-V2`, PRD 3.16 & v3.8)
Frontend saja (tanpa perubahan backend/database). Diuji otomatis (Chrome headless) pada dev server Vite dan ulang sebagai smoke test di container :8500, dengan data dummy lokal.
- ✅ **Hasil membuka form/detail yang benar** (admin): Backlog item, Bug, Test case, Produk, Epic produk, Feature, Roadmap, User, Role, Departemen → modal *Edit …* terbuka; Leader task → panel detail; Sprint → sprint terpilih di produk yang benar (dari halaman lain maupun dari `/sprints`)
- ✅ **Aksi "… baru"** (13 aksi: Backlog, Bug, Test case, Sprint, Produk, Epic, Roadmap, Leader task, User, Role, Departemen, Feature per produk, Epic produk) membuka form kosong; parameter `?new=` dihapus dari URL setelah dipakai
- ✅ **Permission per role** — admin, PO, developer, QA, manager, commissioner, SME: aksi dan grup hasil sama persis dengan izin role (0 pelanggaran); tidak ada toast error karena grup tak diizinkan tidak pernah diminta ke server
- ✅ **Deep link tanpa izin** — `?new=…` tidak membuka form bila role tidak punya izin buat; role yang hanya boleh melihat (mis. developer pada Test case/Produk/Roadmap) diantar ke halaman tanpa form
- ✅ **Memperbaiki bug lama**: link notifikasi `/bugs?bug=ID` kini membuka bug; memilih item/bug yang sama dua kali berturut-turut tetap membuka modal
- ✅ **Race Sprints** (ditemukan saat uji, sudah diperbaiki): respons `/products` yang datang belakangan tidak lagi menimpa produk dari deep link
- 🧑 Cek manual: tampilan palette di tema gelap & layar kecil, navigasi ↑↓ + Enter pada hasil campuran, role kustom dengan kombinasi izin tidak umum
- ⚠️ Test run, Standup (riwayat), dan Leader Notes tidak ikut dicari (tidak punya form/detail sendiri); tiap grup hasil dibatasi 5 baris (Backlog & Leader task 6)

## 21. Type tiket di Bugs Incident (bug / inquiry)
Fitur baru setelah revamp (PRD 3.9, v3.9; `migration_v24.sql`). Diuji lewat API dan Chrome headless pada stack Docker lokal dengan data uji berawalan `ZZTYPE` (sudah dihapus setelah uji; jumlah bug kembali seperti semula).
- ✅ **Migrasi** — `migration_v24.sql` dijalankan pada DB berisi data: semua bug lama otomatis `bug`
- ✅ **Create** tanpa `type` → `bug`; `type: "inquiry"` → `inquiry`; `type: "foo"` → `400`
- ✅ **Update** tanpa `type` tidak menimpa nilai tersimpan (inquiry tetap inquiry); `type: "bug"` mengubahnya; `type` tidak valid → `400`
- ✅ **Lapor Bug Publik** (`/api/public/bugs`) tanpa field type → tersimpan `bug` (form publik tidak berubah)
- ✅ **Import CSV** — kolom `Type`: `Inquiry / Clarification` → inquiry, `bug` → bug, kosong → bug; ketiganya dibuat tanpa error
- ✅ **UI** (Chrome headless) — kolom **Type** (badge) muncul setelah *Judul*, dropdown **Type (opsional)** di form Buat Bug (sebelah Stage Awal, default Bug), filter **Type** menyaring ke Inquiry / Clarification, form Edit memuat tipe tersimpan
- ✅ Build frontend lolos; backend ter-compile lewat `docker compose build`
- 🧑 Export CSV memuat kolom `Type`; round-trip export → import tidak error
- 🧑 Cek manual di tema gelap dan layar sempit (tabel Bugs makin lebar, scroll horizontal)
- ⚠️ Belum ada sort per kolom Type dan Type belum ada di form Lapor Bug Publik; label opsi di dropdown filter terpotong ("Inquiry / Clarificati…") karena lebar dropdown

## 22. Author tiket (QA Module, Backlog)
Fitur baru setelah revamp (PRD 3.2, 3.8, v3.10). Memakai `qa_test_cases.created_by` dan `backlog_items.created_by` yang sudah ada, tanpa migrasi; backend Backlog menambah `created_by_name` (JOIN `users`). Diuji di Chrome headless pada stack Docker lokal.
- ✅ **QA** — kolom **Author** di tabel Test Cases (setelah *Fail*, sebelum *Produk*); modal Edit Test Case tidak berubah
- ✅ **QA** — klik baris membuka modal detail/edit (admin dan QA); tombol Run Test tetap membuka modal Run (bukan form edit); developer (tanpa `qa.update`) klik baris tidak membuka apa pun
- ✅ **Bugs** — kolom Incident Author di tabel tidak berubah; modal Edit Bug tidak berubah
- ✅ **Backlog** — klik item membuka modal Edit dengan baris *Author: <nama> · <tanggal>* di paling atas; tabel Backlog tidak ditambah kolom
- ✅ `created_by` terisi di 160/160 test case dan 274/274 backlog item; build frontend dan backend lolos
- 🧑 Backlog: cek Author dari tampilan Board, item anak (Story → Task), dan deep link Ctrl K / notifikasi `?item=ID`
- 🧑 Backlog: item yang dibuat lewat Import Jira/CSV menampilkan user yang meng-import; user pembuat yang sudah dihapus tampil `—`
- 🧑 Export CSV QA memuat kolom `Author`; Import CSV QA mengabaikannya (Author = user yang meng-import)

## 23. Lampiran file di Bugs Incident dan QA Module
Fitur baru setelah revamp (PRD 3.8, 3.9, v3.11; `migration_v25.sql`). Diuji lewat API (curl) dan Chrome headless pada stack Docker lokal dengan data uji berawalan `ZZATT` (record dan file uji sudah dihapus; folder upload kembali seperti semula).
- ✅ **Bugs, tipe diterima** — `.docx` `.xlsx` `.pptx` `.pdf` `.txt` `.csv` `.zip` → 201 (MIME kosong/`octet-stream` tetap diterima lewat ekstensi, seperti Backlog)
- ✅ **Tipe ditolak** — `.exe` `.html` `.svg` → 400 pesan daftar format yang diizinkan (Bugs dan QA); sebelumnya Bugs menerima `image/svg+xml`
- ✅ **QA** — upload/list/hapus lampiran test case; `.docx` `.xlsx` `.pdf` 201; test case/bug yang tidak ada → 404 (bukan 500)
- ✅ **Izin** — developer (tanpa `bugs.access`/`qa.create`/`qa.update`) upload ke bug dan QA → 403, hapus → 403; QA engineer → 201
- ✅ **Unduh** — header `Content-Disposition` memakai nama asli file (`laporan.docx`, `data.xlsx`) untuk lampiran bug dan QA
- ✅ **Hapus** — `DELETE /api/bugs/attachments/:id` dan `/api/qa/attachments/:id` menghapus baris + file di disk; `DELETE /api/attachments/:id` kini khusus Backlog (id lampiran bug → 404, lampiran bug tidak ikut terhapus)
- ✅ **UI Bugs** — Buat Bug: pilih 3 file (docx/txt/csv) → tile + keterangan "diunggah setelah bug disimpan"; setelah disimpan dan dibuka lagi 3 tile ada; klik tile TXT → preview isi, Esc hanya menutup preview (modal bug tetap terbuka); tombol X menghapus; tile gambar tampil sebagai thumbnail dan preview gambar penuh layar (Esc hanya menutup preview)
- ✅ **UI QA** — Edit Test Case: unggah `.xlsx` → tile muncul dan toast sukses
- ✅ Build frontend dan backend lolos
- 🧑 Buat Test Case baru dengan file diantrekan lalu disimpan (jalur kode sama dengan Buat Bug, belum diklik langsung di UI)
- 🧑 Buka file Word/Excel/ZIP sungguhan dari tile (diunduh/dibuka di tab baru) dan preview PDF sungguhan
- 🧑 Form Lapor Bug Publik tetap hanya menerima gambar (tidak diubah)
- ⚠️ File >10MB lewat API tidak dibalas server (menggantung) — sama persis di endpoint Backlog lama; UI menolaknya lebih dulu dengan pesan "Ukuran file maks 10MB"
- ⚠️ Menghapus bug/test case ikut menghapus baris lampiran, tetapi file di disk tidak ikut terhapus (sama seperti Backlog/Bugs sebelumnya)

## 24. Status Epic & Story otomatis mengikuti anak
Fitur baru setelah revamp (PRD 3.2, v3.12). Backend saja (`BacklogController`), tanpa migrasi. Diuji lewat API (curl) pada stack Docker lokal dengan data uji berawalan `ZZ` (sudah dihapus setelah uji; item Backlog pengguna tidak berubah), lalu dikonfirmasi benar oleh pemilik lewat uji manual di halaman Backlog.
- ✅ **Naik** — Task `in_progress` → Story dan Epic `in_progress`; Task lain `in_review` → Story dan Epic `in_review` walau Task pertama masih `in_progress`; anak `todo` → Story dan Epic `todo`
- ✅ **Tidak mundur** — Task kembali ke `in_progress` (revisi) atau `backlog`: Story dan Epic tetap `in_review`
- ✅ **`done` butuh semua anak** — satu Task `done` (yang lain belum): Story/Epic tidak `done`; Task terakhir `done` → Story otomatis `done`, Epic belum selama Story/Bug lain belum `done`
- ✅ **Berantai satu aksi** — Bug terakhir `done` → Story `done` lalu Epic `done` sekaligus (Story dihitung sebelum Epic)
- ✅ **`done` menetap** — Task baru di Story `done` dan Task dibuka lagi: Story dan Epic tetap `done`; Epic yang diubah manual ke `in_review` tidak digeser lagi oleh anak yang `todo`
- ✅ **`blocked`** — anak `blocked` tidak menggeser induk; Epic `blocked` manual tidak ditimpa (Story di bawahnya tetap naik)
- ✅ **Semua jalur** — `PATCH /status` (dropdown), `PUT` (form Edit), `POST` (Task dibuat langsung `in_review`), Bug langsung di bawah Epic
- ✅ **Tanpa efek** — Epic tanpa anak tetap manual; item `independent` `in_progress` tidak error dan tidak mengubah apa pun
- ✅ **Log aktivitas** — Story dan Epic mencatat `Status diubah otomatis dari "…" menjadi "…" karena …`; tidak ada exception di log backend
- ✅ Build backend lolos (`docker compose build`, rebuild `--no-deps`)
- 🧑 My Tasks: ubah status Task lalu refresh — status Epic/Story induk baru terlihat setelah refresh (halaman Backlog langsung ter-update)
- 🧑 Board: geser kartu Task ke kolom In Progress / In Review / Done lalu cek Story dan Epic induknya
- 🧑 Setelah deploy ke server kantor: ubah status satu anak dari Epic yang sudah ada — Epic lama baru menyesuaikan saat anaknya berubah (data lama tidak dikoreksi otomatis)
- ⚠️ Hitung ulang hanya dipicu perubahan status atau pembuatan anak — ganti parent, hapus anak, atau Import Jira tidak memicunya
- ⚠️ Anak yang langsung `done` dari `backlog` belum menaikkan induk selama anak lain belum `done` (sesuai aturan: hanya `todo`/`in_progress`/`in_review` yang menaikkan)

## 25. Toast sukses create menampilkan kode baru
Fitur baru setelah revamp (PRD 3.2, v3.13). Frontend saja (`utils/createdToast.jsx`), tanpa migrasi dan tanpa perubahan backend. Diuji di Chrome headless (login admin) pada stack Docker lokal dengan data uji berawalan `ZZTOAST` (sudah dihapus setelah uji).
- ✅ **Backlog** (Tambah Item) — toast `Item HRS-103 ditambahkan`; kode sama persis dengan kode di database
- ✅ **Bugs Incident** (Buat Bug) — toast `Bug HRS-053 dibuat`; cocok dengan database
- ✅ **QA Module** (Buat Test Case) — toast `Test case TC-045 dibuat`; cocok dengan database
- ✅ **Epic Board** (Tambah Epic) — toast `Epic HRS-104 dibuat` (sebelumnya tidak ada toast); cocok dengan database
- ✅ Kode ditampilkan sebagai teks tebal monospace; toast masih terlihat setelah 4 detik (durasi 6 detik, bukan 3 detik bawaan)
- ✅ Build frontend lolos; hanya `pt_frontend` yang di-rebuild (`--no-deps`)
- 🧑 Kode yang diketik manual di form Backlog tampil apa adanya di toast; kode duplikat (409) tetap menampilkan toast error, bukan toast sukses
- 🧑 Cek tampilan toast di tema gelap dan layar sempit; buat item lewat tombol "+" di header grup Backlog dan lewat Ctrl K ("… baru")
- ⚠️ Toast edit ("Item diperbarui", dst.), toast error, dan hasil Import CSV/Jira (hanya jumlah) sengaja tidak diubah
- ⚠️ Di form Bug dan Test Case, toast baru muncul setelah lampiran selesai diunggah; bila unggah lampiran gagal, toast sukses tidak tampil walau item sudah tersimpan (perilaku lama, tidak diubah)

## 26. Status Roadmap "Testing"
Fitur baru (PRD 3.6, v3.14). Frontend saja (`Products.jsx`), tanpa migrasi dan tanpa perubahan backend.
- 🧑 Products → Roadmap: dropdown filter status memuat Planned, Research, On Progress, Testing, Active, Offline (urutan ini); ada 6 kartu ringkasan dalam satu baris di layar lebar
- 🧑 Edit satu item → ubah status ke Testing → simpan; badge amber "Testing" tampil di tabel dan kartu Testing bertambah 1
- 🧑 Klik kartu Testing → tabel terfilter ke item Testing; klik lagi → filter dilepas
- 🧑 Ctrl K: cari item roadmap berstatus Testing → hasil tampil dengan ikon status Testing dan membuka form edit
- 🧑 Layar sempit: 6 kartu tersusun 2 kolom tanpa terpotong
- ⚠️ Item roadmap yang dibuat otomatis dari Feature ("Tampilkan di Roadmap") tetap berstatus `planned`; status Testing diubah manual lewat tab Roadmap

## 27. Tempel lampiran dengan Ctrl+V
Fitur baru (PRD 3.2, v3.15). Frontend saja. Diuji di Chrome sungguhan (headless, login admin) pada stack Docker lokal lewat event paste berisi file PNG; data uji `ZZPASTE` sudah dihapus.
- ✅ **Lapor Bug Publik**: paste gambar → tile `screenshot-YYYYMMDD-HHMMSS.png`; nama file asli dipertahankan; paste file non-gambar ditolak dengan toast
- ✅ **Backlog (edit item)**: paste gambar → langsung tersimpan di server (`image/png`), tile tampil, file bisa dibuka kembali
- ✅ **Backlog (item baru)**: blok Lampiran kini ada; paste → tile antrean + petunjuk "diunggah setelah item disimpan"
- ✅ **Bugs Incident dan QA (record baru)**: paste → tile antrean
- ✅ Paste teks biasa, dan paste teks+gambar (mirip salinan sel Excel), **tidak** diambil alih — tetap tertempel sebagai teks
- ✅ Respons `POST /api/backlog` memuat `id` (dipakai untuk unggah antrean); build lolos; hanya `pt_frontend` di-rebuild (`--no-deps`)
- ✅ Diuji manual oleh pengguna: tempel screenshot sungguhan (Ctrl+V) berfungsi
- 🧑 Screenshot sungguhan (Win+Shift+S lalu Ctrl+V) di tiap form: Backlog edit, Backlog baru, Bug, Test Case, Lapor Bug Publik
- 🧑 Backlog baru: tempel gambar, isi form, **Tambah Item** → buka item tsb, lampiran harus ada; coba juga tanpa lampiran (tetap bisa disimpan)
- 🧑 Copy file (Ctrl+C di Explorer, mis. PDF/XLSX) lalu Ctrl+V di form → jadi lampiran; copy sel Excel lalu Ctrl+V di kolom Catatan → tetap teks
- 🧑 Item Backlog lama: lampiran lama tetap tampil, preview gambar/PDF/TXT/CSV dan hapus lampiran berfungsi seperti sebelumnya
- ⚠️ Paste hanya aktif saat form berlampiran terbuka dan tidak ada preview gambar/dokumen yang sedang tampil
- ⚠️ Tidak ada paste di kolom komentar (komentar hanya teks) dan di fitur Import CSV/Jira (bukan lampiran)

## 28. Client Management
Fitur baru (PRD 3.17, v3.16). Butuh `migration_v26.sql`. Diuji otomatis di stack Docker lokal (API dengan akun uji + Chrome sungguhan lewat Vite dev server); data uji berawalan `ZZTEST` sudah dihapus.
- ✅ API: validasi (nama bank/status wajib, akhir kontrak < mulai, tanggal tak valid 31 Feb, revenue negatif, status/produk tidak valid) → `400` dengan pesan jelas
- ✅ Permission: Developer `403`; PO bisa lihat+ubah+catat tapi `403` saat tambah; Manager/Super Admin penuh; PO `403` di pengaturan status
- ✅ Satu bank boleh punya dua baris (nama tidak unik); `PUT` tanpa `product_ids` tidak melepas produk; produk duplikat di body hanya tersimpan sekali
- ✅ Status: tambah/ubah/hapus; nama kembar `409`; hapus status yang dipakai client `409` dengan jumlah client; kode status dibuat dari nama
- ✅ Catatan: tambah (kosong ditolak), hapus catatan milik orang lain `403` bagi non-Super Admin, hapus milik sendiri berhasil
- ✅ FK: hapus user permanen tidak gagal (`pic_id` dan `client_comments.user_id` jadi NULL); migrasi dijalankan dua kali tanpa error; permission lain tidak tertimpa
- ✅ UI: pilih produk Sales CRM → PIC otomatis Citra (Product Owner-nya) beserta petunjuknya; tambah produk lain tidak mengubah PIC; revenue tampil `Rp 2.500.000.000`; baris, kartu status, filter, dan pencarian bekerja; catatan tampil di modal dan di kolom Update Terakhir
- ✅ UI: Ctrl K menemukan client dan membuka modal; deep link `?client=ID` dan `?new=1`; tema gelap; layar 390px; role view-only → modal baca-saja (semua input nonaktif, tanpa tombol simpan/kotak catatan); Developer tidak melihat menu Clients dan `/clients` menolak
- 🧑 Jalankan `migration_v26.sql` di database yang sudah ada (backup dulu), lalu login ulang. Menu **Clients** muncul untuk Super Admin, Manager, dan PO
- 🧑 Admin → Client Statuses: ubah warna/urutan status, tambah status baru, lalu cek kartu ringkasan dan dropdown di Client List
- 🧑 Tambah client sungguhan: pilih beberapa produk, ganti PIC manual lalu pilih produk lain (PIC tidak boleh berubah lagi), isi kontrak, simpan, edit lagi
- 🧑 Beri role lain (mis. QA) permission **Client Management → Akses** di Users & Roles: menu muncul dan modal baca-saja
- ⚠️ Revenue dihitung per kontrak dan **tidak dijumlahkan** di halaman (menjumlah client Approaching/Declined menyesatkan)
- ⚠️ Belum ada peringatan "kontrak hampir habis" dan belum ada Import Excel client (tidak diminta; bisa jadi tahap berikutnya)
- ⚠️ `docker-compose.yml` kini memasang v26 di initdb, jadi `docker compose up` berikutnya membuat ulang `pt_postgres` (data volume aman, hanya restart singkat)

## 29. Impacted Features (multi-feature) & Share link

- ✅ API: `PUT /api/backlog/{id}` `{feature_ids:[..]}` menyimpan banyak feature, `feature_id` lama = feature pertama; feature produk lain `400`; `feature_ids:[]` mengosongkan; `feature_id` tunggal (klien lama) tetap jalan; tanpa kedua field → tidak berubah; `POST` dengan `feature_ids` juga bisa; perubahan tercatat di log aktivitas (`Impacted Features: "A" → "A, B"`)
- ✅ DB: `migration_v27.sql` — 30 item lama ter-backfill ke `backlog_item_features`
- ✅ UI: field **Impacted Features** (dropdown checklist + pencarian + chip di bawahnya); tabel Backlog menampilkan feature pertama + badge `+N` (tooltip = daftar lengkap)
- ✅ Share link (otomatis, Chrome headless, 12 skenario): pengunjung belum login → `/login` → setelah login kembali ke `/backlog?item=ID` dan modal item terbuka; token kedaluwarsa → login ulang → kembali ke tujuan; tombol **Salin link** menyalin `http://host/backlog?item=ID` dan memunculkan toast, juga saat `navigator.clipboard` tidak ada (server http biasa); role tanpa izin edit membuka modal **Detail Item** baca-saja (field nonaktif, tanpa tombol Perbarui); path balik berbahaya (`//evil.example.com`) diabaikan
- 🧑 Jalankan `migration_v27.sql` di database yang sudah ada (backup dulu) **sebelum** backend baru naik, kalau tidak list/create/edit Backlog `500`
- 🧑 Cek tombol Salin link di: header modal — tombol merah bertuliskan "Salin link" (Backlog, Bugs, QA, Sprint, Produk/Epic/Feature/Roadmap, Client, Leader Task); lalu ikon kecil di baris tabel & kartu Board Backlog, kartu Kanban Sprint, header Sprint, baris Epic Board, My Task (baris & panel), panel Leader Task. Tempel link di tab baru → harus membuka record yang sama
- 🧑 Coba di server kantor lewat `http://IP-server`: tombol Salin link harus tetap menyalin (pakai fallback, bukan Clipboard API)
- 🧑 Buka link kartu Backlog (`/backlog?item=ID`) dan Bug (`/bugs?bug=ID`) yang punya banyak komentar: modal harus mulai dari **paling atas** (judul dan field terlihat), bukan di bagian Aktivitas. Daftar komentar tetap menampilkan komentar terbaru, dan setelah mengirim komentar daftar menggulung ke komentar baru tanpa menggeser modal
- ⚠️ Link ke record yang tidak boleh diakses role penerima: halaman terbuka tapi modal tidak (mengikuti izin modul); Backlog membuka detail baca-saja. `GET /api/backlog/{id}` tidak membatasi per produk (perilaku lama)
- ⚠️ Modul Users (user/role/departemen) sengaja tidak diberi tombol Salin link

## 30. Bugs per Feature (QA Dashboard & Bugs Dashboard)

Fitur baru (PRD 3.8 & 3.9, v3.19). Tanpa migrasi database. Diuji di stack Docker lokal (:8500) dengan akun dummy.

- ✅ API `/api/qa/dashboard`: role Manager, PO, Developer, QA, dan Super Admin menerima `bugOverviewAllowed: true` + `bugsByFeature`; SME dan Commissioner menerima `false` + array kosong (dashboard lain tetap jalan)
- ✅ Angka cocok dengan database: 13 bug = CRM-F1 2, HRS-F1 1, Tanpa Feature 10, dengan pecahan stage yang sama per baris; filter `product_id` hanya menampilkan feature produk itu
- ✅ API `/api/bugs/dashboard`: `byFeature` identik dengan `bugsByFeature` QA, `byProduct` tidak ada lagi; Developer (tanpa `bugs.access` di data lokal) tetap `403`
- ✅ UI QA, "Semua Produk": kartu di kolom kiri di bawah Overall Result Distribution, Recent Failures di kolom kanan
- ✅ UI QA, satu produk dipilih: Overall Result Distribution di samping grafik sprint; Bugs per Feature dan Recent Failures sejajar di baris berikutnya
- ✅ UI QA, role SME: kartu tidak muncul, layout lama (pie + Recent Failures) tetap
- ✅ UI Bugs Dashboard: grafik Bugs per Produk hilang, tabel Bugs per Feature 2/3 lebar + Distribusi Stage 1/3
- ✅ Header stage rata bawah dengan garis warna (sejajar walau label 1 atau 2 baris); nama feature tampil utuh di kartu setengah lebar (kode di atas, nama di bawah); dicek di tema terang dan gelap
- 🧑 Cek di server kantor dengan data asli: urutan baris, jumlah feature yang banyak (tabel harus scroll di dalam kartu dengan header dan baris Total tetap terlihat), dan baris "Tanpa Feature"
- ⚠️ Daftar role yang boleh melihat kartu di QA ditulis di kode (`BUG_OVERVIEW_ROLES` di `QaController`), belum bisa diatur dari Roles & Permissions. Role yang diganti nama atau role baru tidak otomatis ikut
- ⚠️ Nilai tabel bergantung pada pengisian field **Feature (opsional)** di form Bug; bug tanpa Feature masuk "Tanpa Feature" dan tidak ditebak dari Impacted Features backlog item (supaya tidak terhitung ganda)
- ⚠️ Baris diurutkan dari total bug terbanyak (termasuk yang sudah Done), bukan dari bug yang belum selesai

## 31. Export MD (paket data produk untuk AI)

Fitur baru (PRD 3.6 & 3.10, v3.20). Frontend saja; `migration_v28.sql` opsional (hanya permission). Diuji di stack Docker lokal dengan akun dummy: generator dijalankan di Node terhadap API asli, lalu Chrome headless lewat Vite dev server.

- ✅ Paket HRS sebagai Super Admin: 23 kartu Backlog tersusun Epic → Story → Task (anak di heading lebih dalam), 6 bug lengkap dengan riwayat progress, 4 test case dengan riwayat test run, tabel Roadmap/Product Features/Epic/Sprint, legenda dua jenis feature; 39 request, semua "silent" (tidak memunculkan toast error)
- ✅ PO (tanpa akses Bugs Incident): bagian Bugs diganti catatan "tidak disertakan", tidak ada request `403`, ringkasan menyebut alasannya
- ✅ Kasus pinggir (data buatan): rantai `parent_id` melingkar dan parent yang tidak ada → semua item tetap muncul tepat sekali; komentar multi-baris berawalan `#` tidak membentuk heading baru; `|` di sel tabel di-escape; mention `@[Nama]` jadi `@Nama`; riwayat yang gagal dimuat ditandai per kartu + catatan di header; pelapor publik tampil "(pelapor publik)" tanpa e-mail; entri otomatis tanpa user tidak menampilkan "—"
- ✅ UI (Chrome headless): tombol **Export MD** di setiap kartu produk untuk Super Admin dan PO, label berubah "Menyiapkan…" selama proses, file `PO-Tracker_HRS_<tanggal>.md` terunduh, toast "Paket HRS diunduh", tombol aktif lagi; Developer tidak melihat tombol
- ✅ Roles & Permissions: baris **Export MD → Paket Produk (.md)** tampil di matrix dan di kartu role; PO tercentang setelah `migration_v28.sql`; migrasi dijalankan dua kali tanpa error dan permission lain tidak tertimpa
- ✅ Dropdown Backlog Item di QA/Bugs memakai fungsi pohon yang sama (`flattenBacklogTree`), jumlah opsi tidak berubah
- ✅ Tabel Sprint: "Progress poin" dihitung dari kartu task/bug/independent dan sama dengan halaman Sprints (HRS Sprint 2 = 1 / 6). "Item per status" mencakup semua status termasuk `backlog` dan `in_review`. Angka committed/completed manual dari form sprint ditampilkan terpisah sebagai "Velocity manual" (dulu tertulis "Poin selesai 18", padahal yang benar-benar selesai baru 1 poin)
- ✅ Diuji dengan file hasil unduhan user: semua angka ringkasan, jumlah per status/tipe, kartu terlambat, susunan pohon, dan riwayat cocok dengan database lokal
- ✅ Uji keterbacaan AI (17 Nov): file HRS (±26 ribu karakter, ±8 ribu token) dibaca tanpa melihat kode lalu dipakai menjawab pertanyaan PO/QA/manager. Jumlah backlog dan 6 kartu terlambat, progress Sprint 2 (1 / 6 poin), TC-002 gagal → BUG-001, bug per feature Check-in via GPS (sama dengan kartu Bugs per Feature), dan 9 entri riwayat HRS-9 semuanya cocok dengan database
- ✅ Generator dijalankan sebagai PO dan Developer: bagian Bugs tertulis "tidak disertakan (tidak punya akses)", jadi AI tidak menyimpulkan produk bebas bug
- 🧑 Jalankan `migration_v28.sql` di database yang sudah ada (opsional, aman kapan saja), lalu refresh/login ulang: tombol muncul untuk Manager, PO, QA. Tanpa migrasi hanya Super Admin yang melihatnya
- 🧑 Export produk dengan data asli yang besar (ratusan kartu): progres "Mengambil komentar & aktivitas x/y" berjalan, file terunduh, lalu unggah ke Claude dan ChatGPT dan tanyakan hal seperti "kartu mana yang terlambat dan siapa assignee-nya?"
- 🧑 Centang/hapus **Export MD** untuk role lain (mis. Developer) di Roles & Permissions dan pastikan tombol muncul/hilang setelah refresh
- ⚠️ Riwayat diambil satu request per kartu Backlog/Bug (6 paralel); produk dengan ratusan kartu butuh beberapa detik sampai puluhan detik. Kalau nanti terasa lambat, opsi berikutnya adalah endpoint backend khusus export
- ⚠️ Permission `export.md` hanya mengatur tombol. Data di dalam file tetap dibatasi hak akses data biasa (produk yang ditugaskan, akses Bugs), jadi file tidak pernah berisi lebih dari yang bisa dilihat akun itu di aplikasi
- ⚠️ File berisi data internal kantor. Setelah diunduh, file tidak lagi dilindungi hak akses aplikasi, jadi perlakukan seperti dokumen internal saat dibagikan atau diunggah ke AI
- ⚠️ `docker-compose.yml` kini memasang v28 di initdb, jadi `docker compose up` berikutnya (tanpa `--no-deps`) membuat ulang `pt_postgres` (data volume aman, hanya restart singkat)
- ⚠️ "Kerjaan Andi apa saja?" → file menyebut 6 kartu, Backlog hanya 4. HRS-2-S1/S2 (dan CRM-3-S1/S2) hanya punya kolom `assignee_id` lama tanpa baris `backlog_item_assignees`; export memakai kolom lama sebagai cadangan, Backlog/My Tasks tidak. Di produksi sumbernya Import Jira (`ImportController` tidak menulis tabel assignee, lihat PRD 3.11)
- ⚠️ Kandidat perbaikan berikutnya: legenda belum menjelaskan dua arti **Epic** (tipe kartu vs Epic produk) dan **Bug** (tipe kartu vs tiket Bugs Incident); judul tiket bug dan test case belum berlabel tipe; belum ada tabel ringkas satu baris per kartu untuk produk besar

## 32. Deadline di Bugs Incident & QA Module

Fitur baru (PRD 3.8 & 3.9, v3.21). Butuh `migration_v29.sql` **sebelum** backend baru naik. Diuji di stack Docker lokal (:8500) dengan akun dummy: API lewat skrip Node, UI lewat Chrome headless. Data uji dihapus lagi (13 bug, 10 test case seperti semula).

- ✅ `migration_v29.sql` dijalankan dua kali tanpa error; kolom `deadline DATE` ada di `bugs` dan `qa_test_cases`, data lama `NULL`
- ✅ API Bugs & QA: create dengan deadline tersimpan `"yyyy-MM-dd"`, create tanpa deadline → `null`, edit mengganti, `""`/`null` mengosongkan, format salah (`besok`, `20-11-2026`, `2026/11/01`) → `400 Format deadline tidak valid (YYYY-MM-DD)`
- ✅ Edit **tanpa** field `deadline` (meniru browser yang masih memakai frontend lama) tidak menghapus deadline
- ✅ Ganti stage bug (Update Progress / dropdown Stage) tidak mengubah deadline
- ✅ Import CSV bug dan test case berisi kolom `Deadline` tetap jalan (deadline diabaikan, kosong)
- ✅ UI Bugs: kolom **Deadline** setelah Stage; tanggal lewat + stage Open merah dengan ikon dan tooltip "Lewat deadline"; tanggal mendatang abu-abu; bug **Done** dengan tanggal lewat tidak merah; bug tanpa deadline `—`
- ✅ UI Bugs: sort Deadline (klik pertama) → paling dekat dulu, tanpa deadline paling bawah
- ✅ UI Bugs: form Edit menampilkan deadline tersimpan, ubah tanggal → tabel ikut berubah dan tidak merah lagi; form Buat Bug dengan deadline → tampil di tabel. Assigned To dan Deadline bersebelahan
- ✅ UI QA: kolom **Deadline** setelah Status; tanggal lewat merah; deadline **hari ini** belum merah; test case lama `—`; form Edit menampilkan deadline, mengosongkan tanggal → `—`
- ✅ Export CSV Bugs dan Test Cases punya kolom `Deadline` (`yyyy-MM-dd`)
- 🧑 Jalankan `migration_v29.sql` di database server (backup dulu) **sebelum** backend baru naik, lalu cek Buat/Edit bug dan test case
- 🧑 Cek tampilan di tema gelap dan di browser dengan locale Indonesia (input tanggal tampil `dd/mm/yyyy`)
- ⚠️ "Merah" dihitung dari tanggal lokal komputer pengguna, jadi bergantung jam/tanggal komputer itu. Hari H deadline belum merah (Backlog sudah merah di hari H karena memakai `NOW()` di database)
- ⚠️ QA: merah tanpa syarat status, jadi test case yang sudah selesai dijalankan atau `deprecated` tetap merah bila tanggalnya lewat. Kosongkan deadline-nya kalau tidak relevan lagi
- ⚠️ Belum ada: Import CSV membaca deadline, deadline di Export MD, filter deadline, hitungan terlambat di dashboard, dan notifikasi pengingat
- ⚠️ `docker-compose.yml` kini memasang v29 di initdb, jadi `docker compose up` berikutnya (tanpa `--no-deps`) membuat ulang `pt_postgres` (data volume aman, hanya restart singkat)

## 33. Progress % otomatis (Backlog, My Task, Products, QA, Standup)

Fitur baru (PRD 3.2, 3.3, 3.6, 3.7, 3.8, v3.22). Semua angka **dihitung**, tidak ada input manual. Hanya Standup butuh `migration_v30.sql` (sebelum backend baru naik). Diuji di stack Docker lokal (:8500) dengan akun dummy: API lewat skrip Node yang menghitung ulang nilai harapan **secara independen dari baris database**, UI lewat Chrome headless. Semua data uji dihapus/dikembalikan (18 standup, 42 item Backlog, status item seperti semula).

- ✅ `migration_v30.sql` dijalankan dua kali tanpa error; `standups.progress` ada, standup lama `NULL`
- ✅ Backlog: 42 dari 42 item punya `progress` yang sama dengan hitungan independen (leaf dari status, Story/Epic = rata-rata item di bawahnya berbobot story point; contoh HRS-2 = 75%, CRM-3 = 50%); tetap benar pada halaman paginasi (`limit=3&page=2`); semua bilangan bulat 0–100; `GET /backlog/{id}`, POST, dan PUT ikut mengembalikan `progress`
- ✅ Ganti status langsung mengubah angka (HRS-7 `todo` → `done`: item 0 → 100, produk HRS 37 → 47), dikembalikan lagi → 37, tanpa nilai basi
- ✅ Products: HRS 37, CRM 31, FIN 54 (cocok dengan hitungan independen); menggantikan "% selesai" lama (30/27/38)
- ✅ QA: 11 test case cocok dengan run terakhir masing-masing (pass 100, fail 50, blocked 25, belum dijalankan/pending 0, `deprecated` tampil `—`)
- ✅ Standup: standup hari ini terisi otomatis hanya dari item **di sprint aktif** sesuai hitungan independen (Andi 45, Bella 65, Candra 50, Dimas 40) beserta rincian per status (`progress_detail`); Admin (6 item di-assign, 0 di sprint aktif) → kosong, bukan 100% seperti aturan cadangan versi pertama; muncul di list dan `/standups/today`; edit hari ini menyegarkan (Andi 45 → 70 setelah item selesai); list mengembalikan `prev_progress`/`prev_progress_date` dari standup terakhir yang punya progress (standup tanpa progress dilewati); standup tanggal mundur dan edit standup lama tetap kosong; user tanpa item → kosong tanpa error
- ✅ UI Backlog: kolom **Progress** setelah Status, 29 baris cocok dengan API; modal Story (HRS-2) menampilkan Progress baca-saja tanpa input; tampilan Board: 29 kartu punya bar
- ✅ UI Products: tiga kartu "Progress 37% / 31% / 54%", teks "% selesai" tidak ada lagi
- ✅ UI QA: kolom **Progress** setelah Deadline, semua baris cocok API; warna bar sesuai hasil run (fail merah, pass hijau, blocked kuning)
- ✅ UI My Task (Andi): kolom Progress cocok API; mengganti status di panel ke `done` mengubah progress di panel dan tabel jadi 100% tanpa muat ulang halaman
- ✅ UI Standup: standup dikirim dari form → tersimpan 45 → kartu di tab Riwayat menampilkan "Progress Pekerjaan 45%", **"▲ +15% sejak 16 Nov"** (dibanding standup sebelumnya 30%), dan keterangan **"dari 3 item sprint aktif: 2 in progress · 1 blocked"**; kartu standup lama tidak menampilkan bar
- ✅ Export MD: legenda menjelaskan Progress, produk dan 23 kartu Backlog dan 4 test case (bukan `deprecated`) mencantumkan Progress (28 field)
- 🧑 Jalankan `migration_v30.sql` di database server (backup dulu) **sebelum** backend baru naik, lalu cek halaman Standup (list, kirim, edit)
- 🧑 Cek di data asli: angka Products dan Epic/Story masuk akal; Story tanpa Task dihitung dari statusnya sendiri
- 🧑 Cek tema gelap (warna bar dan teks angka)
- ⚠️ **Angka progress Products berubah** dibanding "% selesai" lama karena rumusnya berbeda (item kerja, dibobot story point, In Progress/In Review dihitung sebagian). Bar persen di baris Product Features, Sprints, dan Epic Board **tidak diubah** dan bisa berbeda dari angka baru
- ⚠️ Karena dari status, item In Progress selalu 50% (tidak ada gradasi di dalam satu task); Blocked 25% tetap angka tebakan. Semua angka ada di satu tempat (`ProgressSupport`)
- ⚠️ QA: fail = 50% adalah pemetaan paling subjektif ("sudah dites, belum lolos"); warna merah menjaga supaya tidak terbaca sebagai kemajuan. Test case dengan beberapa run memakai run **terakhir** saja
- ⚠️ Tanpa item di sprint aktif, kartu standup tidak menampilkan bar (disengaja). Standup yang sudah tersimpan dengan angka dari aturan lama (mis. 100% dari item lama) tidak berubah sampai disimpan ulang
- ⚠️ Snapshot Standup memakai tanggal server (UTC) dengan toleransi 1 hari; standup yang tanggalnya lebih dari 1 hari dari hari ini tidak diberi progress. Isinya adalah angka **saat disimpan**, bukan angka hari itu bila diedit belakangan di hari yang sama
- ⚠️ Item yang di-assign hanya lewat kolom `assignee_id` lama (tanpa baris `backlog_item_assignees`, mis. hasil Import Jira, lihat PRD 3.11) tidak dihitung di Progress Pekerjaan Standup, sama seperti tidak tampil di My Tasks
- ⚠️ `docker-compose.yml` kini memasang v30 di initdb, jadi `docker compose up` berikutnya (tanpa `--no-deps`) membuat ulang `pt_postgres` (data volume aman, hanya restart singkat)

## 34. Type tiket Bugs Incident bisa diatur (Bug Types)

Fitur baru (PRD 3.9, v3.23). Daftar Type tidak lagi tetap `bug`/`inquiry`: Super Admin mengelolanya di **Admin → Bug Types**. Butuh `migration_v31.sql` (sebelum backend baru naik). Diuji di stack Docker lokal (:8500) dengan akun dummy: API lewat skrip Node/curl, UI lewat Chrome headless.

- ✅ `migration_v31.sql` dijalankan **dua kali** tanpa error; `bug_types` berisi `bug` dan `inquiry`, `bugs.type` menjadi `VARCHAR(50)` dengan FK `bugs_type_fkey`, CHECK lama hilang, 14 tiket lama tidak berubah (13 `bug`, 1 `inquiry`)
- ✅ Hak akses: `GET /api/bug-types` → Super Admin dan QA 200 (`bug_count` per Type), manager 403; `POST` sebagai QA → 403 "Hanya Super Admin"
- ✅ Super Admin menambah "Change Request" → 201, `code` otomatis `change_request` dan **tetap** walau namanya diganti; nama kembar (huruf besar/kecil beda) → 409
- ✅ Tiket: `POST /api/bugs` dengan `type: change_request` tersimpan dan response memuat `type_name`/`type_color`; tanpa `type` → `bug`; `type: nope` → 400; `PUT` dengan type tak dikenal → 400; `PUT` tanpa key `type` mempertahankan Type lama; mengganti ke `inquiry` bekerja
- ✅ Ganti nama Type → `GET /api/bugs` langsung menampilkan nama baru pada tiket yang memakainya
- ✅ Hapus: Type yang dipakai tiket → 409 "pindahkan tiket dulu"; Type `bug` → 409 (default); Type kosong → 200
- ✅ Import CSV kolom `Type`: nama ("Change Request"), code ("inquiry"), dan nilai asing ("garbage" → `bug`) menghasilkan Type yang benar (3 baris dibuat)
- ✅ UI Super Admin: menu **Admin → Bug Types** muncul; halaman menampilkan Type, kode, jumlah tiket, badge "default" pada Bug; tambah Type lewat modal berhasil (toast "Type ditambahkan"); tombol **Atur Type** ada di tab Bugs; dropdown **Type (opsional)** di form Edit memuat Type baru; hapus Type kosong lewat UI berhasil
- ✅ Data uji (tiket dan Type sementara) dihapus kembali; jumlah tiket kembali seperti semula
- ✅ Dites manual oleh pemilik di lokal (17 Nov 2026): fitur berjalan benar
- 🧑 Jalankan `migration_v31.sql` di database server (backup dulu) **sebelum** backend baru naik, lalu buka Bugs Incident, buat dan edit satu tiket
- 🧑 Login sebagai user non-Super Admin (mis. QA): menu Bug Types dan tombol Atur Type tidak tampil, `/settings/bug-types` ditolak, dropdown dan filter Type tetap berfungsi
- 🧑 Cek Export CSV (kolom `Type` berisi code), Export MD (Type berisi nama), dan form Lapor Bug Publik (tiket tetap `bug`)
- ⚠️ `code` Type dibuat otomatis dari nama dan **tidak pernah berubah** (itu yang disimpan di tiket dan Export CSV); mengganti nama hanya mengubah tampilan
- ⚠️ Type bawaan `bug` tidak bisa dihapus (dipakai sebagai default dan oleh Lapor Bug Publik), tetapi namanya boleh diganti. Type lain yang masih dipakai tiket juga tidak bisa dihapus
- ⚠️ Hanya Super Admin (`settings.update`) yang bisa mengubah daftar; user lain yang butuh Type baru harus meminta Super Admin
- ⚠️ `docker-compose.yml` kini memasang v31 di initdb, jadi `docker compose up` berikutnya (tanpa `--no-deps`) membuat ulang `pt_postgres` (data volume aman, hanya restart singkat)

## 35. Status In Review tidak dihitung terlambat

Fitur baru (PRD 3.1, 3.2, 3.3, 3.9, C-Level, v3.24). Item `in_review` yang melewati deadline tidak lagi merah dan tidak masuk hitungan Delayed. **Tanpa migrasi.** Diuji di stack Docker lokal (:8500): data dibandingkan sebelum dan sesudah, status bolak-balik pada item uji sementara, UI lewat Chrome headless.

- ✅ Sebelum → sesudah: Backlog `in_review` terlambat 3 → 0 (HRS-3, CRM-4, FIN-5); Dashboard Delayed 15 → 12 (HRS 6→5, CRM 5→4, FIN 4→3) dan daftar Delayed Items 15 → 12; Leader Tasks `in_review` terlambat 2 → 0; status lain (todo 5, in_progress 6, blocked 1) **tidak bergeser**
- ✅ Item uji dengan deadline lewat: `in_review` → `is_delayed=false`, `in_progress` → true, `in_review` → false, `blocked` → true; Delayed Dashboard tetap 12 saat item uji `in_review`
- ✅ UI Backlog: baris `in_review` tanggal abu-abu tanpa elemen merah; baris `in_progress` (HRS-2) tetap merah
- ✅ UI Bugs Incident: bug stage `ready_to_test` dengan deadline lewat tampil abu-abu; bug stage `open` tampil merah dengan ikon
- ✅ UI Dashboard: kartu Delayed menunjukkan 12, kolom Delayed per produk 5 / 4 / 3
- ✅ Data uji dihapus kembali (Backlog 42 item)
- ✅ Dites manual oleh pemilik di lokal (17 Nov 2026): berjalan benar
- 🧑 Cek di data asli: My Tasks (kartu Overdue), Epic Board, dan C-Level (Leader Tasks) tidak menandai item `in_review` sebagai terlambat
- 🧑 Deploy cukup rebuild backend dan frontend (tanpa migrasi)
- ⚠️ Bugs: stage `ready_to_test` diperlakukan sebagai padanan In Review (perbaikan selesai, menunggu QA) sehingga tidak merah; ini keputusan pemilik dan mengubah perilaku yang sudah ada. QA Test Case tidak berubah (tidak punya status in review)
- ⚠️ Story/Epic mengikuti status anak (maju saja): induk dengan satu anak `in_review` ikut `in_review` dan tidak merah, walau anak lain terlambat; anak yang terlambat tetap merah di barisnya sendiri
- ⚠️ Tidak diubah: klik angka Delayed per produk di Dashboard membuka semua item aktif (tidak difilter tanggal); Backlog merah sejak hari H sedangkan Bugs/QA setelah hari H lewat

## 36. Stage Bugs Incident bisa diatur + Buat Backlog dari tiket Improvement

Fitur baru (PRD 3.9, v3.25). **Butuh `migration_v32.sql`** (tabel `bug_stages`, FK `bugs.stage`, Type `improvement` bawaan, kolom `bugs.converted_backlog_id`). Diuji di stack Docker lokal (:8500) lewat API dan Chrome headless; data uji dihapus kembali.

- ✅ Migrasi pada DB lokal (backup dulu): 6 Stage bawaan tercatat dengan flag yang menjaga perilaku lama; Type `improvement` ditambahkan; semua tiket lama tetap valid
- ✅ Stage baru ("Waiting Client") bisa dibuat, dipakai tiket, tampil di dropdown stage tabel, filter Stage, tabel Bugs, pie Distribusi Stage, dan sebagai kolom kartu **Bugs per Feature** di Bugs Dashboard **dan** QA Dashboard
- ✅ Dashboard: kartu Open ikut menghitung Stage baru (10 → 13 saat ada 3 tiket tambahan), kembali ke angka semula setelah tiket uji dipulihkan
- ✅ Stage ber-flag selesai mengisi Tanggal Closed dan dihitung di Done / resolution rate; pindah ke Stage lain mengosongkannya
- ✅ Halaman **Admin → Bug Stages**: 6 Stage bawaan berlabel "bawaan" dengan tombol hapus nonaktif; tambah Stage lewat form (centang "Tidak dihitung terlambat") tersimpan dengan flag yang benar; QA tidak bisa membuat Stage (403)
- ✅ Stage bawaan tidak bisa dihapus (409), flag-nya tidak berubah lewat PUT; Stage yang dipakai tiket tidak bisa dihapus (409)
- ✅ Import CSV: kolom Stage berisi nama / code dikenali, nilai asing menjadi `open`
- ✅ Tombol **Buat kartu Backlog** muncul hanya di baris Type Improvement; klik → konfirmasi → toast "Kartu Backlog HRS-107 dibuat dari HRS-055" → tombol berganti penanda hijau "Sudah dibuat di Backlog: HRS-107"
- ✅ Penanda membuka dialog "Bug ini sudah dibuat di Backlog sebagai HRS-107" + tombol "Buka di Backlog" (`/backlog?item=ID`); form Edit Bug menampilkan banner yang sama
- ✅ Kartu hasil: story / backlog / tanpa sprint; judul, prioritas, deadline, dan **kedua** assignee disalin; notes memuat kode bug, deskripsi, langkah reproduksi, dan Feature
- ✅ Konversi kedua → 409; dua request serentak → satu kartu saja; Type bukan Improvement → 400; role tanpa `bugs.access` → 403
- ✅ Type `improvement` tidak bisa dihapus (409)
- 🧑 **Production:** jalankan `backend/db/migration_v32.sql` manual SEBELUM backend baru naik (lewat mentor); lalu rebuild backend + frontend
- 🧑 Cek di data asli: Type "Improvement" yang sudah dibuat manual di database kantor harus berkode `improvement` agar tombol Buat Backlog muncul (cek di Admin → Bug Types, kolom Kode). Jika kodenya lain, beri tahu saya
- ⚠️ Assignee yang disalin menerima notifikasi "Kamu di-assign ke PB-xxx" (dan pesan Teams) karena memakai alur create Backlog yang sama
- ⚠️ Stage Awal di form Buat Bug tetap hanya `open`/`improvement`; form Lapor Bug Publik tidak berubah (tiketnya bertype `bug`, jadi tidak mendapat tombol Buat Backlog sampai Type-nya diganti)
- ✅ Tombol **Buat Backlog** di header modal Edit Bug (kiri **Salin link**): ada untuk tiket Improvement (juga lewat link `/bugs?bug=ID`), tidak ada untuk Type `bug`
- ✅ Form diubah tapi belum disimpan → klik tombol header memunculkan toast "Simpan perubahan bug terlebih dahulu…", tanpa konfirmasi dan tanpa konversi
- ✅ Form bersih → konfirmasi (menyebut lampiran) → modal menutup, toast "Kartu Backlog … dibuat dari … (1 lampiran disalin)", baris tabel bertanda hijau; membuka ulang modal: header menampilkan "Di Backlog: PB-xxx" tanpa tombol Buat Backlog
- ✅ Lampiran bug ikut ke kartu (file fisik terpisah); catatan kartu memuat baris "Dilaporkan oleh"
- ⚠️ Feature bug (tabel `features`) tidak bisa ditautkan ke Impacted Features Backlog (roadmap); ditulis di notes kartu

## 37. Management Dashboard + Add Task di My Tasks

Fitur baru (PRD 3.3, 3.6, 3.18, v3.26). **Butuh `migration_v33.sql`** (riwayat status + trigger, `features.target_date`, `personal_tasks`, `weekly_snapshots`/`weekly_snapshot_items`, `open_item_remarks`, `weekly_notes`, permission `management_dashboard.view` termasuk role PO). Diuji di stack Docker lokal (:8500) lewat Chrome headless (CDP) sebagai Super Admin, Product Owner (Budi) dan Commissioner (Sarah), 19 Nov 2026.

- ✅ Migrasi pada DB lokal (backup dulu): dijalankan dua kali di DB percobaan tanpa duplikat; trigger task pribadi (completed_at terisi saat Done, kosong lagi saat dibuka ulang, riwayat status tercatat, hapus → riwayat ikut terhapus)
- ✅ Menu **Management** paling atas di Home; tidak tampil untuk Developer
- ✅ Header: pilihan Produk (Super Admin & Commissioner: Finance Dashboard, HRIS Portal, Sales CRM), "Data per …", tombol muat ulang
- ✅ **Sprint Aktif**: default sprint aktif ("HRS Sprint 2 · 14 Okt – 27 Okt 2026 (aktif)"), progress 59%, "1 dari 7 item kerja selesai", keterangan merah "Lewat 23 hari dari tanggal selesai"; pilihan "–" tersedia
- ✅ **Features**: kolom No / Feature / Status / Target / Progress; fitur Done = 100%; jumlah item Backlog terhubung tampil di bawah nama
- ✅ **Open Item · Minggu Ini** (label Live): 20 baris HRIS dari 4 sumber, chip filter per sumber dengan jumlah, ringkasan "20 terbuka · 0 selesai minggu ini · 7 lewat deadline"; task HRS-2-S2 menjorok di bawah HRS-2; Bug progress "—"; QA "Belum Dijalankan" + tanda draft
- ✅ Status bisa diubah di minggu ini (Backlog, Bug, My Task) untuk Super Admin; Commissioner hanya melihat (0 dropdown aktif) karena tidak punya izin ubah di modul asalnya; QA selalu baca-saja
- ✅ **Minggu Lalu** (versi awal, saat 4 minggu terakhir masih diestimasi): default "Minggu lalu · 9 – 15 Nov 2026 (estimasi)", badge **Estimasi**, tanpa dropdown status; memilih minggu tertua mengubah URL `?week=2026-10-26` dan isi tabel
- ✅ **My Tasks → Add Task**: tombol merah kanan atas; form Judul / Produk / Item Backlog terkait (26 opsi, bisa dicari) / Status / Deadline / Catatan + keterangan "bukan Backlog"; simpan → toast "Task ditambahkan", baris berlabel **Pribadi**, "HRS-2 terkait", tipe pribadi, prioritas & sprint "—"
- ✅ Task pribadi baru langsung muncul di Management Dashboard (sumber My Task, PIC Admin)
- ✅ **Detail Backlog → Task Pribadi Terkait**: item yang dirujuk task pribadi menampilkan panel info (judul, pemilik atau "Anda", deadline, status) di atas Aktivitas; item tanpa task terkait tidak menampilkan panel; catatan pribadi tidak ikut tampil; assignee dan progress item tidak berubah
- ✅ **Products → Features**: form Feature punya field **Target (tanggal)**; tanggal tampil di daftar feature dengan ikon target
- ✅ **Pilih produk dari sidebar:** saat di Management, sidebar Home menampilkan **Products** (Finance Dashboard, HRIS Portal, Sales CRM); klik Sales CRM → `?product=8` dan header ikut berganti; produk default juga tersorot. Dashboard dan My Tasks tidak menampilkan daftar produk; daftar Products di Planning/Quality tetap sama
- ✅ Pilihan Produk di header dan di **Add Task** sekarang dropdown + cari ("hris" → HRIS Portal, "sales" → Sales CRM); setelah memilih produk, Item Backlog terkait aktif
- ✅ Kartu **Minggu Ini**: judul "W47 · 16 – 22 Nov 2026 · Live"; kolom baru **PO Remarks**; ringkasan menambah "1 lewat ekspektasi"
- ✅ **PO Remarks** (Budi, Owner HRIS): klik "+ Isi remark" → popover Ekspektasi selesai + Keterangan (penghitung 0/300) → Simpan → sel menampilkan "27 Nov 2026" + keterangan, popover tertutup. Remark dari minggu lalu tampil dengan "dari W46"; tanggal lewat dan item belum selesai berwarna merah dengan "· lewat"
- ✅ **Catatan Product Owner** di bawah kedua tabel: "Tulis catatan" → isi → Simpan → teks + "Terakhir diubah oleh Budi Santoso · tanggal"; catatan minggu lalu tetap tampil saat minggu itu dibuka dan masih bisa diubah
- ✅ Kartu **Minggu Lalu**: chip filter sumber hilang, semua item tampil; chip **Minggu lalu W46 / 2 minggu lalu W45 / 3 minggu lalu W44 / 4 minggu lalu W43** (W43 nonaktif di data lokal karena produk dibuat 28 Okt); klik "2 minggu lalu" → `?week=2026-11-02`
- ✅ **Pencatatan mulai minggu ini** (keputusan mentor): data estimasi lama dihapus; kartu Minggu Lalu kosong dengan keterangan "Pencatatan mingguan dimulai W47 (16 – 22 Nov 2026); minggu sebelumnya tidak dicatat. Belum ada minggu yang selesai…", tanpa kalender/chip
- ✅ Simulasi awal pencatatan W46: chip "Minggu lalu W46" aktif, W45/W44/W43 nonaktif dengan keterangan "Sebelum pencatatan mingguan dimulai (W46)"; di kalender baris W44–W45 abu-abu dengan keterangan yang sama, legenda "Pencatatan dimulai W46 · 9 – 15 Nov 2026"
- ✅ **Pilih bulan & tahun** di kalender: dropdown Bulan (Januari–Desember) dan Tahun; pilih Februari → baris W5–W10 tanpa menutup kalender; kembali ke November, klik W46 → `?week=2026-11-09`
- ✅ **Kalender minggu** (tombol "W45 · 2 – 8 Nov 2026", diuji saat data estimasi masih ada): November 2026, baris W44–W49 dengan nomor minggu di kolom abu-abu kiri, W45 tersorot, W47 (minggu ini) dan sesudahnya abu-abu, hari ini dilingkari merah, nomor minggu Estimasi kuning; panah ke Oktober 2026 (W40–W45); klik baris W46 → `?week=2026-11-09`; Escape menutup
- ✅ Ganti minggu tidak membuat halaman melompat (tabel lama tampil pudar sampai data baru datang)
- ✅ Commissioner (Sarah): remark dan catatan terlihat, tetapi tidak ada tombol "Isi remark" maupun "Tulis/Ubah catatan"
- ✅ Tabel muat di layar 1440 px tanpa geser ke samping (judul item panjang dipotong, judul lengkap saat hover)
- ✅ Tidak ada error JavaScript di console selama uji
- 🧑 Cek dengan Owner produk di kantor: isi remark minggu ini, lalu Senin depan pastikan remark ikut ("dari W…") dan minggu lalu tetap menunjukkan remark lama
- 🧑 **Production:** jalankan `backend/db/migration_v33.sql` manual SEBELUM backend baru naik (lewat mentor); lalu rebuild backend + frontend. Saat backend pertama kali naik, minggu itu dicatat sebagai awal pencatatan; minggu sebelumnya kosong (tanpa estimasi)
- 🧑 Cek Senin berikutnya (23 Nov 2026): minggu yang baru lewat (W47) tersimpan otomatis tanpa label Estimasi dan muncul sebagai "Minggu lalu"; chip minggu dan tombol kalender muncul (2/3/4 minggu lalu nonaktif "Sebelum pencatatan mingguan dimulai"), dropdown Bulan & Tahun bisa dipakai, PO Remarks dan catatan W47 ikut tampil
- ⚠️ Riwayat status sebelum v33 adalah perkiraan dari log teks; perubahan status lewat jalur yang tidak menulis log (mis. import) hanya terlihat sebagai satu perubahan di `updated_at`
- ⚠️ Minggu beku menyimpan judul, PIC, dan deadline seperti saat dibekukan (tidak punya riwayat); status dan progress per akhir minggu
- ⚠️ Ditunda: kartu KPI, insight otomatis, grafik tren, panel roadmap, tombol bekukan manual

## 38. Sort & scroll tabel Roadmap + Related Card di Backlog

Fitur baru (PRD 3.2, 3.6, v3.27). **Tanpa migrasi.** Diuji 19 Nov 2026 di headless Chrome (Super Admin dan PO Budi) + API.

**Products → Roadmap**
- ✅ Lebar 1100 px dengan sidebar terbuka: tabel tidak lagi terjepit (sebelumnya "Absensi GPS" dan badge "On Progress" terlipat 2 baris, kolom Aksi terpotong); badge status satu baris dan tabel bisa digeser ke kanan sampai Aksi
- ✅ Lebar 390 px (HP): tabel digeser di dalam kartunya, halaman sendiri tidak melebar
- ✅ Klik **Fitur**: A–Z (panah naik, `aria-sort`), klik lagi Z–A, klik ketiga kembali ke urutan awal
- ✅ **Status** urut alur Planned → On Progress → Testing → Active (bukan abjad); **Versi** natural v1.0 → v1.3, kosong di bawah; **Target Rilis** turun Februari 2027 → …, kosong tetap di bawah; **Produk** A–Z
- ✅ Filter Produk "Sales CRM" + sort Fitur bekerja bersamaan; kartu ringkasan status tidak berubah
- ✅ Deskripsi dipotong satu baris, teks lengkap saat hover

**Backlog → Related Card**
- ✅ List: HRS-3 menampilkan chip merah 🐞1 + chip test case 1 di samping chip parent; tooltip "Related Card: 1 tiket Bugs Incident (1 masih open): BUG-001 · 1 QA test case"
- ✅ Item yang semua tiketnya closed (CRM-1, filter Selesai): chip bug abu-abu, tooltip "(semua closed)"
- ✅ Item tanpa relasi tidak punya chip; di detail section **Related Card (0)** tertutup, saat dibuka "Belum ada kartu terkait…"
- ✅ Klik chip → modal item terbuka dengan **Related Card (2) · 1 tiket masih open** sudah terbuka dan di-scroll ke tampilan: grup Bugs Incident (Type BUG, BUG-001, judul, Stage In Progress) dan QA Test Case (TC-002, hasil run terakhir Fail)
- ✅ Klik baris BUG-001 → `/bugs` dengan form tiket itu terbuka; baris test case menaut ke `/qa?case=2`
- ✅ Board: chip ada di baris di bawah judul (bersama chip parent); baris info kartu (prioritas · pt · deadline · avatar) tetap satu baris di 14 kartu yang punya chip
- ✅ Section lama (Tasks & Bugs, Aktivitas & Komentar) tetap tampil; Task Pribadi Terkait tidak berubah
- ✅ Mode gelap: chip, badge Type/Stage, dan teks section terbaca
- ✅ PO Budi (tanpa akses Bugs Incident): chip terlihat; di section, baris BUG-001 tampil tanpa link (tooltip "Butuh akses modul Bugs Incident…"), test case tetap bisa diklik
- ✅ **Diuji user di lokal (19 Nov 2026): oke**
- 🧑 **Production:** rebuild backend + frontend (lewat mentor); tidak ada migrasi
- ⚠️ Chip hanya bisa diklik oleh user yang boleh membuka/mengedit item dari daftar Backlog (aturan lama); user lain melihat chip sebagai penanda dengan tooltip

## 39. Bingkai terang ala ClickUp + toggle tema + aksen merah

Perubahan tampilan saja (PRD 3.16, v3.28; dibuat 18 Nov 2026, sebelumnya PR #30 yang ditutup, lalu ikut PR #33 bersama Management Dashboard). Tanpa perubahan backend/database.

- ✅ Top bar + icon rail abu terang (#F0F0F3), rail setinggi layar dengan logo PTAP di atas; sidebar per section dan area kerja putih
- ✅ Mode gelap: bingkai hampir hitam; warna bingkai diambil dari token `frame*`/`side` yang diganti tema
- ✅ HP: rail ikut masuk ke drawer
- ✅ Toggle tema: track amber (terang) / biru (gelap), ikon matahari dan bulan selalu terlihat, tooltip "Ganti ke mode …"
- ✅ Aksen merah: garis bawah tab aktif (Backlog, Products, QA, Standup, Users, Bugs, C-Level, My Task), bar progress merah dan hijau saat 100%, menu aktif sidebar merah muda + batang merah
- ✅ Tidak berubah: bar kapasitas Dashboard (hijau/kuning/merah), status/badge/prioritas, warna avatar
- ✅ Backlog: **Group: Status** di baris tab, tidak lagi terdampar di baris filter
- ✅ Dicek lewat screenshot headless Chrome (terang, gelap, HP) di Backlog, Products, Sprints, My Tasks

## 40. Badge notifikasi di tab browser (judul + ikon)

Fitur baru (PRD 3.13, v3.29). Frontend saja, **tanpa migrasi** dan tanpa perubahan backend; memakai polling `GET /api/notifications/unread-count` yang sudah ada (tidak ada request tambahan). Diuji 20 Nov 2026 di headless Chrome sebagai Dimas (developer), di Vite dev (StrictMode) dan di build Docker :8500. Notifikasi uji berawalan `[e2e] tab badge` dan sudah dihapus.

- ✅ 0 belum dibaca: judul tab tetap `Product Tracker — Internal Dev`, ikon tab logo biasa; halaman Login juga
- ✅ Notif baru masuk (tab dibiarkan): dalam ≤30 detik judul jadi `(1) Product Tracker — Internal Dev` dan ikon tab mendapat titik merah berangka; badge lonceng ikut 1
- ✅ Kembali ke tab PO Tracker: angka langsung diperbarui (±0,3 detik), tidak menunggu polling 30 detik
- ✅ 12 belum dibaca: judul `(12) …` (angka pas, maks `99+`), ikon tab `9+`; tidak ada awalan ganda `(1) (1)`
- ✅ Baca satu notif dari dropdown → `(11) …`; **Tandai semua** → judul dan logo kembali normal
- ✅ Pindah halaman (mis. ke Backlog) tidak menghapus angka
- ✅ Logout → judul dan logo kembali normal
- ✅ Polling gagal (backend mati/restart): tidak ada toast "Terjadi kesalahan" tiap 30 detik, angka terakhir tetap tampil
- ✅ Ikon tab terbaca di ukuran 16 px dan 32 px (dicek lewat screenshot); tidak ada error di console
- ✅ **Diuji user di lokal (20 Nov 2026): oke** — login Admin, bekerja di tab lain:
  - Budi (PO) meng-assign item → tab langsung menampilkan `(1) Product Tracker — Internal Dev` + titik merah di ikon; klik notif di lonceng → angka hilang
  - assignment + mention `@[Admin]` → `(2) …`; **Tandai semua** → judul dan logo kembali normal
  - data uji (item HRS-109, komentar, notifikasi) sudah dihapus
- ⚠️ Browser hanya mengizinkan web mengubah judul dan ikon tab (tidak bisa menaruh angka di kanan tab). Chrome memperlambat timer tab latar, jadi angka bisa muncul sampai ±1 menit setelah notif masuk; tab yang "ditidurkan" browser (Memory Saver Chrome / Sleeping Tabs Edge) baru diperbarui saat dibuka lagi
- 🧑 **Production:** rebuild frontend saja (lewat mentor); tidak ada migrasi

## 41. Aksen merah dirapikan: progress abu-abu, link merah saat hover, checkbox + highlight merah

Perubahan tampilan (PRD 3.16, v3.30). Frontend saja, **tanpa migrasi** dan tanpa perubahan backend. Aturannya: merah brand untuk identitas, navigasi, dan aksi; tidak untuk kondisi data, karena di sana merah berarti masalah. Diuji 20 Nov 2026 di headless Chrome sebagai Admin di Vite dev, mode terang dan gelap (warna dicek lewat `getComputedStyle`, bukan hanya screenshot).

- ✅ **Bar progress abu-abu, hijau saat 100%** — Board Backlog, Management (Sprint Aktif + Features), Products, Dashboard (kolom Progress), Sprints: isi bar `#6E7079` di mode terang, `#8E8F98` di mode gelap; fitur 100% (FIN-F1) hijau. My Tasks memakai komponen `ProgressBar` yang sama (data uji Admin hanya punya item 0%)
- ✅ Bar yang **tidak diubah** di kode dan tetap berwarna menurut artinya: hasil run QA (Pass hijau / Fail merah / Blocked oranye), kapasitas Dashboard (overload merah), kepatuhan Standup, bar Epic di Sprints (ungu, terlihat), bar status/departemen C-Level (terlihat)
- ✅ **Judul yang bisa diklik merah saat hover** (teks + garis bawah) — dicek dengan hover: judul fitur di Management, judul di My Tasks, label bar status di C-Level, sub-item dan Related Card (tiket Bug + test case) di detail Backlog CRM-3 (build Docker :8500, terang + gelap), tautan "Edit lengkap di Backlog" di panel item My Tasks → `rgb(215,31,43)` terang, `rgb(234,63,71)` gelap. Kelas yang sama dipasang di Open Item (Management) dan item/task/nama penulis catatan C-Level
- ✅ **Link merah saat hover**: link Repo di Products (dicek dengan hover, terang + gelap); URL dan link markdown di deskripsi/komentar (linkify) memakai kelas yang sama — belum di-hover karena data uji belum punya deskripsi/komentar berisi link
- ✅ Angka di tabel Cross-Project Overview Dashboard tetap berwarna status, hover hanya garis bawah (sisa hover biru di kolom To Do sudah disamakan)
- ✅ **Checkbox merah** bawaan browser: form Tambah Stage (Admin → Bug Stages) yang sebelumnya biru; `accent-color` root = merah brand di kedua tema
- ✅ **Highlight teks** saat diblok merah muda tipis (terang) / merah gelap (gelap), teks tetap terbaca
- ✅ `vite build` lolos; tidak ada error di console di 11 halaman (Dashboard, Backlog, My Tasks, Products, Sprints, QA, Standup, C-Level, Management, Bugs, Bug Stages) maupun saat membuka detail Backlog dan panel item My Tasks di build Docker :8500; tidak ada data yang diubah (form Tambah Stage tidak disimpan)
- ✅ **Diuji user di lokal (20 Nov 2026): oke** — progress abu-abu/hijau, hover merah, checkbox, dan highlight teks di mode terang dan gelap
- 🧑 **Production:** rebuild frontend saja (lewat mentor); tidak ada migrasi
- ⚠️ Warna bar progress diganti lagi di §42 (v3.31): kini **selalu hijau**, berapa pun persentasenya. Aksen merah lain di bagian ini tidak berubah

## 42. Link antar kartu yang berelasi + bar progress selalu hijau + perbaikan form basi

Fitur baru (PRD 3.2, 3.3, 3.5, 3.8, 3.9, 3.16, 3.18, v3.31). **Tanpa migrasi.** Backend hanya menambah kolom di SELECT dashboard (`recentFails` QA: `test_case_id`, `backlog_item_id`; `recentActivity`/`recentComments` Bugs: `bug_id`). Diuji 20 Nov 2026 di headless Chrome (CDP) di build Docker :8500 (sebagian juga di Vite dev) sebagai Admin, Manager, Developer (andi), dan user tanpa izin edit Backlog: **115 pengecekan, semua lulus** (kegagalan di tengah proses semuanya salah skrip tes, bukan bug aplikasi, dan sudah diulang sampai lulus). Setiap link diklik sampai kartu tujuannya benar-benar terbuka, bukan hanya dicek alamatnya.

**Backlog — parent ↔ anak**
- ✅ Epic HRS-100 terbuka dengan datanya sendiri, tanpa tombol parent, daftar Story-nya tampil
- ✅ Klik Story anak → modal menampilkan judul dan tipe **Story itu sendiri** (sebelumnya data Epic tertinggal, lihat "Form basi" di bawah); di samping Parent Epic ada tombol **↗ Buka HRS-100**
- ✅ Tombol Buka parent → Epic terbuka dengan datanya sendiri; `?product=7` tetap di URL; tanpa dialog bila form belum diubah
- ✅ Task → tombol ke Story HRS-101 → Story terbuka dengan datanya sendiri; Task tidak punya section anak
- ✅ Form diubah → konfirmasi sebelum pindah ke parent **maupun** anak; **Batal** tetap di kartu dengan isian yang diketik; isian dikembalikan ke nilai tersimpan → tanpa dialog; **OK** → pindah dan kartu tujuan menampilkan datanya sendiri
- ✅ Modal ditutup saat data parent masih dimuat → modal tetap tertutup (tidak muncul lagi)
- ✅ Tipe diganti sehingga Parent kosong (belum disimpan) → tombol parent hilang
- ✅ Chip parent di **List**: link dengan judul parent di tooltip; klik membuka HRS-100 (bukan HRS-104 di baris itu), `?product=7` tetap. Chip di **Board** juga membuka parent. Klik baris di luar chip tetap membuka HRS-104
- ✅ Modal **Detail Item** baca-saja (user tanpa izin edit): field nonaktif, tombol parent tetap bisa diklik, tanpa dialog; chip di daftar tampil sebagai penanda (bukan link)
- ✅ **Task Pribadi Terkait** milik sendiri → My Tasks membuka task itu; dengan form Backlog yang sudah diubah → konfirmasi dulu, Batal tetap di kartu

**My Tasks**
- ✅ Baris tabel: "HRS-9 terkait" → Backlog HRS-9 (bukan form task); kode parent "HRS-100" → Backlog HRS-100; klik judul tetap membuka panel detail
- ✅ Panel detail: kotak **Parent** membuka parent di Backlog
- ✅ Form Edit Task pribadi: tombol **Buka KODE** di samping Item Backlog terkait; form diubah → konfirmasi (Batal tetap di My Tasks dengan isian); tanpa perubahan → langsung ke item di Backlog
- ✅ `/my-tasks?ptask=ID` membuka form task pribadi itu; ID task orang lain / tidak ada → toast "Task pribadi tidak ditemukan — hanya pemiliknya yang bisa membukanya"

**Sprints**
- ✅ Kartu Kanban: judul adalah link ke item; klik badan kartu membuka item itu di Backlog
- ✅ Epic Overview: item di bawah Epic membuka item itu di Backlog

**QA Module**
- ✅ Form TC-001: **Buka HRS-2** → `/backlog?item=54`; Backlog Item diganti (belum disimpan) → tombol hilang; form diubah → konfirmasi, Batal tetap di QA dengan isian; OK → Backlog HRS-2 dengan datanya sendiri; form tanpa perubahan → langsung tanpa dialog
- ✅ Tombol **Buka** di samping Feature → Products membuka Edit Feature itu (diuji dengan test case sementara yang punya Feature, sudah dihapus; jumlah test case kembali 11)
- ✅ Tabel Test Cases: sel **Item** → Backlog HRS-2; sel **Features** → Products Edit Feature; baris test case tidak ikut terbuka
- ✅ Tabel Test Runs: setiap baris punya link Item yang membuka item yang cocok; judul test case membuka Edit Test Case
- ✅ QA Dashboard → Recent Failures: judul test case membuka Edit Test Case, kode item → Backlog
- ✅ Developer tanpa `qa.update` (andi): test case di Recent Failures dan Test Runs tampil sebagai teks biasa, link Item tetap ada dan membuka item di Backlog

**Bugs Incident**
- ✅ Form Bug: **Buka HRS-3** di samping Backlog Item → Backlog HRS-3 tanpa dialog bila belum diubah; form diubah → konfirmasi, Batal tetap; **Buka** di samping Feature → Products Edit Feature
- ✅ Tabel Bugs: sel Item / Features menaut ke tujuannya, bug di baris itu tidak ikut terbuka; klik Item membuka item Backlog
- ✅ Tab Progress: bug membuka Edit Bug; sel Item → Backlog item yang benar
- ✅ Bugs Dashboard: baris Recent Activity dan Recent Comments membuka bugnya (komentar uji sementara sudah dihapus)

**Management Dashboard**
- ✅ Open Item: task pribadi milik sendiri → My Tasks membuka task itu
- ✅ Manager melihat task pribadi Admin di Open Item **tanpa** link (hanya pemilik yang bisa membukanya)

**Tab baru**
- ✅ Ctrl+klik **Buka HRS-100** → kartu terbuka di tab baru, modal di tab asal tetap di HRS-101
- ✅ Ctrl+klik link Item di tabel QA → tab baru, halaman QA tetap

**Bar progress selalu hijau**
- ✅ Semua bar progress hijau (`emerald-500`) berapa pun persentasenya: Backlog list, My Tasks, QA Test Cases (fail/blocked dulu merah/kuning), Dashboard (progress produk), Products (produk + feature), Sprints (sprint + Epic yang dulu ungu), Management, Standup (tab Riwayat)
- ⚠️ Sengaja tidak diubah di kode karena bukan bar progress: kapasitas Dashboard (Team Workload / User Occupation), kepatuhan Standup, bar jumlah di C-Level, badge hasil run QA

**Form basi (perbaikan bug lama)**
- ✅ Masalahnya: membuka record lain saat modal masih terbuka (Ctrl K, link notifikasi, link antar kartu) membuat form tetap berisi record lama; bila disimpan, data lama menimpa record yang baru dibuka. Dibuktikan dulu (repro), lalu diperbaiki dengan `key` per record di 10 form
- ✅ Backlog Item, Test Case (TC-001 → TC-002 lewat `?case=`), dan Bug (pindah lewat `?bug=`): form menampilkan record yang baru dibuka
- ✅ Products: edit Feature, tutup, lalu **+ Feature** → form kosong; **+ Epic** → form kosong
- ✅ Users: `?new=user` / `?new=role` → form kosong; Edit User menampilkan user yang benar
- ✅ Repro pindah record A → B lewat deep link saat modal terbuka, 9 form: Produk, Epic, Feature, Roadmap, User, Role, Departemen, serta Client dan Leader Task (dua terakhir memang sudah benar) — semuanya menampilkan B

**Umum**
- ✅ Build frontend lolos; tidak ada error di console (hanya peringatan "future flag" React Router yang sudah ada sebelumnya)
- ✅ Data uji tidak berubah: tombol Simpan tidak diklik di form mana pun; test case dan komentar sementara sudah dihapus; tidak ada proses uji yang tertinggal
- ⬜ **Uji user di lokal** — klik tombol/link antar kartu di Backlog, My Tasks, Sprints, QA, Bugs, Management; cek bar progress hijau
- ⬜ Simpan sekali di salah satu form (mis. Edit Bug atau Edit Item) — perbaikan `key` tidak menyentuh kode simpan, tapi saat uji otomatis tombol Simpan sengaja tidak diklik
- 🧑 Tampilan HP (layar sempit) belum diuji untuk perubahan ini
- 🧑 **Production:** rebuild backend + frontend (lewat mentor); tidak ada migrasi. Urutan bebas: frontend baru dengan backend lama tetap jalan (Recent Failures / Recent Activity / Recent Comments tampil sebagai teks biasa sampai backend baru naik)
- ⚠️ Task pribadi hanya bisa dibuka pemiliknya (API `/api/personal-tasks` hanya mengembalikan task sendiri), jadi Super Admin pun tidak mendapat link ke task pribadi orang lain
- ⚠️ Sengaja tanpa link: Impacted Features di Backlog (feature roadmap; untuk viewer deep link-nya hanya pindah tab), field Sprint, produk di Client Management, parent Leader Task (tidak tampil di UI)
- ⚠️ User tanpa akses ke produk item melihat daftar anak kosong di detail item — aturan akses produk yang sudah ada, tidak diubah

---

## 43. Feature = master Roadmap + progress manual lewat status

Perubahan (PRD 3.6, 3.18, v3.32), sesuai arahan mentor: Backlog **tidak** menjadi sumber persen Products/Features/Roadmap (Impacted Features hanya label relasi), persen diatur manual lewat status (+20% per tahap), Roadmap mengikuti Products & Features. **Butuh `migration_v34.sql`** (lebar `features.target_release`, pemasangan data lama, indeks unik). Diuji 20 Nov 2026 di stack Docker lokal (:8500): migrasi di database salinan (data tiruan B-Mata dari screenshot) dan di DB lokal, 29 pemeriksaan API, uji kemandirian dari Backlog, dan Chrome headless.

**Migrasi — database salinan (11 item Roadmap B-Mata seperti screenshot + 4 Feature `v1.0`, plus kasus On Hold dan Offline)**
- ✅ Pratinjau (`migration_v34_preview.sql`, read-only) menampilkan: 4 pasangan baru (Fixed Income, Foreign Exchange, Money Market, Repo), 7 Feature baru `BMTFT-5`…`BMTFT-11`, status lama `in_progress`/`done` yang dirapikan, dan progress produk sesudah migrasi (**B-Mata 56%**)
- ✅ Hasil migrasi sama persis dengan pratinjau (BMT 56 · CRM 63 · FIN 47 · HRS 88)
- ✅ **Versi Roadmap dipertahankan:** BMTFT-1…4 kini `Q4-26` di Feature dan Roadmap; bulan rilis dan deskripsi Roadmap tidak hilang
- ✅ Roadmap Research → Feature Research (BMTFT-7, 9, 10, 11); Feature Not Started + Roadmap Offline → Feature Offline; Feature On Hold + Roadmap Testing → Roadmap tetap Testing (80%)
- ✅ Dijalankan dua kali: kali kedua 0 perubahan (idempotent)
- ✅ DB lokal: 20 Feature = 20 baris Roadmap, semua terhubung; ID baris Roadmap tidak berubah, kaitan Backlog tetap

**API (29 pemeriksaan, lulus semua; data uji dihapus kembali)**
- ✅ Feature tanpa kode → `HRSFT-n`, baris Roadmap Planned 20%; `GET /features` tidak lagi punya kolom poin Backlog
- ✅ Tiap tahap: Research 40 → In Development/On Progress 60 → Testing 80 → Released/Active 100 → Offline 100 → Not Started/Planned 20
- ✅ **On Hold** setelah Testing: Roadmap tetap Testing, progress tetap 80%, juga setelah edit lain; `GET /roadmap` membawa `feature_status` = on_hold
- ✅ Nama/versi/target tanggal mengikuti; edit Feature tanpa mengubah tanggal tidak menghapus bulan Roadmap
- ✅ Baris Roadmap terhubung: nama/status/versi/bulan dari request diabaikan, deskripsi tersimpan; DELETE → 409
- ✅ Tambah Item Roadmap (Research, `Q4-26`) → Feature Research 40%, versi `Q4-26`, tanpa target tanggal; Roadmap Offline → Feature Offline 100%
- ✅ **Progress produk = rata-rata Feature** (11 Feature HRS saat uji → 78%); Management Dashboard menampilkan progress yang sama per Feature, jumlah item Backlog tetap sebagai label
- ✅ Kode otomatis berurutan berbeda; kode kembar → 409; produk tidak dikenal → gagal bersih; hapus Feature → baris Roadmap ikut terhapus

**Kemandirian dari Backlog**
- ✅ Dua item Backlog yang mengaitkan HRS-F4 dijadikan `done` langsung di DB: Done 7 → 9, tetapi progress HRS-F4 (100%) dan produk HRS (88%) **tidak berubah**. Status item dan riwayat statusnya dikembalikan (hanya `updated_at` dua item dummy itu yang tersentuh trigger)

**Tampilan (Chrome headless)**
- ✅ Kartu produk: "Item Backlog: 25 · Done: 7 · Progress 88%" (label "Items:" lama hilang), tooltip menjelaskan rata-rata Feature
- ✅ Baris Feature: persen sesuai status, tooltip "Progress dari status … Tidak dihitung dari Backlog"; On Hold: "progress tetap di tahap terakhir"
- ✅ Form Feature: 7 status dengan keterangan persen (Research dan Offline baru), checkbox roadmap lama hilang, kode boleh kosong
- ✅ Roadmap: kolom **Progress** (bisa di-sort), kode Feature di bawah nama, penanda **ON HOLD** di samping status, banner menjelaskan aturan; tema gelap memakai palet oranye yang sudah dipetakan
- ✅ Management Dashboard: hint "Progress diatur lewat status fitur … tidak dari Backlog", "N item Backlog terkait (label, tidak memengaruhi progress)"
- ✅ **Uji user di lokal** (20 Nov 2026) — user menguji ubah status Feature, persen Feature/Roadmap/kartu produk, On Hold, dan Tambah Item Roadmap: oke
- 🧑 Tampilan HP belum diuji
- 🧑 **Production (lewat mentor):** (1) backup, (2) `migration_v34_preview.sql` → periksa bagian A–E, (3) `migration_v34.sql`, (4) rebuild backend + frontend. Migrasi harus SEBELUM backend baru naik
- ⚠️ Angka progress produk berubah karena sumbernya ganti (B-Mata 95% dari Backlog → 56% dari Feature); beri tahu PO
- ⚠️ Status Feature lama `in_progress`/`done` (seed/impor) diubah migrasi menjadi `in_development`/`released`

---

## 44. Open Item hanya pekerjaan yang masih dikerjakan + diperbarui otomatis

Perubahan (PRD 3.18, v3.33). **Tanpa migrasi** (backend + frontend). Diuji 20 Nov 2026 di stack Docker lokal (:8500): 21 pemeriksaan end-to-end (API + data sementara di DB, dibersihkan lagi) dan Chrome headless.

**Aturan yang tampil**
- ✅ Tiga produk (HRS 19, CRM 9, FIN 6 item): tidak ada satu pun item In Review / Done / Pass / Skip / Ready to Test / Stage tertutup, dan tidak ada baris "selesai minggu ini"
- ✅ Backlog: In Progress → **In Review hilang** → kembali In Progress **muncul lagi**; Done hilang; Blocked tampil
- ✅ Story In Review disembunyikan, task di bawahnya yang masih In Progress tetap tampil **tanpa menjorok**
- ✅ Bug: Ready to Test hilang → **Re-Open muncul lagi**; **Improvement tampil**; Done hilang
- ✅ QA: Skip hilang, Fail tampil, Pass hilang
- ✅ **Minggu Lalu** (minggu beku buatan, 12 baris campuran): hanya 6 yang masih dikerjakan tampil; task yang story-nya disembunyikan tanpa menjorok; **12 baris beku tetap utuh di database**
- ✅ Data uji dikembalikan: status asli, riwayat status sementara, run QA, progress bug, dan snapshot uji dihapus; `tracking_start` kembali

**Tampilan + real time (Chrome headless)**
- ✅ Ringkasan "19 terbuka · 7 lewat deadline" (tanpa "selesai minggu ini"); tidak ada label **Selesai**; hint kartu menjelaskan aturan dan pembaruan otomatis
- ✅ **Tanpa klik:** HRS-2 diubah ke In Review di luar halaman → hilang sendiri dari tabel setelah 24 detik (ringkasan 19 → 18); dikembalikan ke In Progress → muncul lagi setelah 30 detik
- ✅ **Uji user di lokal** (20 Nov 2026) — user menguji Open Item (item In Review/Done hilang, muncul lagi saat dibuka kembali, pembaruan otomatis): oke
- 🧑 Tampilan HP belum diuji
- 🧑 **Production (lewat mentor):** rebuild backend + frontend; tidak ada migrasi. Bila Stage "Closed" di kantor ditandai *dihitung open* oleh Super Admin, ia akan tampil — saat ini tidak, jadi tersembunyi
- ⚠️ Pembaruan otomatis paling lambat ±30 detik (polling, bukan push); hanya saat tab dibuka
- ⚠️ Bila baris yang sedang diisi PO Remarks-nya hilang karena statusnya diubah orang lain, editornya ikut hilang (remark yang sudah disimpan tetap ada dan muncul lagi bila item dibuka kembali)
