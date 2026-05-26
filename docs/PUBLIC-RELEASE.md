# HH Ai 2.0.1 — для нового пользователя

**Скачать:** [hh-ai-public-v2.0.1.zip](https://github.com/emildg8/HH_Ai/releases/latest)  
**Минимум ручного труда:** [FIRST-RUN.md](FIRST-RUN.md) · **5 шагов:** [QUICKSTART.md](QUICKSTART.md)

---

## Что внутри zip

| Есть | Нет (создаёт install) |
|------|------------------------|
| Код, дашборд, примеры конфигов | Сессия hh.ru |
| `docs/`, `EXPORT-README.md`, `FIRST-RUN.md` | Ваши вакансии и CV |
| `data/vacancies-queue.example.json` — демо | API-ключи, hash резюме |
| `config/*.example.*` | Логи и скриншоты ошибок |

---

## Установка за 4 шага

### 1. Распакуйте

Путь **без кириллицы**, например `C:\Tools\hh-ai`.

### 2. Установщик (всё копирует сам)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

```bash
bash scripts/install.sh
```

Создаёт: `.env`, `secrets.local.env` (без LLM), профиль `devops`, шаблон письма, `resume-routing.json` из example.

### 3. Два поля и вход

| Действие | Где |
|----------|-----|
| Название резюме на hh.ru | `config/profiles/devops.env` → `HH_PROFILE_RESUME_TITLE=...` |
| Вход | `npm run login` |

**LLM (опционально):** `npm run setup` → пресет OpenRouter → ключ в `secrets.local.env`.

### 4. Дашборд

```bash
npm run setup:check
npm run dashboard
```

→ **http://127.0.0.1:3849**

---

## Сценарии

| Задача | Как |
|--------|-----|
| Сбор вакансий | `npm run harvest` или **Сбор** в сайдбаре |
| Массовый отклик | Вкладка **«Без анкет»** → батч ([BATCH.md](BATCH.md)) |
| Аналитика | Кнопка **Аналитика** в сайдбаре |
| Анкета | Вкладка **«Анкета»** → ответы → отклик |
| Капча | Решить в окне Chromium |

---

## Проверка

```bash
npm run verify:local
```

---

## Безопасность

Не публикуйте `.env`, `data/session/`, очереди, `CV/`, `config/resume-routing.json` с вашими hash. [SECURITY.md](../SECURITY.md)

## Лицензия

MIT · [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)
