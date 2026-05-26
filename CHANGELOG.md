# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версии — [SemVer](https://semver.org/lang/ru/).

## [2.0.1] — 2026-05-22

Срез после публикации **2.0.0**: CRM-дашборд, воронка по всем очередям, роутинг резюме, pipeline анкет, безопасный URL поиска на hh.ru, инфраструктура мейнтейнера и CI. Публичный zip: `npm run release:public` → `releases/hh-ai-public-v2.0.1.zip`. Тег: `v2.0.1`.

### Added

- **Онбординг:** `docs/FIRST-RUN.md` — что обязательно (2 поля) vs опционально; `install` копирует `no-llm` preset и `resume-routing.json` из example.

- **Дашборд CRM:** вкладки сайдбара (Рутина / Работа / Отчёты / Настройки), KPI и мини-воронка, модалка **«Аналитика»** с разбивкой по резюме и динамикой откликов (`lib/funnel-analytics.mjs`, `lib/queue-aggregate.mjs`, `dashboard/public/funnel-timeline.mjs`).
- **Поиск в списке:** вакансия, компания, резюме, чат, письмо (`dashboard/public/vacancy-search.mjs`).
- **Настройки:** модалка с вкладками (отклики / список / интерфейс), фильтры карточек вынесены из шапки.
- **Роутинг резюме:** `config/resume-routing.json`, `lib/resume-routing.mjs`, `lib/hh-resume-picker.mjs`; `npm run devops:preview-resume-routing`, `devops:probe-response-resumes`.
- **Анкета:** pipeline (`lib/questionnaire-pipeline.mjs`), disclosure, special-answers, user-edits; batch prep/reprobe (`questionnaire-prep-batch`, `questionnaire-reprobe-batch`); `docs/QUESTIONNAIRE-AUTOMATION.md`.
- **Очередь и отклики:** `docs/QUEUE-AND-APPLY.md`, `lib/hh-vacancy-response-state.mjs`, `npm run devops:prune-responded-queue`, `devops:probe-vacancy-state`.
- **Harvest:** статистика SERP (`serpCards`, `skippedKnown`, …), понятные сообщения при «0 новых».
- **Поиск hh.ru:** `lib/hh-search.mjs` — режим `url-safe`, `resolveHhSearchSalary()` (по умолчанию зарплата не попадает в URL), `HH_SEARCH_SALARY=0` в примерах профиля.
- **Синхронизация:** `devops:sync-responses`, `sync-chats`, `sync-resume-variants`, `apply-negotiations-cache`, `daily-routine`.
- **Мейнтейнер:** `npm run setup`, `secrets:check`, `hooks:install`; CI `smoke:release`; workflow [release.yml](.github/workflows/release.yml) при теге `v*`; `docs/MAINTAINER.md`, `docs/QA-CLEAN-INSTALL.md`, `docs/HIRING-ROADMAP.md`.

### Changed

- **Воронка:** агрегация по всем `data/vacancies*.json` + кэш переговоров; конверсия и summary через union-очередь.
- **Форма отклика:** выбор резюме через `resumeId` в URL и fallback по hash (`lib/hh-resume-upload.mjs`, `lib/hh-response-modal.mjs`).
- **Дашборд:** API расширен (`dashboard-server.mjs`), демо-очередь обновлена.
- **Документация:** `docs/TROUBLESHOOTING.md` (пустая выдача hh.ru, URL поиска), `docs/CONFIG.md`, `docs/CONTINUATION.md`.

### Fixed

- Модалка воронки открывалась с неверным корнем (`openModalEl` → `#funnel-modal`).
- График динамики откликов: нулевые дни не рисуются «полоской» на всю высоту; агрегация по неделям при длинном периоде.
- Git hooks на Windows (`install-git-hooks`, pre-push).
- Zip на Windows (`Compress-Archive -Path`) — из цепочки 2.0.0, зафиксировано в срезе.

## [2.0.0] — 2026-05-20

Крупный релиз: батч-отклики с анкетами, понятный журнал пропусков, harvest/фильтры, капча, улучшения LLM и UI дашборда. Публичная копия: `npm run release:public` → `releases/hh-ai-public-v2.0.0.zip`. Документация: [docs/README.md](docs/README.md), репозиторий [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai).

### Added

