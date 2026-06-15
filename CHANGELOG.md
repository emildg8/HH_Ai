# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версии — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Добавлено

- **Рынок навыков (2R):** advisory-слой `lib/market-skills.mjs`, `config/market-skills.example.json`, панель в service drawer, `GET /api/market-skills`, `npm run devops:aggregate-market-skills`, флаг `marketSkillsEnabled`.
- **Настройки дашборда:** дефолт модалки 960×840, иконки шапки (close/expand), полировка вкладок «Отклики» и «Интерфейс», seg-btn и чекбокс удалёнки.
- **3.3 prep:** onboarding 4 шага (login → demo → approve → batch), `POST /api/chat-save-draft`, Alt+Shift+L «Письмо &lt;6», `npm run friction:capture`, [ROADMAP-MAP-2026-Q3.md](docs/ROADMAP-MAP-2026-Q3.md).
- **UX:** KPI «Чаты» и «Письмо &lt;6» кликабельны; digest чатов в service drawer (CH-05); сброс wizard из Ctrl+K; `test:chat-save-draft`.

## [3.2.0] — 2026-06-03

Релиз **UX v3**: первый запуск без пустой очереди, чаты в дашборде, полировка UI и автоматические gate-проверки перед тегом.

### Добавлено

- **Первый запуск:** демо-очередь (`POST /api/load-demo-queue`), empty state с кнопкой «Загрузить демо», `npm run setup:first-run`; demo в `install.ps1` / `install.sh` / `install-portable.ps1` и шаг `demo-queue` в `qa:clean-install`.
- **Чаты в дашборде:** модалка `#chat-inbox-modal`, badge в menubar, chip «нужен ответ» → inbox; Gate C (`npm run test:chat-inbox-ui`).
- **UX и аналитика:** AI-подсказки к score (tooltip + плитки), KPI «Без правки» → настройки писем, live preview таргетинга при смене пресета, accordion в service drawer.
- **Дизайн-система v3:** токены `--hh-*`, `dashboard-unify.css`, UI trim (lean toolbar/dock), workflow hint strip, funnel unify, skeleton load.
- **Качество писем:** сайдбар «Письма», letter-center, precheck батча, golden set (22+9), `quality:check` / nightly audit.
- **QA / CI:** `npm run gate-b`, `test:dashboard-screenshots` (DS-07, baseline в `docs/screenshots/baseline/`), `test:dashboard-a11y` (DS-08), `check:dashboard`, расширенный `test:dashboard-settings`; **`npm run verify:release`** — pre-tag чеклист.

### Исправлено

- Модалка «Настройки» не открывалась из‑за незакрытого JSDoc в `settings-modal.mjs`.

### Изменено

- Сайдбар писем: один запрос quality-hub; батч-отчёт с `id` карточки для перехода; pre-commit hook для `dashboard/public/`.

## [3.0.5] — 2026-05-30

### Исправлено

- **Desktop NSIS:** `resources` в `tauri.conf.json` — массив `resources/hh-ai/` вместо glob; `beforeBuildCommand` убран (bundle только в CI); verify шаг перед сборкой.

## [3.0.4] — 2026-05-30

### Fixed

- **desktop-bundle:** создание `bundled/` перед записью bundle-meta (Windows CI).

## [3.0.3] — 2026-05-30

### Fixed

- **Tauri resources:** bundle в `src-tauri/resources/hh-ai/` (стабильный glob на Windows CI).
- **postinstall:** `ensure-dashboard-stubs.mjs` — local-dashboard-defaults без 404.
- **CI:** stub перед dashboard UI smoke.

## [3.0.2] — 2026-05-30

### Fixed

- **Tauri NSIS:** пути resources `../bundled/…` относительно src-tauri.
- **QA/CI dashboard-ui:** stub `local-dashboard-defaults.mjs` в export/install.
- **playwrightChromiumInstalled:** Linux `~/.cache/ms-playwright` (CI и Ubuntu).
- **install.ps1 / install-portable.ps1** — копия local-dashboard-defaults.

## [3.0.1] — 2026-05-30

### Fixed

- **CI:** `rust-toolchain.toml` — корректный формат для Tauri build на Windows.
- **QA clean install:** `setup:check` в режиме `HH_QA_CLEAN` — ожидаемые todo (resume title, variants).
- **Dashboard UI smoke:** нет console 404 от отсутствующего `local-dashboard-defaults.mjs`.

## [3.0.0] — 2026-05-30

«Финальный продукт»: desktop-приложение Windows, автотест установки A+B, CI release с installer.

### Added

