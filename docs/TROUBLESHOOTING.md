# Решение проблем

**Версия:** 2.0.1 · **Репозиторий:** [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)

## Личный Chrome и автоматизация

Автоматизация hh.ru использует **отдельный** профиль: `data/session/chromium-profile` (не ваш рабочий Chrome с закладками).

| Нельзя | Можно |
|--------|--------|
| `taskkill /IM chrome.exe`, `Stop-Process -Name chrome` | Закрыть только окно Chromium, открытое скриптом hh-ru-apply |
| Чистить `%LOCALAPPDATA%\Google\Chrome` | Удалить `SingletonLock` только в `data/session/chromium-profile/` |
| Убивать все процессы Chrome | Остановить дашборд по PID порта 3849 |

Если дашборд «занял» браузер — закройте **окно автоматизации**, а не весь Chrome.

## Авторизация hh.ru

| Симптом | Решение |
|---------|---------|
| Редирект на логин | `npm run login`, затем Enter после входа |
| `npm run apply` падает | Удалить устаревшую сессию не нужно — просто повторить login |

## Капча / «не робот»

| Симптом | Решение |
|---------|---------|
| Скрипт ждёт | Решите капчу **в том же** окне Chromium |
| Ошибка в headless | Уберите `HH_HEADLESS=1` или откройте видимый браузер |
| Таймаут | Увеличьте `HH_CAPTCHA_WAIT_MS` |

Модуль: `lib/hh-captcha-wait.mjs`.

### Ложная «анкета» из капчи (2 поля «Текст с картинки»)

При капче hh.ru Playwright видит поля ввода картинки — они **не** анкета работодателя.

| Действие | Команда / UI |
|----------|----------------|
| Отчёт по очереди | `npm run devops:audit-captcha-questionnaires` |
| Сбросить все ложные | `npm run devops:fix-captcha-questionnaires -- --apply` |
| Одна карточка | дашборд → «Вопросы» → **«Это капча, не анкета»** |
| Все разом в UI | `POST /api/questionnaire/clear-captcha` с `{ "fixAll": true }` |

После сброса карточки снова в **«Без анкет»** / **«Очередь»**. Решите капчу и повторите отклик.

## Батч и отклик

| Симптом | Решение |
|---------|---------|
| `не выбрано резюме «DevOps»` / остаётся Data Engineer | `config/resume-routing.json` — hash для DevOps/Data/поддержки; `npm run devops:preview-resume-routing` |
| Неверное резюме для вакансии | Правка правил в `lib/resume-routing.mjs` или `config/resume-routing.local.json` |
| `анкета: N вопр.` | Норма для «Без анкет»; дозаполнить в разделе «Анкета» |
| `exit 1` в старых логах | Обновите до 2.0 — должны быть текстовые причины |
| Батч «завис» | Проверить Chromium, капчу; стоп в дашборде → `data/batch-control.json` |
| Лимит откликов | Подождать или снизить лимиты в env / дашборде |

Лог: `data/hh-apply-chat.log` · скрины: `data/hh-apply-chat-error-*.png`.

## Дашборд

| Симптом | Решение |
|---------|---------|
| Пустая страница / старый UI | **Ctrl+F5** |
| Порт занят | Другой `DASHBOARD_PORT` или завершить старый `node scripts/dashboard-server.mjs` |
| Не стартует сервер | Запускать из корня проекта, `npm install` |

После kill процесса на 3849 сервер мог оставить фоновые задачи — перезапустите терминал с `npm run dashboard`.

## Harvest / LLM

| Симптом | Решение |
|---------|---------|
| Нет оценок | Ключ OpenRouter, `HH_LLM_MAX_PER_RUN` > 0 |
| Квота OpenRouter | `HH_CUSTOM_LLM_*` или смена модели |
| Странные скоры | Проверить `CV/`, тексты читаемые |
| Пустая выдача на hh.ru | Уберите длинный `HH_SEARCH_EXCLUDE_TOKENS` из URL (режим по умолчанию `url-safe`), `HH_SEARCH_SALARY=0`. В URL — только senior/lead/1с; developer/python отсекаются при сборе по заголовку. Не используйте `maxMonthlyRubSearch` как salary в URL |

## Playwright / селекторы

| Симптом | Решение |
|---------|---------|
| Element not found | `npm run codegen-hh`, обновить `lib/hh-response-selectors.mjs`, `lib/hh-chat-selectors.mjs` |

## Git / релиз

| Симптом | Решение |
|---------|---------|
| Случайно закоммитили `.env` | Удалить из истории, ротировать ключи |
| `release:public` без zip (Windows) | Обновить до коммита с fix `lib/archive.mjs` или вручную `Compress-Archive` |

## Проверка установки

```bash
npm run verify:local
npm run verify:local -- --start-dashboard
```

Если проблема не описана — откройте [issue](https://github.com/emildg8/HH_Ai/issues) **без** секретов и полных дампов очереди.
