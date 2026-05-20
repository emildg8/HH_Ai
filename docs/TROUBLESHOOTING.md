# Решение проблем

**Версия:** 2.0.0 · **Репозиторий:** [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)

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

## Батч и отклик

| Симптом | Решение |
|---------|---------|
| `не выбрано резюме «DevOps»` | `npm run devops:list-resumes` → `HH_PROFILE_RESUME_HASH` в профиле |
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
| Пустая выдача | Ослабить `HH_SEARCH_EXCLUDE_TOKENS` |

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