- **HH Ai Desktop (Tauri 3.0):** WebView дашборда, sidecar `dashboard-server`, bundled `hh-ai` + `node.exe` в NSIS installer.
- **Экран подготовки:** автозапуск дашборда, кнопка «Установить Chromium», `npm run desktop:install-chromium`.
- **QA clean install A+B:** `npm run qa:clean-install` — git clone + portable zip simulation.
- **CI:** `qa:clean-install`, `desktop:smoke`; release workflow — NSIS `*-setup.exe` на Windows.
- **Скрипты:** `desktop-bundle.mjs`, `desktop-chromium.mjs`, `desktop-sidecar-smoke.mjs`, `start-hh-ai.ps1`, `start-dashboard.bat`.
- **Иконка приложения** и `scripts/make-app-icon.ps1`.

### Changed

- **Версия** 2.2.0 → **3.0.0** (desktop + portable zip в одном релизе).
- **ROADMAP R6.1/R6.2** — desktop shell и установка Chromium в UI.

### Fixed

- **UI smoke headless:** клик `.card-tile__open` с fallback `evaluate(click)`.
- **install-portable.ps1** — паритет с `install.ps1` (secrets, profile, routing).

## [2.2.0] — 2026-05-30

«Умный фон»: portable-релиз, вкладка «Отлож.», дайджест, rescore pending.

### Added

- **Portable zip:** `hh-ru-apply-win-x64-v*.zip` (alias публичного архива) + `start-dashboard.bat` в экспорте.
- **install-portable.ps1** в smoke/verify; инструкция в `EXPORT-README.md`.
- **Модалка «Дайджест дня»** в «Сервис» (Telegram опционально).
- **Отложить на 7 дней:** Shift+клик «Завтра» на карточке.
- **Счётчики на вкладках** очереди (Очередь, Отлож., …).
- **Команда** `npm run devops:rescore-pending` — пересчёт всех pending.
- **Тесты:** `test-export-portable`, `test-apply-view-deferred`.

### Fixed

- **Вкладка «Отлож.»** не переключалась (отсутствовала в обработчике клика).

### Changed

- **release.yml** — оба zip на GitHub Releases.
- **verify:local** — portable + deferred тесты.

## [2.1.0] — 2026-05-30

«Меньше ручной возни»: обратная связь по исходам откликов, профиль в UI, метрики писем, стабильнее батч.

### Added

- **Кнопки «Пригласили» / «Отказ»** на карточках (в т.ч. вкладка «Отклики») → `data/feedback.jsonl` → few-shot в генерации писем (`lib/outcome-feedback.mjs`, `lib/cover-letter-openrouter.mjs`).
- **Few-shot по роли вакансии** — SRE / DBA / platform / devops / support (`lib/cover-letter-style-by-role.mjs`).
- **Выбор HH_PROFILE** в настройках дашборда (`POST /api/profile/select`).
- **Метрики письма** на карточке: % правок, дата отклика (`lib/cover-letter-metrics.mjs`, `card-status.mjs`).
- **A/B/C варианты письма** до утверждения (вкладки в модалке черновика).
- **Сводка feedback** в модалке «Аналитика» (`computeFeedbackStats`).
- **Тесты:** `test-outcome-feedback.mjs`, `test-apply-session.mjs`.

### Fixed

- **Кнопка «Пригласили»** отсутствовала в шаблоне карточки — добавлена в `index.html`.
- **`npm run apply`** — общий Chromium lock (2.0.2).
- **UI-тест дашборда** — стабильнее без `networkidle`.

### Changed

- **Батч:** в отчёте журнала — фактическое резюме hh.ru (`resumeTitleSelected`).
- **Browser guard:** sync/рутина доступны на паузе батча.

## [2.0.2] — 2026-05-30

Стабилизация перед следующим функциональным срезом: проверка сессии через общий Chromium lock, UX-дашборд v3, расширенный `verify:local`.

### Added

- **Дашборд UX v3:** design tokens/components, плитки карточек (`card-tiles.mjs`), command palette, breadcrumbs, keyboard nav, модалка вакансии, sparkline откликов/день, экспорт markdown.
- **Browser guard:** sync/рутина/подъём резюме доступны на паузе батча (`lib/browser-guard.mjs`).
- **Подъём резюме:** `lib/hh-resume-raise.mjs`, расписание `config/resume-raise-schedule.example.json`, блок в «Сервис».
- **Тесты:** `scripts/test-apply-session.mjs`; UX-тесты включены в `npm run verify:local`.

### Fixed

- **`npm run apply`:** единый `launchPersistentContextSafe` + lock + `assertHhLoggedIn` — меньше «browser closed» после перезагрузки ПК ([#4](docs/issues/002-apply-browser-closed.md)).
- **Выбор резюме в батче:** дополнительные попытки и match по hash (`lib/hh-resume-picker.mjs`, `lib/hh-response-modal.mjs`).

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
