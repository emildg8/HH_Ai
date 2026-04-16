# hh-ru-apply

Автоматизация работы с [hh.ru](https://hh.ru) на Node.js + Playwright: сбор вакансий, оценка с помощью LLM, генерация сопроводительных писем и отклики через браузер с сохранением сессии.

> **Важно:** Автоматизация откликов и массовые действия могут противоречить правилам сервиса и привести к ограничению аккаунта. Используйте на свой страх и риск.

## Возможности

| Команда | Описание |
|---------|----------|
| `npm run login` | Вход на hh.ru с сохранением браузерного профиля (повторный логин не требуется) |
| `npm run vacancies` | Поиск вакансий по ключевым словам с hh.ru |
| `npm run harvest` | Сбор и оценка вакансий через LLM (OpenRouter) — три скора: релевантность, совпадение с CV, общий |
| `npm run dashboard` | Веб-дашборд для просмотра очереди, генерации и редактирования сопроводительных |
| `npm run scan-tg` | Сканирование вакансий из Telegram-каналов через бота |
| `npm run hh-fill-letter` | Вставка сопроводительного письма в форму отклика на странице вакансии (без авто-отправки) |
| `npm run hh-apply-chat` | Отклик с письмом в чате с работодателем |
| `npm run codegen-hh` | Генерация/обновление селекторов Playwright через Codegen |

## Требования

- Node.js 18+
- Chromium (устанавливается через Playwright)

## Быстрый старт

### Вариант А: Локальный запуск

```bash
git clone https://github.com/Steev193/hh-ru-apply.git
cd hh-ru-apply
npm install
npx playwright install chromium
cp .env.example .env
```

### Вариант Б: Docker

```bash
git clone https://github.com/Steev193/hh-ru-apply.git
cd hh-ru-apply
cp .env.example .env
# первый вход (сохранение сессии)
docker compose run --rm dashboard npm run login
# запуск дашборда
docker compose up -d
```

Дашборд будет доступен на http://127.0.0.1:3849. Данные сохраняются в локальной папке `data/` через volume.

Для запуска других скриптов в контейнере:

```bash
docker compose run --rm dashboard npm run harvest
docker compose run --rm dashboard npm run hh-fill-letter -- --id=...
```

## Настройка

### 1. Браузерная сессия

```bash
npm run login
```

Откроется окно Chromium. Войдите на hh.ru, затем нажмите Enter в терминале. Профиль сохраняется в `data/session/chromium-profile` и переиспользуется при последующих запусках.

Проверить сессию:

```bash
npm run apply
```

### 2. Ключевые слова для поиска

Отредактируйте [`config/search-keywords.txt`](config/search-keywords.txt) — по одному запросу на строку. Пример:

```
python backend
python developer
senior python developer москва удалённо
```

### 3. CV / Резюме

Положите свои резюме в папку `CV/`. Поддерживаются форматы `.md`, `.txt`, `.pdf`. Они используются при оценке вакансий LLM.

### 4. Шаблон сопроводительного письма

Создайте `config/cover-letter.txt` по образцу [`config/cover-letter.example.txt`](config/cover-letter.example.txt). Файл добавлен в `.gitignore` и не попадёт в репозиторий.

Для сохранения вашего стиля в письмах положите примеры в `config/cover-letter-style-examples.txt` (несколько писем, разделённых `---`). Шаблон — `config/cover-letter-style-examples.example.txt`.

### 5. OpenRouter для оценки вакансий (опционально)

1. Зарегистрируйтесь на [openrouter.ai](https://openrouter.ai/), создайте API key.
2. Добавьте ключ в `config/secrets.local.env`:
   ```
   OpenRouter_API_KEY=sk-or-v1-...
   ```

По умолчанию используется бесплатная модель. Для платных моделей задайте `OPENROUTER_ALLOW_PAID=1`. Подробности — в [`config/OPENROUTER.md`](config/OPENROUTER.md).

### 6. Telegram-бот (опционально)

Для `npm run scan-tg` задайте в `.env`:
```
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=your_chat_id
```

## Использование

### Сбор вакансий

```bash
npm run vacancies
```

Поиск по ключам из `config/search-keywords.txt`. Настройки лимитов, пауз и джиттера — в `.env` (переменные `HH_*`)

### Оценка через LLM

```bash
npm run harvest
```

Результат сохраняется в очередь `data/vacancies-queue.json`. Каждая вакансия получает три оценки:

- **scoreVacancy** (0–100) — насколько объявление релевантно
- **scoreCvMatch** (0–100) — насколько ваше CV покрывает требования
- **scoreOverall** (0–100) — стоит ли откликаться

Веса скоров настраиваются в `config/preferences.json` (`llmScoreWeights.vacancy` и `llmScoreWeights.cvMatch`).

### Дашборд

```bash
npm run dashboard
```

Открывается на http://127.0.0.1:3849. Здесь можно:

- Просматривать очередь вакансий с оценками
- Генерировать сопроводительные письма
- Утверждать / редактировать письма
- Запускать отклик в браузере прямо из интерфейса

### Отклик через форму на странице вакансии

```bash
npm run hh-fill-letter -- --id=<uuid-записи>
```

Открывает страницу, нажимает «Откликнуться», вставляет письмо и ждёт вашей ручной проверки. Можно и по URL

```bash
npm run hh-fill-letter -- --url=https://hh.ru/vacancy/123 --text-file=./letter.txt
```

### Отклик через чат

```bash
npm run hh-apply-chat -- --id=<uuid-записи>
```

Флаги:
- `--stay-open` — не закрывать браузер
- `--dry-run` — открыть чат, но не вставлять письмо
- `--no-submit` — открыть форму отклика без отправки

## Обновление селекторов

Если hh.ru изменил вёрстку и скрипты перестали находить элементы:

```bash
npm run codegen-hh
```

Или вручную через `npx playwright codegen https://hh.ru`, актуальные селекторы в `lib/hh-response-selectors.mjs` и `lib/hh-chat-selectors.mjs`.

## Структура проекта

```
├── scripts/
│   ├── login.mjs                  # Сохранение браузерной сессии
│   ├── apply.mjs                  # Проверка сессии
│   ├── open-vacancies.mjs         # Поиск вакансий
│   ├── harvest.mjs                # Сбор + оценка через LLM
│   ├── scan-telegram.mjs          # Сканирование Telegram-каналов
│   ├── dashboard-server.mjs       # Сервер дашборда
│   ├── hh-fill-response-letter.mjs # Письмо в форме отклика
│   ├── hh-apply-chat-letter.mjs    # Письмо через чат
│   └── codegen-hh.mjs              # Генерация селекторов
├── lib/                           # Общие модули
├── config/                        # Конфигурация, шаблоны, секреты
├── CV/                            # Ваши резюме
├── data/                          # Сессия, очередь, логи (игнорируется)
├── dashboard/                     # Фронтенд дашборда
├── .env.example                   # Шаблон переменных окружения
└── package.json
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `HH_SESSION_DIR` | Путь к папке профиля Chromium |
| `HH_HEADLESS=1` | Безголовый режим |
| `HH_KEYWORDS` | Ключевые слова (через запятую) |
| `HH_KEYWORDS_FILE` | Путь к файлу ключей |
| `HH_MAX_TOTAL` / `HH_SESSION_LIMIT` | Лимит вакансий за запуск |
| `HH_OPEN_DELAY_MIN_MS` | Пауза между открытиями, мс |
| `OpenRouter_API_KEY` | Ключ OpenRouter |
| `OPENROUTER_MODEL` | Модель (по умолчанию `openrouter/free`) |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_CHAT_ID` | ID чата/канала |

Полный список и значения по умолчанию — в [`.env.example`](.env.example).

## Лицензия

MIT
