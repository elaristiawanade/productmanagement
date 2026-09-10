# Product Tracker — Cara Menjalankan Aplikasi

## Prasyarat

| Tool | Versi | Lokasi |
|------|-------|--------|
| Java | 21 | Pastikan `java -version` berjalan |
| Maven | 3.9.6 | `C:\tools\maven-extracted\apache-maven-3.9.6\bin\mvn.cmd` |
| Node.js | 18+ | Pastikan `node -v` berjalan |
| PostgreSQL | 13 | `C:\Program Files\PostgreSQL\13\bin\psql.exe` |

---

## 1. Database

Pastikan PostgreSQL sudah berjalan dan database `product_tracker` sudah ada.

```powershell
# Cek koneksi
& "C:\Program Files\PostgreSQL\13\bin\psql.exe" -U postgres -d product_tracker -c "SELECT version();"
# Password: 1234
```

Jika database belum ada, jalankan schema dan seed:

```powershell
$env:PGPASSWORD = "1234"
& "C:\Program Files\PostgreSQL\13\bin\psql.exe" -U postgres -c "CREATE DATABASE product_tracker;"
& "C:\Program Files\PostgreSQL\13\bin\psql.exe" -U postgres -d product_tracker -f "backend\db\schema.sql"
& "C:\Program Files\PostgreSQL\13\bin\psql.exe" -U postgres -d product_tracker -f "backend\db\seed.sql"
```

---

## 2. Backend (Spring Boot — Port 4000)

### Build

```powershell
Set-Location "d:\Local\PRODUCT INTERNAL APPS\product-tracker\backend-java"
& "C:\tools\maven-extracted\apache-maven-3.9.6\bin\mvn.cmd" clean package -DskipTests
```

Output JAR: `backend-java\target\product-tracker-1.0.0.jar`

### Jalankan

```powershell
Set-Location "d:\Local\PRODUCT INTERNAL APPS\product-tracker\backend-java"
java -jar target\product-tracker-1.0.0.jar
```

> **Penting:** Jalankan dari folder `backend-java` agar `application.yml` terbaca dengan benar.

Backend berjalan di **http://localhost:4000**

### Cek status

```powershell
Invoke-WebRequest -Uri "http://localhost:4000/api/products" -UseBasicParsing
# Harus mengembalikan 401 (belum login) — artinya backend aktif
```

### Stop backend

```powershell
Get-Process -Name java | Stop-Process -Force
```

---

## 3. Frontend (Vite — Port 5173)

### Install dependencies (hanya pertama kali)

```powershell
Set-Location "d:\Local\PRODUCT INTERNAL APPS\product-tracker\frontend"
npm install
```

### Jalankan development server

```powershell
Set-Location "d:\Local\PRODUCT INTERNAL APPS\product-tracker\frontend"
npm run dev
```

Frontend berjalan di **http://localhost:5173**

---

## 4. Urutan Start yang Benar

1. Pastikan **PostgreSQL** sudah berjalan
2. Start **backend** terlebih dahulu (tunggu sampai log menampilkan `Started ProductTrackerApplication`)
3. Start **frontend**
4. Buka browser ke **http://localhost:5173**

---

## 5. Login Default

| Email | Password | Role |
|-------|----------|------|
| admin@company.com | password | Super Admin |
| budi@company.com | password | Manager |
| citra@company.com | password | Product Owner |
| andi@company.com | password | Developer |
| rafi@company.com | password | QA Engineer |

---

## 6. Jalankan Sekaligus (PowerShell — dua terminal)

**Terminal 1 — Backend:**
```powershell
Set-Location "d:\Local\PRODUCT INTERNAL APPS\product-tracker\backend-java"
java -jar target\product-tracker-1.0.0.jar
```

**Terminal 2 — Frontend:**
```powershell
Set-Location "d:\Local\PRODUCT INTERNAL APPS\product-tracker\frontend"
npm run dev
```

---

## 7. Migrasi Database

