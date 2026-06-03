# Wispbyte — без SSH, pull из GitHub

Telegram-бот на **Wispbyte**; отклики и Playwright — на **ПК**. SSH и GitHub Secrets **не нужны**.

На бесплатном Wispbyte **не влезает весь монорепо** — используйте отдельную ветку **`wispbyte-bot`** (~50 KB, только Python webhook).

## 0. Ветка только с ботом

После push в `main` GitHub Actions создаёт ветку **`wispbyte-bot`** автоматически.  
Или вручную с ПК:

```powershell
npm run remote:sync-wispbyte-bot
```

## 1. Панель Wispbyte → GitHub

| Поле | Значение |
|------|----------|
| **Repository URL** | `https://github.com/emildg8/HH_Ai` |
| **Branch** | **`bot`** (короткое имя; Wispbyte обрезает `wispbyte-bot` → `wispbyte-bo`) |
| **GitHub Username + PAT** | только если репо private |
| **Auto Update on Startup** | **Вкл** |

Нажмите **Clone** (первый раз) или **Pull** (обновить).

## 2. Startup command

Wispbyte **не задаёт `$PORT`** — используйте **`SERVER_PORT`** (число из Address справа, например `11039`):

```bash
pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port ${SERVER_PORT}
```

Если `${SERVER_PORT}` тоже пустой — подставьте порт **вручную** из Address (`93.115.101.178:11039` → порт `11039`):

```bash
pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port 11039
```

В Console должно быть `Uvicorn running on http://0.0.0.0:11039` (не 8080, не crash).

## 3. Переменные окружения (Environment)

В панели Wispbyte, **не** в GitHub Secrets:

| Переменная | Значение |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | от BotFather |
| `TELEGRAM_ALLOWED_CHAT_IDS` | ваш chat_id |
| `TELEGRAM_WEBHOOK_SECRET` | случайная строка 32+ символов |
| `HH_REMOTE_API_TOKEN` | другая случайная строка (для push stats с ПК) |
| `HH_VDSINA_DATA_DIR` | `./data` (или `/app/data`) |

## 4. Webhook Telegram (один раз с ПК)

После старта сервера Wispbyte даст **HTTPS URL** (например `https://xxx.wispbyte.app`).

В локальном `.env`:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://ВАШ-URL-WISPBYTE/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=та_же_что_на_сервере
```

```powershell
npm run remote:set-webhook
```

## 5. Статистика с ПК (без SSH)

```env
HH_REMOTE_STATS_URL=https://ВАШ-URL-WISPBYTE/api/stats-ingest
HH_REMOTE_API_TOKEN=та_же_что_HH_REMOTE_API_TOKEN_на_сервере
HH_REMOTE_STATS_PUSH=1
```

```powershell
npm run remote:push-stats
```

После утреннего цикла stats уйдут сами, если `HH_REMOTE_STATS_PUSH=1`.

## 6. GitHub Secrets — **не нужны**

| Не нужно | Почему |
|----------|--------|
| `VDSINA_SSH_*` | Wispbyte не даёт SSH |
| Deploy workflow | Wispbyte сам тянет git |

Workflow `.github/workflows/deploy-vdsina.yml` можно игнорировать.

## 7. Цикл «ничего руками»

1. Push в GitHub → Wispbyte при рестарте тянет код (**Auto Update on Startup**).
2. На ПК: дашборд + утренний цикл → stats на сервер по HTTP.
3. Telegram: `/stats`, `/queue`, `/chats` на Wispbyte 24/7.

**Не запускайте** `npm run telegram-bot` на ПК — только webhook на Wispbyte.

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| Бот молчит | `npm run remote:set-webhook`, проверить `getWebhookInfo` |
| `/stats` пустой | `npm run remote:push-stats`, проверить `HH_REMOTE_API_TOKEN` |
| 403 на stats-ingest | токен на ПК = токен на Wispbyte |
| Старый код | Restart сервера в панели Wispbyte |

---

SSH-деплой (Vdsina/VPS): [DEPLOY-VDSINA.md](DEPLOY-VDSINA.md)
