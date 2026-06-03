#!/bin/bash
# Первичная настройка VPS (Ubuntu/Debian). Запуск: sudo bash install-on-server.sh
set -euo pipefail

APP_DIR="${HH_VDSINA_APP_DIR:-/opt/hh-ai-webhook}"

apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip nginx certbot python3-certbot-nginx

mkdir -p "$APP_DIR/data"
chown -R www-data:www-data "$APP_DIR"

python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

cp "$APP_DIR/systemd/hh-ai-webhook.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable hh-ai-webhook

echo "OK. Дальше:"
echo "  1) scp .env → $APP_DIR/.env"
echo "  2) nginx + certbot для HTTPS (docs/DEPLOY-VDSINA.md)"
echo "  3) systemctl start hh-ai-webhook"
