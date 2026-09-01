# 08 — Rencana Deploy: Rilis C-Level Dashboard (Agustus 2026)

> Dokumen ini adalah rencana untuk satu rilis spesifik (bukan panduan umum — lihat [04-deploy-steps.md](04-deploy-steps.md) untuk itu). Belum dieksekusi; ini draft untuk direview sebelum menyentuh production.

---

## 1. Cakupan Rilis

Commit terakhir yang terkonfirmasi jalan di production: `fc01524` (7 Juli 2026 pagi — lihat catatan insiden login hari itu). HEAD saat ini `ceaa669`, artinya **15 commit** menyusul belum ter-deploy:

| Area | Commit | Catatan |
|---|---|---|
| **Fitur besar** | `478b0c6` (PR #1) | C-Level Dashboard: Leader Notes, Leader Task, My Task |
| Skema DB | `migration_v9.sql` | Month Release Target + flag roadmap di tabel `features`/`product_roadmap` |
| Skema DB | `migration_v10.sql` | Kolom `users.department`, role baru `sme`/`commissioner`, tabel `leader_notes`/`leader_tasks`/`leader_task_attachments`/`leader_task_activities` |
| UI | `3e84583`, `919482b` | Redesign halaman login (light theme + background image) |
| Bersih-bersih | `fc01524` → `7b4ca47` | `office-server` ditambahkan lalu dihapus di hari yang sama — **kemungkinan besar prod masih punya container yatim `pt_office_server` menyala** dari percobaan itu (persis gejala yang ditemukan di stack lokal: container 7 minggu lalu, orphan) |
| Fix lainnya | `2c5ccf3`, `dc548df`, `ecbee7c`, `679e5eb`, `c6cba88`, `872c2e2` | Sprint progress, filter Backlog, Team Workload card, dll — non-breaking |
| Config | `e5e3cbe` | Upgrade Docker base image ke Java 21, fix expose port — **sudah termasuk** kalau prod terakhir jalan di `fc01524` (sebelum ini), jadi ini juga baru buat prod |

**Tidak ada** perubahan `.env.example` sejak rilis terakhir — tidak perlu variabel environment baru.

---

## 2. Pre-flight Check (wajib sebelum eksekusi apa pun)

Jangan lompat ke langkah deploy sebelum tiga hal ini dicek di server:

1. **DNS gap yang sudah pernah ditemukan** (lihat insiden 2026-07-07): resolver default (`127.0.0.53`, systemd-resolved stub) di host production **tidak bisa** resolve `github.com` / `registry-1.docker.io`, meski koneksi internet host sendiri baik-baik saja (via `8.8.8.8` langsung berhasil). Ini diam-diam mematahkan `git pull` dan `docker compose up --build`.
   ```bash
   resolvectl query github.com          # atau: getent hosts github.com
   ```
   Kalau gagal resolve → lihat opsi build di bagian 3 sebelum lanjut.

2. **Path project sebenarnya.** Dokumentasi lama (`04-deploy-steps.md`, `deploy.sh` message) menyebut `~/apps/product-tracker`, tapi lokasi aktual di host adalah:
   ```
   /home/ptapadm/powerade/productmanagement
   ```
   Pastikan `cd` ke path ini, bukan yang tertulis di dokumen lama.

3. **Drift git tree di prod.** Insiden lalu menemukan working tree di prod punya perubahan "untracked" yang ternyata sudah identik dengan commit yang belum di-`git pull`. Kemungkinan tim men-deploy dengan copy file manual, bukan `git pull`. Sebelum menimpa apa pun:
   ```bash
   git status
   git diff --stat
   ```
   Kalau ada uncommitted changes yang bukan hasil eksperimen lama, **jangan langsung `git pull`/timpa** — cross-check dulu isinya dengan yang ada di `main` sekarang.

---

## 3. Keputusan: Cara Build Image

Karena DNS di host kemungkinan masih bermasalah, ada dua opsi. **Pilih satu sebelum eksekusi** — ini keputusan infra, bukan sesuatu yang otomatis saya jalankan:

### Opsi A — Perbaiki DNS di host, lalu pakai alur `deploy.sh` standar
Perbaikan permanen (forwarder systemd-resolved) atau sementara (`/etc/hosts` pin ke IP GitHub/Docker Hub). **Butuh persetujuan eksplisit** — ini perubahan konfigurasi shared host, bukan sekadar redeploy aplikasi.
```bash
cd /home/ptapadm/powerade/productmanagement
git pull origin main
sudo docker compose down
sudo docker compose up -d --build --remove-orphans
```

### Opsi B — Build di lokal (DNS lokal beres), kirim image sebagai tar (Direkomendasikan)
Ini menghindari total masalah DNS di prod, dan cocok dengan pola yang tampaknya sudah dipakai tim (copy manual). Dijalankan dari mesin dengan koneksi normal (mis. laptop ini, yang staknya sudah pernah di-build tadi):
```bash
docker compose build backend frontend
docker save productmanagement-backend productmanagement-frontend -o release-ceaa669.tar
scp release-ceaa669.tar ptapadm@10.8.135.133:/home/ptapadm/powerade/productmanagement/
# kode sumber (untuk docker-compose.yml, backend/db/*.sql) tetap perlu disinkronkan —
# via scp/rsync folder project, bukan git pull, kalau opsi ini yang dipilih
```
Di server:
```bash
cd /home/ptapadm/powerade/productmanagement
docker load -i release-ceaa669.tar
sudo docker compose down
sudo docker compose up -d --remove-orphans   # tanpa --build, image sudah di-load
```

---

## 4. Sebelum Turun Container: Backup

Wajib, karena rilis ini membawa migrasi skema (v9, v10):
```bash
mkdir -p ~/backups
sudo docker exec pt_postgres pg_dump -U postgres -d product_tracker \
  > ~/backups/backup_before_clevel_$(date +%Y%m%d_%H%M%S).sql
```

---

## 5. Migrasi Database Manual

Volume Postgres di prod **sudah ada** (bukan fresh install), jadi mount `docker-entrypoint-initdb.d` di `docker-compose.yml` **tidak otomatis jalan** untuk file baru. Migrasi harus dieksekusi manual setelah container `db` naik:

```bash
sudo docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v9.sql
sudo docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v10.sql
```

> **Penting (dari DEVELOPMENT.md):** `migration_v10.sql` menambah kolom `users.department` yang di-query langsung oleh `JwtAuthFilter` di setiap request. Kalau migrasi ini terlewat, filter gagal diam-diam (exception tertangkap tanpa log) dan user akan kehilangan akses/menu tanpa pesan error jelas. **Jalankan migrasi ini sebelum, atau segera restart backend setelah**, container backend baru naik.

### ⚠️ JANGAN jalankan `seed_clevel.sql` di production
File ini eksplisit ditandai sebagai **data dummy untuk testing lokal** (user palsu `sarah@company.com`, `rian@company.com`, dll — semua password `1234`, dan task/notes contoh). Menjalankannya di prod akan mengisi database asli dengan akun dan data fiktif. Ini **tidak** termasuk dalam mount `docker-entrypoint-initdb.d` untuk volume yang sudah ada (aman secara default), tapi pastikan tidak ada yang menjalankannya manual "supaya ada contoh data".

### Follow-up manual: department untuk leader asli
`migration_v10.sql` hanya auto-map department untuk role yang sudah ada (`developer`/`qa` → IT, `po`/`manager` → PMG). User dengan peran HC/Sales/Finance/Product/Commissioner/SME yang sebenarnya **tidak** ter-mapping otomatis — perlu di-assign manual oleh admin (lewat UI manajemen user, atau `UPDATE users SET department=... WHERE email=...` kalau UI belum mendukung field ini). Ini keputusan bisnis (siapa leader di department apa), bukan sesuatu yang bisa saya asumsikan — konfirmasi ke pemilik produk dulu.

---

## 6. Verifikasi Pasca-Deploy

```bash
sudo docker compose ps        # semua service Up (healthy untuk db)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8500
sudo docker compose logs --tail=50 backend | grep -i "error\|exception"
```

- [ ] Login dengan akun admin asli berhasil (**jangan** asumsikan password default `1234` dari pesan `deploy.sh` — password hash asli di prod tidak diketahui persis, sama seperti temuan di stack lokal. Konfirmasi ke user yang punya akses admin prod.)
- [ ] Tidak ada container `pt_office_server` lagi (`docker compose ps` — kalau masih ada, jalankan `sudo docker compose up -d --remove-orphans` atau `sudo docker rm -f pt_office_server`)
- [ ] Menu/fitur lama (Backlog, Epic Board, Roadmap) masih normal — cek khususnya yang di-hit oleh `JwtAuthFilter` (hampir semua route terautentikasi)
- [ ] Tab **C-Level Dashboard** muncul dan bisa diakses oleh user dengan role yang sesuai
- [ ] `SELECT department FROM users;` menunjukkan hasil auto-mapping yang masuk akal untuk role developer/qa/po/manager

---

## 7. Rollback

Kalau ada masalah kritis setelah deploy:
```bash
sudo docker compose down
# restore DB dari backup di langkah 4
sudo docker exec -i pt_postgres psql -U postgres -d product_tracker < ~/backups/backup_before_clevel_<timestamp>.sql
# kembalikan image lama (kalau pakai Opsi B, image lama masih ada di `docker images` selama belum di-prune)
sudo docker compose up -d
```
Migrasi v9/v10 bersifat additive (kolom/tabel baru, tidak menghapus data lama) sehingga restore DB dari backup sebelum migrasi aman dilakukan.

---

## 8. Yang Masih Perlu Keputusan/Input User

1. Opsi A vs Opsi B di bagian 3 (perbaiki DNS vs build-lokal-kirim-tar)
2. Kredensial SSH ke `10.8.135.133` (tidak disimpan, diminta ulang tiap sesi)
3. Siapa leader asli per department (HC/Sales/Finance/Product) untuk di-assign setelah migrasi v10
4. Konfirmasi password admin prod yang berlaku saat ini (untuk verifikasi login pasca-deploy)
