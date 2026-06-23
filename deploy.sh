#!/bin/bash
set -e

echo "=============================="
echo " Product Tracker — Deploy"
echo "=============================="

# ── Cek Docker ───────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo "ERROR: Docker tidak ditemukan."
    echo "Install: https://docs.docker.com/engine/install/"
    exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
    echo "ERROR: Docker Compose plugin tidak ditemukan."
    echo "Install: https://docs.docker.com/compose/install/"
    exit 1
fi

# ── Buat .env jika belum ada ─────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "File .env dibuat dari .env.example."
    echo "Wajib edit sebelum deploy:"
    echo "  nano .env"
    echo ""
    echo "Yang harus diisi:"
    echo "  DB_PASSWORD  → password database PostgreSQL"
    echo "  JWT_SECRET   → string random panjang (min 32 karakter)"
    echo ""
    echo "Setelah selesai, jalankan script ini lagi:"
    echo "  bash deploy.sh"
    exit 1
fi

# ── Pull kode terbaru ─────────────────────────────────────────────
echo "[1/4] Pulling latest code..."
git pull origin main

# ── Stop container lama ───────────────────────────────────────────
echo "[2/4] Stopping existing containers..."
docker compose down

# ── Build & start ─────────────────────────────────────────────────
echo "[3/4] Building and starting containers..."
docker compose up -d --build

# ── Verifikasi ────────────────────────────────────────────────────
echo "[4/4] Waiting for app to be ready..."
sleep 20

FRONTEND_PORT=$(grep -E '^FRONTEND_PORT=' .env 2>/dev/null | cut -d'=' -f2 || echo "8500")
SERVER_IP=$(hostname -I | awk '{print $1}')
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" 2>/dev/null || echo "000")

echo ""
echo "=============================="
if [ "$HTTP_STATUS" = "200" ]; then
    echo " Deploy berhasil!"
else
    echo " Container berjalan (status HTTP: $HTTP_STATUS)"
    echo " Cek logs jika ada masalah:"
    echo "   docker compose logs -f"
fi
echo ""
echo " URL:"
echo "   Frontend : http://$SERVER_IP:${FRONTEND_PORT}"
echo "   Backend  : http://$SERVER_IP:4000"
echo ""
echo " Login:"
echo "   Email    : admin@admin.com"
echo "   Password : 1234"
echo "=============================="
