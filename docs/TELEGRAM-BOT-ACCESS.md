# Доступ к Telegram Bot API (бесплатно, автономно)

Локальный бот (`npm run telegram-bot`) опрашивает `getUpdates`. Если `api.telegram.org` заблокирован на ПК, используйте один из вариантов ниже.

## Автонастройка (рекомендуется)

```powershell
npm run telegram:setup-access
```

Скрипт по очереди пробует:

1. **Прямой доступ** — если провайдер не блокирует Telegram API  
2. **Cloudflare WARP** — бесплатный VPN (`winget`)  
3. **Tor** — бесплатный SOCKS5 `:9050`, без аккаунта (скачивается один раз)  
4. **Cloudflare Worker** — HTTPS-прокси `*.workers.dev` (нужен бесплатный аккаунт CF)

После успеха в `.env` прописываются `TELEGRAM_API_BASE` и `TELEGRAM_API_SECRET`, создаётся задача **HH-Ai-Telegram-Bot** (автозапуск при входе).

Проверка:

```powershell
npm run telegram:probe-api
```

## GitHub Actions (если локально не качается Tor/WARP)

**Один раз в Cloudflare:** [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **Register workers.dev subdomain** (например `hh-ai-bot`). Без этого URL `*.workers.dev` не создаётся.

1. [Cloudflare](https://dash.cloudflare.com) → API Token (Edit Cloudflare Workers) → GitHub secret `CLOUDFLARE_API_TOKEN`.
2. Actions → **Deploy CF Telegram proxy** → **Run workflow** (после регистрации subdomain).
3. Из **Summary** job — `TELEGRAM_API_BASE` и `TELEGRAM_API_SECRET` в `.env`.
4. `npm run telegram:probe-api` → `npm run telegram-bot`.

Worker крутится на Cloudflare бесплатно; ПК только опрашивает `*.workers.dev`.

## Cloudflare Worker (ручной deploy)

Нужен бесплатный аккаунт [Cloudflare](https://dash.cloudflare.com).

```powershell
cd deploy/cf-telegram-proxy
npx wrangler login
npx wrangler secret put PROXY_SECRET
npx wrangler deploy
```

URL вида `https://hh-ai-tg-xxxxx.workers.dev` → в `.env`:

```env
TELEGRAM_API_BASE=https://hh-ai-tg-xxxxx.workers.dev
TELEGRAM_API_SECRET=ваш_секрет
```

Лимит free tier: ~100 000 запросов/день — для личного бота достаточно.

## Cloudflare WARP

```powershell
winget install -e --id Cloudflare.Warp
# включить WARP в трее или: warp-cli connect
npm run telegram-bot
```

`TELEGRAM_API_BASE` не нужен — бот ходит напрямую через VPN.

## Что не подходит

| Решение | Почему |
|---------|--------|
| **tg-ws-proxy** (1080) | Только MTProto для Telegram Desktop, не HTTPS Bot API |
| **Wispbyte без HTTPS** | Webhook недоступен; polling на сервере всё равно нужен доступ к API |
| **Публичный чужой прокси** | Токен бота в URL — небезопасно |

## Переменные .env

| Переменная | Назначение |
|------------|------------|
| `TELEGRAM_API_BASE` | URL Bot API (по умолчанию `https://api.telegram.org`) |
| `TELEGRAM_API_SECRET` | Секрет CF Worker (`X-Tg-Proxy-Secret`) |
| `TELEGRAM_PROXY` | Универсальный SOCKS5/HTTP (Clash, V2Ray) |
| `CLOUDFLARE_API_TOKEN` | Опционально, для deploy без `wrangler login` |

## Автозапуск Windows

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-telegram-bot-task.ps1
```

Снять:

```powershell
Unregister-ScheduledTask -TaskName "HH-Ai-Telegram-Bot" -Confirm:$false
```

См. также [TELEGRAM-BOT.md](./TELEGRAM-BOT.md).
