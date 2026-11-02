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
