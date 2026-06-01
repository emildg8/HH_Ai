# Telegram-бот управления HH Ai

Бот для **управления проектом** и **сбора статистики** без открытия дашборда.

**Рекомендуемый режим:** **локально на ПК** (long polling) — без VPS.

> Отдельно от односторонних уведомлений (`lib/telegram-notify.mjs` — дайджест, harvest). Можно использовать **один** `TELEGRAM_BOT_TOKEN` для обоих сценариев.

## Быстрый старт (локальный бот)

1. Бот у [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN`.

2. Chat id — [@userinfobot](https://t.me/userinfobot) → `Id: 123456789`.

3. В `.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

4. **Если `api.telegram.org` недоступен** (РФ и т.п.) — одна команда, бесплатно:

```powershell
npm run telegram:setup-access
```

Настроит WARP или Cloudflare Worker, пропишет `.env`, включит автозапуск при входе в Windows. Подробнее: [TELEGRAM-BOT-ACCESS.md](./TELEGRAM-BOT-ACCESS.md).

5. Запуск:

```powershell
npm run telegram-bot
```

При старте бот **сам снимает webhook**, если вы раньше пробовали Wispbyte/VPS.  
Вручную: `npm run telegram:clear-webhook`

6. В Telegram: `/start` или `/help`

**Белый IP не нужен.** Дашборд для `/status` — `npm run dashboard` на том же ПК.

### Ручной прокси (опционально)

```env
TELEGRAM_PROXY=socks5://127.0.0.1:7890
TELEGRAM_API_BASE=https://ваш-worker.workers.dev
TELEGRAM_API_SECRET=...
```

> **tg-ws-proxy** (Telegram Desktop) **не подходит** для Bot API — только MTProto, не HTTPS.

## Команды

| Команда | Действие |
|---------|----------|
| `/status` | Поиск, серия откликов, занятость браузера |
| `/stats` | Сводка как вечерний дайджест |
| `/queue` | Очередь по статусам и баллам |
| `/funnel 7` | Воронка за N дней |
| `/digest` | Пересчитать дайджест → `data/daily-digest-last.json` |
| `/batch` | Отчёт последней серии |
| `/routine` | Утренний цикл (с подтверждением) |
| `/harvest 7` | Поиск вакансий (с подтверждением) |
| `/harvest_stop` | Остановить поиск |
| `/dashboard` | Ссылка на локальный дашборд |

## Безопасность

- Бот **не отвечает** чужим chat_id — только whitelist в `TELEGRAM_ALLOWED_CHAT_IDS` / `TELEGRAM_ALLOWED_USER_IDS`.
- `/harvest` и `/routine` требуют inline-подтверждения.
- Запуск harvest проверяет lock профиля Chromium (как дашборд).
- `enableBatchControl: false` по умолчанию — серия откликов из Telegram не включена (только статус).

## Файлы

| Путь | Назначение |
|------|------------|
| `scripts/telegram-bot.mjs` | Точка входа, polling |
| `lib/telegram-bot/` | API, auth, stats, jobs, router |
| `config/telegram-bot.json` | Whitelist, URL дашборда, флаги |
| `data/telegram-bot-offset.json` | Offset getUpdates |

## Автозапуск (Windows)

Планировщик задач или `start-hh-ai.ps1` — отдельный процесс рядом с дашбордом:

```powershell
Start-Process -WindowStyle Hidden node -ArgumentList "scripts/telegram-bot.mjs"
```

## VPS webhook (опционально)

Если на free Wispbyte нет HTTPS-subdomain — **используйте локальный бот** (выше).

- Wispbyte: [DEPLOY-WISPBYTE.md](DEPLOY-WISPBYTE.md)
- VPS с SSH: [DEPLOY-VDSINA.md](DEPLOY-VDSINA.md)

**Не запускайте** `npm run telegram-bot` одновременно с webhook на VPS.

## Расширение

- Команды pause/resume batch — `enableBatchControl: true` + доработка router.
- Push при завершении harvest — уже есть `lib/harvest-notify.mjs`.
