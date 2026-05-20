# HH Ai — локальный помощник откликов на hh.ru

[![Release](https://img.shields.io/github/v/release/emildg8/HH_Ai?label=2.0)](https://github.com/emildg8/HH_Ai/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Версия:** 2.0.0 · [CHANGELOG](CHANGELOG.md) · [**Документация**](docs/README.md) · [Релиз zip](https://github.com/emildg8/HH_Ai/releases/latest)

Автоматизация [hh.ru](https://hh.ru): сбор вакансий, LLM-оценка, сопроводительные, отклик через Playwright, дашборд с анкетой работодателя и батч-откликами.

> **Репозиторий проекта:** [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai) (ветка `HH_Ai`).  
> Идея-основа — [Steev193/hh-ru-apply](https://github.com/Steev193/hh-ru-apply) (MIT); код и продукт сильно переработаны — [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

> Автоотклики могут противоречить правилам hh.ru. Используйте умеренно. Секреты не коммить: [SECURITY.md](SECURITY.md).

## Быстрый старт

```powershell
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
git checkout HH_Ai
npm install
npx playwright install chromium
copy .env.example .env
copy config\profiles\devops.env.example config\profiles\devops.env
npm run login
npm run dashboard
```

→ http://127.0.0.1:3849 · после обновления кода — **Ctrl+F5**.

Без git: [скачать zip](https://github.com/emildg8/HH_Ai/releases/latest) → [docs/PUBLIC-RELEASE.md](docs/PUBLIC-RELEASE.md).

## Возможности 2.0

- **Дашборд** — очередь, LLM-письма, анкета работодателя, светлая/тёмная тема, плотность карточек
- **Батч** — массовый отклик; анкеты откладываются без остановки ([BATCH.md](docs/BATCH.md))
- **Harvest** — оценка, фильтры, hint анкеты по описанию
- **Профили** — `HH_PROFILE`, DevOps и свои роли
- **Капча** — ожидание ручного решения в Chromium
- **Релиз** — `npm run release:public` для передачи без личных данных

## Документация

| | |
|---|---|
| [**docs/README.md**](docs/README.md) | **Оглавление всей документации** |
| [SETUP.md](docs/SETUP.md) | Установка и первый запуск |
| [USAGE.md](docs/USAGE.md) | Рабочий цикл от А до Я |
| [DASHBOARD.md](docs/DASHBOARD.md) | Интерфейс и вкладки |
| [BATCH.md](docs/BATCH.md) | Массовый отклик |
| [CONFIG.md](docs/CONFIG.md) | Переменные и конфиги |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Типичные проблемы |
| [PUBLIC-RELEASE.md](docs/PUBLIC-RELEASE.md) | Для нового пользователя (zip) |
| [DISTRIBUTION.md](docs/DISTRIBUTION.md) | Распространение и Releases |
| [GITHUB.md](docs/GITHUB.md) | Git, ветки, публикация |
| [ROADMAP.md](docs/ROADMAP.md) | План развития |

## Команды

| Команда | Назначение |
|---------|------------|
| `npm run dashboard` | Локальный UI |
| `npm run harvest` | Сбор и оценка |
| `npm run login` | Сессия hh.ru |
| `npm run devops:apply-batch` | Массовый отклик |
| `npm run devops:list-resumes` | Резюме на hh.ru (hash) |
| `npm run release:public` | Zip без секретов |
| `npm run verify:local` | Проверка |

Полный список: `package.json` → `scripts`.

## Требования

- Node.js 18+
- `npx playwright install chromium`

Docker опционален — [DISTRIBUTION.md](docs/DISTRIBUTION.md).

## Лицензия

MIT · идея-основа — [ATTRIBUTION.md](docs/ATTRIBUTION.md).