Jika ada pembaruan skema, jalankan file migrasi secara berurutan:

```powershell
$env:PGPASSWORD = "1234"
$psql = "C:\Program Files\PostgreSQL\13\bin\psql.exe"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v2.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v3.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v4.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v5.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v6.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v7.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v8.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v9.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v10.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v11.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v12.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v13.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v14.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v15.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v16.sql"
& $psql -U postgres -d product_tracker -f "backend\db\migration_v17.sql"
```

> **Penting:** `migration_v10.sql` menambahkan kolom `users.department`, yang di-query
> langsung oleh `JwtAuthFilter` pada setiap request terautentikasi. Jika migrasi ini
> belum dijalankan setelah `git pull`, filter tersebut akan gagal secara diam-diam
> (exception ditangkap tanpa log) dan request akan diperlakukan seolah tidak login —
> gejalanya berupa tombol/menu yang hilang tanpa pesan error yang jelas.
>
> Untuk stack Docker: `docker-entrypoint-initdb.d` hanya jalan sekali saat volume
> Postgres pertama kali dibuat, jadi `docker compose up --build` pada volume yang
> sudah ada TIDAK otomatis menjalankan migrasi baru. Jalankan manual:
> ```bash
> docker exec -i pt_postgres psql -U postgres -d product_tracker < backend/db/migration_v10.sql
> ```

---

## 8. Notifikasi Email (Testing Lokal)

Fitur Notifikasi Email (lihat PRD 3.13 & 3.14) dikonfigurasi lewat halaman **Notification Settings**
di aplikasi (Super Admin only) — bukan lagi cuma lewat `.env`. Config tersimpan di tabel `app_settings`
dan aktif langsung tanpa restart backend.

**Testing tanpa akun SMTP asli (Mailpit):**

Stack Docker (`docker-compose.yml`) menyertakan service `mailpit` — SMTP catcher lokal, tidak butuh
kredensial apa pun. Setelah `docker compose up`, buka halaman Notification Settings dan isi:

| Field | Nilai |
|---|---|
| SMTP Host | `mailpit` |
| Port | `1025` |
| SMTP Auth | tidak dicentang |
| STARTTLS | tidak dicentang |

Simpan, lalu pakai tombol **Kirim Email Tes** — hasilnya bisa dilihat di **http://localhost:8025**.
Email dari trigger asli (assignment, status/stage berubah, mention) juga akan muncul di sana selama
config mengarah ke Mailpit.

Untuk SMTP asli (mis. Office365/Outlook), ganti Host/Port/Username/Password/From lewat halaman yang
sama, dan aktifkan kembali SMTP Auth + STARTTLS. Kalau autentikasi ditolak dengan pesan
`SmtpClientAuthentication is disabled for the Mailbox`, itu bukan bug — Microsoft mematikan SMTP AUTH
secara default di kebanyakan mailbox baru; perlu diaktifkan dari sisi admin akun/tenant Microsoft-nya
(lihat https://aka.ms/smtp_auth_disabled).

---

## 9. Struktur Direktori

```
product-tracker/
├── backend/               # SQL schema dan migrasi
│   └── db/
│       ├── schema.sql
│       ├── seed.sql
│       ├── migration_v2.sql
│       ├── migration_v3.sql
│       ├── migration_v4.sql
│       ├── migration_v5.sql
│       ├── migration_v6.sql
│       ├── migration_v7.sql
│       ├── migration_v8.sql
│       ├── migration_v9.sql
│       ├── migration_v10.sql
│       ├── migration_v11.sql
│       ├── migration_v12.sql
│       ├── migration_v13.sql
│       ├── migration_v14.sql
│       ├── migration_v15.sql
│       ├── migration_v16.sql
│       └── migration_v17.sql
├── backend-java/          # Spring Boot API (port 4000)
│   ├── src/
│   ├── pom.xml
│   └── target/
│       └── product-tracker-1.0.0.jar
└── frontend/              # React + Vite (port 5173)
    ├── src/
    └── package.json
```
