# Первый запуск HH Ai

Минимум настроек до рабочего дашборда — **около 5 минут**.

## Обязательно (2 поля)

1. **Node.js 20+** — [nodejs.org](https://nodejs.org/)
2. **`HH_PROFILE_RESUME_TITLE`** в `config/profiles/devops.env` — точное название вашего резюме на hh.ru (как в списке резюме).

Скрипт `install.ps1` / `install-portable.ps1` создаёт файл из `devops.env.example`, если его ещё нет.

## Установка

### Git-клон

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

### Portable zip (без git)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1
```

Скрипт: `npm install`, Chromium для Playwright, копирует `no-llm` preset, **демо-очередь** (5 вакансий).

## Дальше

```powershell
npm run login          # один раз — вход на hh.ru в окне Chromium
npm run dashboard      # или start-dashboard.bat
```

→ http://127.0.0.1:3849

## Демо без hh.ru

После install в очереди уже **5 демо-вакансий**. Можно смотреть дашборд, воронку и чаты **без** `login`.

Кнопка **«Загрузить демо»** в дашборде — если очередь пуста.

## Опционально

| Что | Зачем |
|-----|-------|
| Ключ OpenRouter / Ollama | LLM-письма и оценка ([CONFIG-GUIDE.md](CONFIG-GUIDE.md)) |
| Telegram-бот | уведомления в мессенджер |
| Свой CV в `CV/` | точнее подгонка писем |

## Проверка

```powershell
npm run setup:check
```

## См. также

- [QUICKSTART.md](QUICKSTART.md) — полный путь до отклика
- [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md) — если получили zip от другого человека
