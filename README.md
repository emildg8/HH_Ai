# HH Ai — локальный помощник откликов на hh.ru

**Версия:** 2.0.0 · [CHANGELOG](CHANGELOG.md) · [Публичный релиз](docs/PUBLIC-RELEASE.md) · [Roadmap](docs/ROADMAP.md)

Автоматизация [hh.ru](https://hh.ru): сбор вакансий, LLM-оценка, сопроводительные, отклик через Playwright, дашборд с анкетой работодателя.

> Проект **основан на** открытом [Steev193/hh-ru-apply](https://github.com/Steev193/hh-ru-apply) (MIT). Подробнее: [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

> Автоотклики могут противоречить правилам hh.ru. Используйте умеренно. Секреты не коммить: [SECURITY.md](SECURITY.md).

## Что нового в 2.0

- Батч с областями **«Очередь»** / **«Без анкет»** / **«Анкета»** — анкета откладывается без остановки батча.
- В журнале батча — **понятные пропуски** (`не выбрано резюме «DevOps»`, `анкета: N вопр.`).
- Harvest помечает вероятные анкеты; фильтры по заголовку и минус-словам в поиске.
- Ожидание **капчи** в том же окне Chromium.
- Публичный архив для передачи: `npm run release:public`.

## Дашборд (локально)

Сервер **не стартует сам** — в отдельном терминале из корня проекта:

```bash
npm run dashboard
```

Откройте http://127.0.0.1:3849 · после обновления кода — **Ctrl+F5**.

Порт: переменная `DASHBOARD_PORT` (по умолчанию `3849`).

**Батч «Без анкет»:** если на hh.ru появляется анкета, отклик **не отправляется**, вопросы сохраняются, карточка в «Анкета», батч идёт дальше (код `5`, лимиты дня/часа **не** тратятся). В логе: `Пропуск N/M: анкета: 20 вопр. — «…»`.

**Резюме в батче:** задайте `HH_PROFILE_RESUME_TITLE` и при необходимости `HH_PROFILE_RESUME_HASH` в `config/profiles/<profile>.env` (`npm run devops:list-resumes`).

**Капча:** сценарий ждёт решения в Chromium (`HH_CAPTCHA_WAIT_MS`, по умолчанию 10 мин). В `HH_HEADLESS=1` — ошибка с подсказкой открыть обычный режим.

## Передать проект другому (без ваших данных)

```bash
npm run release:public
```

Архив: `releases/hh-ai-public-v2.0.0.zip` — только код, примеры конфигов и документация. Инструкция получателю: [docs/PUBLIC-RELEASE.md](docs/PUBLIC-RELEASE.md).

Проверка среза без zip: `npm run export:public` → каталог `dist/hh-ai-public`, затем `git status`.

## Документация

| Файл | О чём |
|------|--------|
| [docs/SETUP.md](docs/SETUP.md) | Установка, профили, первый запуск |
| [docs/PUBLIC-RELEASE.md](docs/PUBLIC-RELEASE.md) | Релиз 2.0 для нового пользователя |
| [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) | Zip, install, GitHub Releases |
| [docs/ROADMAP.md](docs/ROADMAP.md) | План развития |
| [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) | Связь с upstream-проектом |

## Быстрый старт (Windows, без Docker)

```powershell
cd <путь-к-проекту>
npm install
npx playwright install chromium
copy .env.example .env
copy config\profiles\devops.env.example config\profiles\devops.env
# отредактируйте devops.env: резюме, ключи OpenRouter в secrets.local.env
npm run login
npm run dashboard
```

## Основные команды

| Команда | Назначение |
|---------|------------|
| `npm run dashboard` | Локальный UI очереди |
| `npm run harvest` | Сбор и оценка вакансий |
| `npm run login` | Сессия hh.ru в Chromium |
| `npm run devops:apply-batch` | Массовый отклик (профиль DevOps) |
| `npm run devops:list-resumes` | Список резюме на hh.ru для hash/title |
| `npm run backup` | Резервная копия data/config/CV |
| `npm run export:public` | Каталог для git без секретов |
| `npm run release:public` | Zip для передачи другим |
| `npm run verify:local` | Проверка кода + UI |
| `npm run profile:init -- --id=qa --title=QA` | Новый профиль вакансии |

Алиасы `devops:*` — harvest/дашборд/batch для профиля DevOps. Полный список: `package.json` → `scripts`.

## Профили

```bash
npm run profile:init -- --id=backend --title="Backend"
# правка config/profiles/backend.env
set HH_PROFILE=backend
npm run harvest
```

Legacy: `config/devops.env` и `npm run devops:*`.

## Git и данные

- В git **не попадают**: `.env`, `data/vacancies-*.json`, сессия, CV, письма, логи, `config/profiles/*.env` (кроме `*.example.env`).
- Перед push: `npm run export:public` и просмотр `dist/hh-ai-public`.

## Требования

- Node.js 18+
- Chromium: `npx playwright install chromium`

Docker — **не обязателен** (см. [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)).

## Лицензия

MIT (как у базового hh-ru-apply). При распространении сохраняйте указание на upstream.
