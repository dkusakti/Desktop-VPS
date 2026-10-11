#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_SOURCE="$PROJECT_ROOT/core/server"

VPS_USER="vps"
VPS_HOST="192.168.122.204"
VPS_ROOT="/opt/enterprise-server"

echo "=== ENTERPRISE SERVER DEPLOY ==="
echo "SOURCE : $SERVER_SOURCE"
echo "TARGET : $VPS_USER@$VPS_HOST:$VPS_ROOT"
echo

if [ ! -f "$SERVER_SOURCE/server.js" ]; then
    echo "[ERROR] core/server/server.js tidak ditemukan."
    exit 1
fi

echo "[1/5] Mengirim seluruh core/server..."

ssh "$VPS_USER@$VPS_HOST" \
    "mkdir -p '$VPS_ROOT/core/server'"

rsync -az \
    --delete \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='*.backup*' \
    --exclude='logs/' \
    --exclude='node_modules/' \
    "$SERVER_SOURCE/" \
    "$VPS_USER@$VPS_HOST:$VPS_ROOT/core/server/"

echo "[2/5] Mengirim package.json dan package-lock.json..."

rsync -az \
    "$PROJECT_ROOT/package.json" \
    "$PROJECT_ROOT/package-lock.json" \
    "$VPS_USER@$VPS_HOST:$VPS_ROOT/"

echo "[3/5] Install dependency..."

ssh "$VPS_USER@$VPS_HOST" \
    "cd '$VPS_ROOT' && npm ci --omit=dev"

echo "[4/5] Verifikasi migration..."

ssh "$VPS_USER@$VPS_HOST" \
    "cd '$VPS_ROOT' && npm run db:migrate:verify"

echo "[5/5] Memastikan permission credential..."

ssh "$VPS_USER@$VPS_HOST" \
    "if [ -d '$VPS_ROOT/core/server/discovery/credentials' ]; then chmod 700 '$VPS_ROOT/core/server/discovery/credentials'; fi; \
     if [ -f '$VPS_ROOT/core/server/discovery/credentials/service-account.json' ]; then chmod 600 '$VPS_ROOT/core/server/discovery/credentials/service-account.json'; fi"

echo

echo "[6/6] Memasang launcher Node.js..."

TMP_RUN="$(mktemp)"
trap 'rm -f "$TMP_RUN"' EXIT

cat > "$TMP_RUN" <<'RUN_SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/enterprise-server"
API="$ROOT/core/server/server.js"
DISCOVERY="$ROOT/core/server/discovery/discovery_server.js"
CREDENTIALS="$ROOT/core/server/discovery/credentials/service-account.json"
FILE_ID="1nIi5n5OHL09rtXE338I_ObLIws4Ca_zX"
LOG_DIR="$ROOT/logs"

[[ -f "$API" ]] || { echo "[ERROR] API tidak ditemukan: $API"; exit 1; }
[[ -f "$DISCOVERY" ]] || { echo "[ERROR] Discovery JS tidak ditemukan: $DISCOVERY"; exit 1; }
[[ -r "$CREDENTIALS" ]] || { echo "[ERROR] Kredensial tidak tersedia: $CREDENTIALS"; exit 1; }

cd "$ROOT"
mkdir -p "$LOG_DIR"

echo "=== ENTERPRISE VPS START ==="
echo "[1/3] PostgreSQL..."
sudo systemctl start postgresql

echo "[2/3] Enterprise API..."
if ! pgrep -f '[n]ode core/server/server.js' >/dev/null; then
  nohup npm run start:vps >> "$LOG_DIR/api.log" 2>&1 </dev/null &
  sleep 3
fi
pgrep -f '[n]ode core/server/server.js' >/dev/null || {
  echo "[ERROR] API gagal. Periksa $LOG_DIR/api.log"
  exit 1
}

echo "[3/3] Discovery Server Node.js..."
if ! pgrep -f '[n]ode /opt/enterprise-server/core/server/discovery/discovery_server.js' >/dev/null; then
  ENTERPRISE_VPS_GOOGLE_SERVICE_ACCOUNT="$CREDENTIALS"   ENTERPRISE_VPS_DISCOVERY_FILE_ID="$FILE_ID"     nohup node "$DISCOVERY" >> "$LOG_DIR/discovery_server.log" 2>&1 </dev/null &
  sleep 3
fi
pgrep -f '[n]ode /opt/enterprise-server/core/server/discovery/discovery_server.js' >/dev/null || {
  echo "[ERROR] Discovery gagal. Periksa $LOG_DIR/discovery_server.log"
  exit 1
}
echo "=== SERVICE NODE.JS AKTIF ==="
RUN_SCRIPT

scp "$TMP_RUN" "$VPS_USER@$VPS_HOST:/tmp/enterprise-run"
ssh "$VPS_USER@$VPS_HOST"   "sudo install -m 755 /tmp/enterprise-run /usr/local/bin/run && rm -f /tmp/enterprise-run"

echo "=== DEPLOY BERHASIL ==="
echo
echo "Seluruh core/server sudah dikirim ke VPS."
echo
echo "Jalankan service:"
echo "  ssh $VPS_USER@$VPS_HOST"
echo "  run"
