# HH Ai — локальный помощник откликов на hh.ru

> **For recruiters / tech screen:** local automation product — **Playwright** browser E2E, **Node.js** dashboard, **GitHub Actions** CI, portable releases, optional Docker. Demonstrates **internal tooling & test automation** (gates, retries, observability), not a black-box spam bot. Stack: Node.js · Playwright · CI/CD · Windows/Linux install path.

[![Release](https://img.shields.io/github/v/release/emildg8/HH_Ai?label=3.2.0)](https://github.com/emildg8/HH_Ai/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Версия:** 3.2.0 · [**Быстрый старт**](docs/QUICKSTART.md) · [Путеводитель по docs](docs/GUIDE-PARTNER.md) · [Оглавление](docs/README.md) · [Скачать](https://github.com/emildg8/HH_Ai/releases/latest) · [Changelog](CHANGELOG.md)

Автоматизация [hh.ru](https://hh.ru): сбор вакансий, LLM-оценка, сопроводительные, отклик через Playwright, дашборд с анкетой и батч-откликами.

| Очередь | Аналитика | Батч |
|:---:|:---:|:---:|
| ![Дашборд — очередь](docs/screenshots/dashboard-queue.png) | ![Воронка](docs/screenshots/dashboard-analytics.png) | ![Батч](docs/screenshots/dashboard-batch.png) |

> **Репозиторий:** [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)  
> Автоотклики могут противоречить правилам hh.ru — используйте умеренно. [SECURITY.md](SECURITY.md)

---

## Установка

### Windows — приложение (рекомендуется)

1. Скачайте **`HH-Ai_*-setup.exe`** с [Releases](https://github.com/emildg8/HH_Ai/releases/latest).
2. Установите и запустите **HH Ai** из меню Пуск.
3. На первом экране: **Установить Chromium** → `login` на hh.ru (см. [FIRST-RUN.md](docs/FIRST-RUN.md)).

### Windows / macOS / Linux — git

```powershell
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
powershell -ExecutionPolicy Bypass -File scripts/install.ps1   # или bash scripts/install.sh
npm run login
npm run dashboard
```

→ **http://127.0.0.1:3849**

После `install.ps1` / `install.sh` в очередь автоматически подгружается **демо** (5 вакансий). Если список пуст — кнопка **«Загрузить демо»** в дашборде или `npm run setup:first-run -- --demo`.

### Без git — portable zip

[Скачать zip](https://github.com/emildg8/HH_Ai/releases/latest) → `install-portable.ps1` → `start-dashboard.bat`

**Быстрый лauncher:** `powershell -File start-hh-ai.ps1`

После install: `npm run setup:check`

---

## Возможности

| Функция | Описание |
|---------|----------|
| **Desktop 3.0** | Tauri-приложение: дашборд без терминала, sidecar, Chromium в один клик |
| **Дашборд** | Очередь, LLM-письма, анкета, CRM-воронка, светлая/тёмная тема |
| **Harvest** | Сбор с hh.ru + оценка (LLM или локально) |
| **Батч** | Массовый отклик; анкеты — авто-ответы ([BATCH.md](docs/BATCH.md)) |
| **Профили** | `HH_PROFILE` — DevOps и свои роли |
| **Релиз** | Portable zip + Windows installer в CI |

---

## Документация

| | |
|---|---|
| [**QUICKSTART.md**](docs/QUICKSTART.md) | **5 шагов — с нуля до отклика** |
| [**PUBLIC-RELEASE.md**](docs/PUBLIC-RELEASE.md) | **Desktop exe + zip для нового пользователя** |
| [**CONFIG-GUIDE.md**](docs/CONFIG-GUIDE.md) | LLM, профиль, обучение модели |
| [docs/README.md](docs/README.md) | Оглавление |
| [COVER-LETTER-PLAN.md](docs/COVER-LETTER-PLAN.md) | Качество писем, precheck, тесты |
| [SETTINGS-MODAL-PLAN.md](docs/SETTINGS-MODAL-PLAN.md) | Модалка «Настройки» дашборда (5 вкладок, пресеты, окно) |
| [USER-UX-PLAN-2026-06.md](docs/USER-UX-PLAN-2026-06.md) | UX для обычного пользователя: понятные подписи, отмена на вкладке |
| [DESIGN-SYSTEM-2026-06.md](docs/DESIGN-SYSTEM-2026-06.md) | Единый стиль дашборда: токены, слои CSS, компоненты |
| [DESIGN-SYSTEM-PLAN-2026-06.md](docs/DESIGN-SYSTEM-PLAN-2026-06.md) | План UI v2: спринты S1–S6, DoD, gates, 12 нед. |
| [TAURI-PLAN.md](docs/TAURI-PLAN.md) | Desktop-приложение |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Решение проблем |

---

## Для мейнтейнера

```powershell
npm run quality:check     # письма + таргетинг + golden
npm run check:dashboard   # синтаксис UI + JSDoc + DOM + версия app.js
npm run gate-b              # Gate B: demo activation ≤5 мин
npm run test:dashboard-screenshots  # DS-07 regression
npm run metrics:baseline:write  # снимок KPI (A-MET-1)
npm run verify:local
npm run qa:clean-install
npm run release:public
npm run desktop:bundle    # перед tauri build
```

Тег `v3.0.0` → GitHub Release: zip + NSIS installer.

---

## Лицензия

MIT · Идея-основа: [Steev193/hh-ru-apply](https://github.com/Steev193/hh-ru-apply) · [ATTRIBUTION.md](docs/ATTRIBUTION.md)
