# Checklist Paritas Fitur — UI Original vs UI Revamp

Tujuan: memastikan semua fitur & fungsi versi **original** (commit `1ee9fbf`, sebelum revamp) masih ada dan bekerja di UI **baru** (branch `ui-revamp`, http://localhost:8500).

Legenda: ✅ sudah diuji otomatis & lulus · 🧑 perlu dites manual · ⚠️ catatan

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
