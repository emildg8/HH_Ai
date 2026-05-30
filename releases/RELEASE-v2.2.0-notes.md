## HH Ai 2.2.0

Сводный релиз **2.0.2 → 2.1.0 → 2.2.0**: стабильный Chromium/apply, CRM-дашборд v3, feedback LLM, portable zip.

### Установка

```powershell
# Git
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
npm run login
npm run dashboard

# Zip с Releases (без git)
powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1
# или start-dashboard.bat
```

→ http://127.0.0.1:3849 · [QUICKSTART.md](docs/QUICKSTART.md)

### 2.2.0 — умный фон

- Portable: `hh-ai-public-v2.2.0.zip` + `hh-ru-apply-win-x64-v2.2.0.zip`, `start-dashboard.bat`
- Вкладка **«Отлож.»** (fix), Shift+7 дней, счётчики на вкладках
- Модалка **«Дайджест дня»** + Telegram
- `npm run devops:rescore-pending`

### 2.1.0 — меньше ручной возни

- **Пригласили / Отказ** → `feedback.jsonl` → few-shot в письмах
- Выбор **HH_PROFILE** в настройках
- Метрики % правок, A/B/C письма, резюме в журнале батча

### 2.0.2 — стабилизация

- **`npm run apply`** — общий browser lock (меньше «browser closed»)
- Дашборд UX v3: design tokens, command palette, breadcrumbs, vacancy detail
- Browser guard: sync на паузе батча; подъём резюме

### Скачать

- `hh-ai-public-v2.2.0.zip`
- `hh-ru-apply-win-x64-v2.2.0.zip`

Полный changelog: [CHANGELOG.md](../CHANGELOG.md).