- **Батч:** области запуска `queue` / `noQuestionnaire` / `questionnaire` / `hidden` (`lib/batch-scope.mjs`, вкладки дашборда).
- **Батч + анкета:** при обнаружении анкеты отклик не отправляется, вопросы сохраняются в карточку (раздел «Анкета»), батч продолжается; код выхода `5` (`HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED`); лимиты откликов за день/час **не** списываются.
- **Журнал батча:** понятные причины пропуска вместо `exit 1` — например `не выбрано резюме «DevOps»`, `анкета: 20 вопр.` (`lib/batch-skip-reason.mjs`).
- **Harvest:** эвристика «вероятная анкета» по тексту описания (`lib/harvest-questionnaire-hint.mjs`, `HH_HARVEST_QUESTIONNAIRE_HINT`).
- **Фильтры:** предфильтр по заголовку на выдаче (`runTitleOnlyFilters`), паттерны `excludeIrrelevantTitles` в `preferences.json`, `HH_SEARCH_EXCLUDE_TOKENS`, `HH_LOCAL_SCORE_MIN`.
- **Капча:** ожидание ручного решения в Chromium (`lib/hh-captcha-wait.mjs`, `HH_CAPTCHA_WAIT_MS`).
- **Резюме в форме отклика:** улучшенный выбор по `HH_PROFILE_RESUME_TITLE` / `HH_PROFILE_RESUME_HASH` (`lib/hh-resume-upload.mjs`).
- **OpenRouter:** цепочка fallback-моделей при недоступности модели; устойчивый разбор обрезанного JSON вариантов писем.
- **UI дашборда:** плотность карточек (compact / medium / full), тонкая настройка карточек (`ui-card-tuning`), локальные пресеты (`local-dashboard-defaults.example.mjs`), выбор вариантов в анкете (`questionnaire-choice.mjs`).
- **Анкета:** расширенный сбор вопросов в батче (`collectBestQuestionnaire`), улучшенные подписи полей, probe + `needsProbe`.
- **Релиз для передачи:** `npm run release:public`, `docs/PUBLIC-RELEASE.md`, `EXPORT-README.md` в архиве.
- **Документация HH Ai:** `docs/README.md`, `QUICKSTART`, `USAGE`, `BATCH`, `DASHBOARD`, `CONFIG`, `TROUBLESHOOTING`, скриншоты в `docs/screenshots/`.
- **Установка под ключ:** `scripts/install.ps1`, `scripts/install.sh`, `npm run smoke:release`.

### Changed

- Парсинг описания вакансии на странице hh.ru (`lib/vacancy-parse.mjs`).
- Регенерация писем: фильтр нерелевантных ролей, двухфазный brief.
- Дашборд: масштаб UI 85–115% без поломки модалок и анкеты.

### Fixed

- Закрытие модалки анкеты по клику на фон (`data-close-modal`).
- Батч не «зависает» на анкете — отложенный отклик с кодом `5`.

### Security

- Публичный экспорт по-прежнему без `.env`, сессии, очередей, CV, hash резюме; расширена зачистка ключей в текстовых файлах.

## [1.0.1] — 2026-05-22

### Fixed

- Масштаб UI 85–115%: оболочка `#app-shell`, модалки вне zoom — нет пустых полей и сломанной анкеты.
- Закрытие анкеты по фону (data-close-modal).

### Added

- `npm run verify:local`, плотность карточек (compact / medium / full).
- Подробный `docs/ROADMAP.md`, `docs/ATTRIBUTION.md`, обновлённые инструкции.

## [1.0.0] — 2026-05-19

### Added

- Дашборд: очередь, оценки, письма LLM, анкета работодателя, светлая/тёмная тема, масштаб UI.
- Профиль DevOps: harvest, rescore, batch-отклики, отклонение похожих ролей.
- Playwright: отклик, чат, анкета, probe-questionnaire.
- Скрипты: `backup`, `release:pack`, `export:public`, профили `HH_PROFILE`.
- Документация: SECURITY, ROADMAP, DISTRIBUTION, GitHub CI/шаблоны.

### Security

- Секреты и сессии вне git; публичный экспорт без cookies и ключей.

[2.0.1]: https://github.com/emildg8/HH_Ai/releases/tag/v2.0.1
[2.0.0]: https://github.com/emildg8/HH_Ai/releases/tag/v2.0.0
[1.0.1]: https://github.com/emildg8/HH_Ai/releases/tag/v1.0.1
[1.0.0]: https://github.com/emildg8/HH_Ai/releases/tag/v1.0.0
