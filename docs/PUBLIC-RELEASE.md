# HH Ai 2.0 — для нового пользователя

**Скачать:** [hh-ai-public-v2.0.0.zip](https://github.com/emildg8/HH_Ai/releases/latest)  
**Быстрый старт:** [QUICKSTART.md](QUICKSTART.md) (5 шагов)

---

## Что внутри zip

| Есть | Нет (настраиваете сами) |
|------|-------------------------|
| Код, дашборд, примеры конфигов | Сессия hh.ru |
| `docs/`, `EXPORT-README.md` | Ваши вакансии и CV |
| `data/vacancies-queue.example.json` — демо-очередь | API-ключи, hash резюме |
| Скрипты `install.ps1` / `install.sh` | Логи и скриншоты ошибок |

---

## Установка

### 1. Распакуйте

Путь **без кириллицы**, например `C:\Tools\hh-ai`.

### 2. Запустите установщик

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

```bash
bash scripts/install.sh   # macOS / Linux
```

Скрипт: `npm install`, Chromium, копирует `.env`, `secrets.local.env`, профиль, шаблон письма.

### 3. Настройте (2 минуты)

| Файл | Что указать |
|------|-------------|
| `config/secrets.local.env` | `OPENROUTER_API_KEY=...` *(опционально)* |
| `config/profiles/devops.env` | `HH_PROFILE_RESUME_TITLE=...` |
| `config/cover-letter.txt` | Ваш шаблон письма |

### 4. Вход и дашборд

```bash
npm run login      # войти на hh.ru → Enter
npm run dashboard  # http://127.0.0.1:3849
```

---

## Сценарии

| Задача | Как |
|--------|-----|
| Сбор вакансий | `npm run harvest` или кнопка в UI |
| Массовый отклик | Вкладка **«Без анкет»** → батч ([BATCH.md](BATCH.md)) |
| Анкета | Вкладка **«Анкета»** → ответы → отклик |
| Капча | Решить в окне Chromium |

---

## Проверка

```bash
npm run verify:local
```

---

## Безопасность

Не публикуйте `.env`, `data/session/`, очереди, `CV/`. [SECURITY.md](../SECURITY.md)

## Лицензия

MIT · [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)
