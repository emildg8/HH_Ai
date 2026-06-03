# VPS с SSH (Vdsina и аналоги)

> **Wispbyte без SSH?** → [DEPLOY-WISPBYTE.md](DEPLOY-WISPBYTE.md) — только GitHub pull в панели, без Secrets и SCP.

Telegram-бот **24/7 на VPS**; Playwright и дашборд — **на ПК**.

## Архитектура

```text
GitHub (push main) ──► Actions deploy-vdsina.yml ──► Vdsina (Python FastAPI :8080)
Telegram ──HTTPS──► nginx ──► /telegram/webhook

ПК: npm run dashboard + npm run remote:push-stats ──SCP──► VPS data/stats-snapshot.json
```

## 1. Первый раз на VPS (один раз)

```bash
ssh root@YOUR_VPS_IP
git clone https://github.com/emildg8/HH_Ai.git /opt/hh-ai-src   # или ваш fork
sudo bash /opt/hh-ai-src/deploy/vdsina/install-on-server.sh
sudo cp /opt/hh-ai-src/deploy/vdsina/.env.example /opt/hh-ai-webhook/.env
nano /opt/hh-ai-webhook/.env   # TELEGRAM_*, секрет webhook
sudo cp /opt/hh-ai-src/deploy/vdsina/nginx/hh-ai-webhook.conf /etc/nginx/sites-available/hh-ai
# замените YOUR_DOMAIN, затем:
sudo ln -sf /etc/nginx/sites-available/hh-ai /etc/nginx/sites-enabled/
sudo certbot --nginx -d YOUR_DOMAIN
sudo systemctl start hh-ai-webhook
```

**Важно:** Telegram webhook требует **HTTPS** (домен → IP Vdsina). Бесплатно: поддомен + Let's Encrypt, или Cloudflare.

## 2. GitHub Secrets

Repository → Settings → Secrets and variables → Actions:

| Secret | Пример |
|--------|--------|
| `VDSINA_HOST` | `123.45.67.89` |
| `VDSINA_SSH_USER` | `root` |
| `VDSINA_SSH_PRIVATE_KEY` | содержимое `id_ed25519` (без passphrase) |
| `VDSINA_SSH_PORT` | `22` (опционально) |
| `VDSINA_APP_DIR` | `/opt/hh-ai-webhook` |
| `TELEGRAM_BOT_TOKEN` | от BotFather |
| `TELEGRAM_WEBHOOK_URL` | `https://YOUR_DOMAIN/telegram/webhook` |
| `TELEGRAM_WEBHOOK_SECRET` | та же строка, что в `.env` на VPS |

После добавления secrets: push в `main` или **Actions → Deploy Vdsina webhook → Run workflow**.

## 3. Локальный `.env` (ПК)

```env
VDSINA_HOST=123.45.67.89
VDSINA_SSH_USER=root
VDSINA_SSH_KEY_PATH=C:/Users/you/.ssh/id_ed25519
VDSINA_APP_DIR=/opt/hh-ai-webhook

TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://YOUR_DOMAIN/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=...

# авто-push snapshot после утреннего цикла
HH_REMOTE_STATS_PUSH=1
```

## 4. Команды

| Команда | Где |
|---------|-----|
| `npm run remote:push-stats` | ПК — отправить сводку на VPS |
| `npm run remote:set-webhook` | ПК — вручную прописать webhook (обычно делает Actions) |
| `/stats`, `/queue`, `/chats` | Telegram → VPS |

## 5. Остановить локальный polling-бот

Если webhook на VPS активен, **не запускайте** одновременно `npm run telegram-bot` (конфликт getUpdates).

Проверка webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## 6. Опционально: живой дашборд с ПК

Cloudflare Tunnel → `HH_DASHBOARD_URL=https://hh.yourdomain.com` на VPS — тогда `/status` на VPS читает `/api/job-status` с вашего ПК.

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| `/stats` пустой | `npm run remote:push-stats` на ПК |
| 403 webhook | `TELEGRAM_WEBHOOK_SECRET` совпадает в GitHub, VPS `.env` и setWebhook |
| deploy skipped | нет `VDSINA_HOST` в GitHub Secrets |
| `scp` на Windows | OpenSSH Client включён; путь к ключу в `VDSINA_SSH_KEY_PATH` |
