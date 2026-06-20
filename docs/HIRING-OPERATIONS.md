# Поиск работы: ежедневный цикл

Краткая инструкция на русском — без лишних терминов.

## Цель

Найти работу через автоматический цикл: поиск → отбор → отклик → ответы в чатах → собеседования → офферы.

## Утренний цикл (одна команда)

```powershell
npm run devops:plan-rollback -- --save
npm run devops:daily-routine -- --with-harvest
```

Что происходит:

1. Синхронизация статусов откликов с hh.ru
2. Синхронизация чатов
3. Сбор новых вакансий (если `--with-harvest`)
4. Доп. источники: `--with-habr-harvest` (Habr + Telegram + ATS)
5. Цикл обучения — сводка в `data/intelligence-digest.json` (метрики `bySource`, `byTier`)
6. Авто-ответы в чатах, где нужен ответ

## Мульти-источниковый ingest

| Команда | Источник |
|---------|----------|
| `npm run harvest` | hh.ru |
| `npm run devops:harvest-habr` | Habr Карьера |
| `npm run devops:harvest-telegram` | @g_jobbot, EkleftJob |
| `npm run devops:harvest-ats` | ATS (Greenhouse, Lever, …) |
| `npm run devops:harvest-all` | habr + telegram + ats |
| `npm run devops:ingest-url -- <url>` | одна ссылка в очередь |

Режимы отклика: `hh_auto` (только hh), `manual_link` (Habr/Telegram), `ats_form` (прямая форма).

Документы: [SOURCE-EXPERTISE.md](SOURCE-EXPERTISE.md), [HIRING-HR-PLAYBOOK.md](HIRING-HR-PLAYBOOK.md).

## Автоматизация при запущенном дашборде

Пока работает `npm run dashboard` (порт `:3849` по умолчанию), каждую минуту проверяются расписания:

| Процесс | По умолчанию | Слоты (МСК) | Где включить |
|---------|--------------|-------------|--------------|
| **Авто-подъём резюме** | вкл | 8, 12, 16, 20 | Сайдбар «Подъём резюме» или Настройки → Сервисы |
| **Follow-up чатов** | выкл | 10, 18 | Сайдбар или Настройки → Сервисы |

Follow-up при включении: sync чатов, черновики nudge, опционально Telegram.

**Скрытый запуск дашборда (Windows):** `npm run dashboard:hidden` — без окна консоли.

**Фоновые скрипты без cmd:** Настройки → Профиль и система → «Без окна консоли (cmd)» (по умолчанию вкл).

Конфиги: `config/resume-raise-schedule.json`, `config/chat-follow-up-schedule.json`.

Отдельно (не дашборд): Telegram-бот (`npm run telegram-bot`), вечерний дайджест (`npm run devops:daily-digest`).

## Батч откликов

```powershell
npm run devops:apply-batch
```

Перед откликом система проверяет:

- зарплату (вилка vs ваш минимум)
- ключевые слова (резюме vs вакансия)
- дубли по компании за 30 дней
- чёрный список работодателей

Письма утверждаются **автоматически** при `pass` и оценке ≥ `batchLetterMinScore10` (Настройки → Письма). В батче тот же порог режет слабые письма.

## Операционный ритм (волна 1)

Перед первым батчем после обновления плана:

```powershell
npm run devops:intelligence-baseline
npm run devops:ops-readiness
npm run test:ops-readiness
```

Строгая проверка в батче: `npm run devops:apply-batch -- --strict-ops`

Подробно: [OPS-RHYTHM.md](OPS-RHYTHM.md) · [HANDOFF-TEMPLATE.md](HANDOFF-TEMPLATE.md)

## Срезы и отчёты

| Команда | Назначение |
|---------|------------|
| `npm run devops:intelligence-baseline` | Базовая линия воронки |
| `npm run devops:ops-readiness` | Проверка готовности (hr-screening, baseline) |
| `npm run test:ops-readiness` | Автотесты OPS |
| `npm run devops:intelligence-loop` | Текущая сводка |
| `npm run devops:plan-snapshot` | Снимок в `data/plan-snapshots/` |
| `npm run test:intelligence` | Тесты цикла обучения |

В дашборде: `GET /api/intelligence-digest`, `GET /api/outcome-buckets` — корзины A–F.

## Подгонка резюме (Resume Engine)

При батче с `--tailor-resume` (по умолчанию в `devops:apply-batch`):

1. **L2** — блок «О себе» на hh.ru, если пробел по ключам &lt; 40% (лимит `resumeEditMaxPerDay`)
2. **L3** — PDF резюме под вакансию (`lib/tailor-resume.mjs`)

Политика ключей: `config/resume-keyword-policy.example.json`

## Откат настроек

```powershell
npm run devops:plan-rollback -- --save
npm run devops:plan-rollback
npm run devops:plan-rollback -- --list
```

## Ваша помощь (минимум)

- Капча / логин hh.ru — по запросу в Telegram или в окне Chromium
- Собеседования и выбор оффера — вы

## Файлы настроек

| Файл | Смысл |
|------|-------|
| `config/preferences.json` | Таргетинг, лимиты, авто-утверждение писем |
| `config/hr-screening-answers.json` | Стандартные ответы рекрутеру (скопируйте из `.example`) |
| `data/intelligence-digest.json` | Последняя сводка воронки |
| `data/employer-blacklist.json` | Компании-ghost (создаётся автоматически) |

## Корзины воронки

| Буква | Смысл |
|-------|-------|
| A | Вакансия уже закрыта |
| B | Работодатель не ответил (ghost) |
| C | Шаблонный отказ |
| D | Идёт диалог |
| E | Назначен слот собеседования |
| F | Оффер |

## Поднятие резюме

```powershell
npm run devops:raise-resumes -- --all
```

Рекомендуется перед harvest.

## Авто-ответы в чатах отдельно

```powershell
npm run devops:auto-chat-reply -- --dry-run
npm run devops:auto-chat-reply
```

## Суфлёр и Live Copilot

| Действие | Как |
|----------|-----|
| Подготовка | Дашборд → **Собесы** → слот E → **Тех. вопросы** / prep-pack |
| Контекст ответов | Кнопка preview: `POST /api/interview-copilot/context/preview` |
| Окно поверх Zoom | **Поверх + живой** (HH Ai Desktop) — один `live/start` через capture |
| Окно сценария | `teleprompter-prep.html` — заготовленный текст (PREP_SCRIPT.md) |
| Прогон без Zoom | `npm run devops:copilot-simulate -- --file scripts/fixtures/interview-transcript-mini.json` |
| Репетиция по записи | «Прогон на записи» / simulate — только реплики ведущих |
| Живой созвон | Desktop → **Поверх + живой** или `npm run devops:copilot-capture` |
| После собеса | debrief в панели + follow-up в чат (≤ 24 ч) + offer-tracker |

В live overlay — **только фраза для речи** (`scriptOnlyOverlay`). Память живых ответов: mic или «Ответил сам» → следующие подсказки не противоречат.

Требования: `ffmpeg` (WASAPI), `whisper` или faster-whisper, CV в `CV/`, дашборд `:3849`, для overlay — Desktop. Список устройств: `npm run devops:copilot-devices`.

Проверки:

```powershell
npm run test:interview-copilot-qa
npm run test:interview-copilot-live
npm run test:interview-speaker-role
npm run test:interview-copilot-offer-guard
npm run test:copilot
npm run test:interview-copilot-spoken
npm run devops:copilot-simulate -- --dry-run
npm run desktop:check
```
