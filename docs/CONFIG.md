# Конфигурация HH Ai

**Версия:** 2.0.0

## Файлы (порядок загрузки)

| Файл | В git | Назначение |
|------|-------|------------|
| `.env` | нет | Общие переменные (из `.env.example`) |
| `config/secrets.local.env` | нет | OpenRouter, Telegram |
| `config/profiles/<id>.env` | нет | Профиль вакансии (`HH_PROFILE`) |
| `config/devops.env` | нет | Legacy DevOps (если без profiles/) |
| `config/preferences.json` | да | Фильтры ролей, веса скоров, UI дашборда |
| `config/cover-letter.txt` | нет | Шаблон письма |
| `config/search-keywords*.txt` | да | Запросы для поиска |

Профиль: `HH_PROFILE=devops` → `config/profiles/devops.env`.

```bash
npm run profile:init -- --id=backend --title="Backend"
npm run profile:list
```

## Резюме на hh.ru (отклик)

В профиле:

```env
HH_PROFILE_RESUME_TITLE=DevOps
HH_PROFILE_RESUME_HASH=806e0f3a...   # npm run devops:list-resumes
```

## Поиск и harvest

| Переменная | Описание |
|------------|----------|
| `HH_KEYWORDS_FILE` | Файл ключевых слов |
| `HH_VACANCIES_QUEUE_FILE` | Путь к очереди JSON |
| `HH_SEARCH_PERIOD` | Период выдачи (7 = неделя) |
| `HH_SEARCH_EXCLUDE_TOKENS` | Минус-слова в URL hh.ru |
| `HH_LOCAL_SCORE_MIN` | Минимум локального скора без LLM |
| `HH_HARVEST_QUESTIONNAIRE_HINT` | Пометка «вероятная анкета» по тексту (0 = выкл.) |
| `HH_LLM_MAX_PER_RUN` | Сколько LLM-оценок за harvest |
| `HH_OPENROUTER_MAX_CALLS_PER_RUN` | Лимит OpenRouter до fallback на custom LLM |

Фильтры заголовков: `config/preferences.json` → `excludeIrrelevantTitles`, `notDeveloperRole`, …

## LLM

| Переменная | Описание |
|------------|----------|
| `OpenRouter_API_KEY` | В `secrets.local.env` |
| `OPENROUTER_MODEL` | Модель (например `openrouter/free`) |
| `HH_CUSTOM_LLM_BASE_URL` | Ollama / LM Studio |
| `HH_CUSTOM_LLM_MODEL` | Имя модели |

Подробно: [config/OPENROUTER.md](../config/OPENROUTER.md).

## Отклик и батч

| Переменная | Описание |
|------------|----------|
| `HH_FAST` | Быстрый fill (1 в батче по умолчанию) |
| `HH_HEADLESS` | 1 = без окна (капча не ждёт) |
| `HH_BATCH` | 1 — режим батча (ставится скриптом) |
| `HH_CAPTCHA_WAIT_MS` | Ожидание решения капчи (600000 = 10 мин) |
| `HH_QUESTIONNAIRE_AUTO` | Авто-ответы анкеты при отклике |
| `HH_MAX_APPLY_*` | Лимиты откликов час/день/месяц |

## Сопроводительные

| Переменная | Описание |
|------------|----------|
| `COVER_LETTER_VARIANT_COUNT` | Вариантов за генерацию |
| `COVER_LETTER_TWO_PHASE` | Бриф + письма |
| `COVER_LETTER_STYLE_MAX_CHARS` | Лимит эталонов стиля |

## Дашборд

| Переменная | Описание |
|------------|----------|
| `DASHBOARD_PORT` | Порт (3849) |

Пресеты UI: `dashboard/public/local-dashboard-defaults.mjs` (из `.example.mjs`).

## Данные (не в git)

| Путь | Содержимое |
|------|------------|
| `data/session/` | Chromium profile |
| `data/vacancies-*.json` | Очередь |
| `data/hh-apply-chat.log` | Лог откликов и батча |
| `data/batch-*.json` | Прогресс и управление батчем |
| `CV/` | PDF/md резюме для LLM |

## Проверка перед git push

```bash
npm run export:public
# просмотр dist/hh-ai-public — без ключей и очередей
```
