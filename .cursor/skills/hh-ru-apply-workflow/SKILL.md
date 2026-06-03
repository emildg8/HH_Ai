---
name: hh-ru-apply-workflow
description: >-
  Maps hh.ru automation in HH Ai (canonical repo: github.com/emildg8/HH_Ai; Steev193/hh-ru-apply — idea only, do not push there). Playwright scripts, vacancies queue, dashboard,
  cover letter fill vs chat apply, selector files. Use when editing or running hh-ru-apply,
  debugging Playwright flows, or answering questions about npm scripts, data paths, and
  hh.ru response/chat automation.
---

# hh-ru-apply — рабочий контур

## Стек и запуск

- Node.js **18+**, проект на **ESM** (`"type": "module"` в [package.json](package.json)).
- После `npm install` при необходимости: `npx playwright install chromium`.
- Список команд — в `scripts` внутри [package.json](package.json); ниже — смысл.

## Сценарии (`npm run …`)

| Команда | Назначение |
|--------|------------|
| `login` | Сохранение сессии hh.ru в профиле Chromium. |
| `apply` | Проверка, что сохранённая сессия жива. |
| `dashboard` | Локальный UI: очередь вакансий, письма, запуск сценариев. |
| `scan-tg` | Вакансии из Telegram (см. переменные в [.env.example](.env.example)). |
| `vacancies` | Открытие вакансий с hh по ключевым словам. |
| `harvest` | Сбор/обогащение очереди (в т.ч. OpenRouter — см. [.env.example](.env.example)). |
| `hh-fill-letter` | Вставка сопроводительного в **форму отклика** на странице вакансии; **отправку не нажимает** — пользователь проверяет и жмёт сам. |
| `hh-apply-chat` | Сценарий **отклик + письмо в чат** (`scripts/hh-apply-chat-letter.mjs`). |
| `devops:apply-batch` | Массовый отклик; анкета → код выхода `5`, журнал `[batch] Пропуск …: причина`. |
| `release:public` | Zip без секретов для передачи (`releases/hh-ai-public-v*.zip`). |
| `codegen-hh` | Playwright codegen против живого hh.ru — подбор селекторов. |

Типичные флаги отладки у скриптов с браузером: `--stay-open` (см. [README.md](README.md)).

## Данные и конфиг

Источник путей: [lib/paths.mjs](lib/paths.mjs).

| Путь / переменная | Назначение |
|-------------------|------------|
| `data/vacancies-queue.json` | Очередь вакансий; у записи есть `id` для `--id=…`. |
| `data/skipped-vacancies.jsonl` | Пропущенные вакансии. |
| `data/feedback.jsonl` | Обратная связь. |
| `data/cover-letter-user-edits.jsonl` | Правки писем пользователем. |
| `data/hh-apply-chat.log` | Лог сценария «отклик в чате». |
| `HH_SESSION_DIR` / `data/session/chromium-profile` | Профиль браузера (см. [.env.example](.env.example)). |
| `config/preferences.json` | Настройки приложения. |
| `CV/` | Материалы резюме для контекста. |

Секреты и ключи не дублировать в ответах; ориентир — [.env.example](.env.example) и `config/secrets.example.env` / локальные файлы из доков.

## Селекторы Playwright (где чинить поломки UI)

- **Форма отклика** (кнопка «Откликнуться», поле письма в модалке): [lib/hh-response-selectors.mjs](lib/hh-response-selectors.mjs), скрипт [scripts/hh-fill-response-letter.mjs](scripts/hh-fill-response-letter.mjs).
- **Отклик + чат**: [lib/hh-chat-selectors.mjs](lib/hh-chat-selectors.mjs), скрипт [scripts/hh-apply-chat-letter.mjs](scripts/hh-apply-chat-letter.mjs).

При смене вёрстки hh.ru: открыть нужную страницу вручную, `npm run codegen-hh`, обновить селекторы **в этих lib-файлах** (не размазывать по проекту). Дополнительно — паузы/джиттер: [lib/hh-human-delay.mjs](lib/hh-human-delay.mjs), лимиты: [lib/hh-apply-rate.mjs](lib/hh-apply-rate.mjs).

## Ограничения и ожидания

- Массовая автоматизация откликов может **противоречить правилам** hh.ru; проект рассчитан на **умеренное** использование и ручной контроль.
- **Капча / проверки:** [lib/hh-captcha-wait.mjs](lib/hh-captcha-wait.mjs) — пауза до ручного решения в том же Chromium; перед проверкой логина вызывается из [lib/hh-session-check.mjs](lib/hh-session-check.mjs) (`assertHhLoggedIn`).
- Не отключать и не обходить human-delay / rate-limiting **ради скорости**, если пользователь явно не попросил.
- `hh-fill-letter` по задумке **не** отправляет отклик — это не баг.

## Дашборд и модалка «Настройки»

- UI: `dashboard/public/`, сервер `scripts/dashboard-server.mjs`, порт `DASHBOARD_PORT` (3849).
- Логика настроек: `settings-modal.mjs`, `settings-modal-layout.mjs`, `settings-targeting-nav.mjs`; открытие — `openDashboardSettings()` в `app.js`.
- Перед коммитом UI: `npm run check:dashboard` (синтаксис + JSDoc + DOM-контракт). E2E: `npm run test:dashboard-settings` (дашборд должен быть запущен).
- Типичный сбой «Настройки не открываются» — синтаксис в `dashboard/public/*.mjs` (оборванный `/**` без `*/`); см. [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Письма и стиль

Кратко: шаблон [config/cover-letter.example.txt](config/cover-letter.example.txt); личный файл (например `config/cover-letter.txt`) — в `.gitignore` по желанию. В дашборде после **Утвердить** письма попадают в очередь эталонов стиля для следующих генераций; опционально `config/cover-letter-style-examples.txt` (разделитель `---` на отдельной строке). Подробности и переменные окружения для LLM — [reference.md](reference.md).
