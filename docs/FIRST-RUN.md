# Первый запуск — что обязательно, что опционально

**Версия:** 3.2.0 · Полный путь: [QUICKSTART.md](QUICKSTART.md) · zip/desktop: [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md)

Цель: после `install` + `setup` + `login` дашборд уже работает **без API-ключей** (локальная оценка). LLM и несколько резюме — по желанию.

---

## Автоматически (install)

Скрипт `scripts/install.ps1` / `install.sh` создаёт:

| Файл | Назначение |
|------|------------|
| `.env` | Порты, пути сессии |
| `config/secrets.local.env` | Режим **без LLM** (`HH_LLM_MAX_PER_RUN=0`) |
| `config/profiles/devops.env` | Профиль поиска DevOps |
| `config/cover-letter.txt` | Шаблон письма |
| `config/resume-routing.json` | Из `resume-routing.example.json` (1 резюме достаточно) |
| `data/`, `CV/` | Пустые каталоги |
| `data/vacancies.json` | **Демо-очередь** (5 вакансий) — если файла ещё не было |

Проверка: `npm run setup:check`

Быстрый старт без wizard: `npm run setup:first-run -- --demo`

---

## Обязательно вручную (≈2 минуты)

| # | Действие | Где |
|---|----------|-----|
| 1 | **Войти на hh.ru** | `npm run login` → Chromium → Enter |
| 2 | **Название резюме** как на hh.ru | `config/profiles/devops.env` → `HH_PROFILE_RESUME_TITLE=...` |

После этого: `npm run dashboard` → **http://127.0.0.1:3849**

---

## Рекомендуется (5 минут)

| Задача | Как |
|--------|-----|
| LLM-оценка и письма | `npm run setup` → пресет OpenRouter → ключ в `config/secrets.local.env` |
| Точный выбор резюме в батче | `npm run devops:list-resumes` → `HH_PROFILE_RESUME_HASH` в профиле |
| Несколько резюме (DevOps / Data / …) | Правка `config/resume-routing.json` (hash по ролям) |
| Контекст для модели | `CV/resume.pdf` или `.md` |

---

## Не нужно на старте

- Telegram, Docker, несколько профилей
- `resume-routing.local.json` — только если нужны личные правила поверх example
- Правка `preferences.json` — разумные значения уже в репозитории
- Hash в routing — если одно резюме и задан `HH_PROFILE_RESUME_TITLE`

---

## Демо без своих вакансий

```bash
npm run dashboard
# Сервер с демо-очередью (для скринов/QA):
node scripts/dashboard-server.mjs --queue-file=./docs/demo/vacancies-demo.json
```

---

## Чеклист перед батчем

1. `npm run setup:check` — без красных «→»
2. `npm run apply` — сессия жива
3. В дашборде: вкладка **«Без анкет»** для массового отклика
4. Лимиты в **Настройки** (модалка в UI)

Подробно: [BATCH.md](BATCH.md) · [CONFIG-GUIDE.md](CONFIG-GUIDE.md)
