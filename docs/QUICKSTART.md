# Быстрый старт HH Ai

**5 шагов** — от нуля до дашборда. Минимум настроек: **[FIRST-RUN.md](FIRST-RUN.md)**. Документация: [README.md](README.md).

---

## Что нужно

- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- Аккаунт на [hh.ru](https://hh.ru)
- *(Опционально)* ключ [OpenRouter](https://openrouter.ai) для LLM-оценки и писем

---

## Шаг 1. Установка

### Windows — приложение (3.0, без терминала)

1. [Releases](https://github.com/emildg8/HH_Ai/releases/latest) → **`HH-Ai_*-setup.exe`**
2. Установить → запустить **HH Ai**
3. «Установить Chromium» на экране подготовки

Дальше — шаг 2 (резюме + login).

### Windows (git)

```powershell
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

### macOS / Linux

```bash
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
bash scripts/install.sh
```

### Без git

1. Скачайте [hh-ai-public-v3.0.0.zip](https://github.com/emildg8/HH_Ai/releases/latest)
2. Распакуйте в `C:\Tools\hh-ai` (без кириллицы в пути)
3. `powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1`

---

## Шаг 2. Настройка (≈2 минуты обязательно)

`install` уже создал конфиги и режим **без LLM**. Осталось:

| Действие | Где |
|----------|-----|
| `HH_PROFILE_RESUME_TITLE` | `config/profiles/devops.env` — **как на hh.ru** |
| Проверка | `npm run setup:check` |

**Опционально (LLM и письма):**

```bash
npm run setup   # пресет OpenRouter / Ollama / без LLM
```

| Файл | Зачем |
|------|--------|
| `config/secrets.local.env` | Ключ OpenRouter (если выбрали LLM) |
| `CV/resume.pdf` или `.md` | Контекст для оценки и писем |

Подробно: **[FIRST-RUN.md](FIRST-RUN.md)** · **[CONFIG-GUIDE.md](CONFIG-GUIDE.md)**.

---

## Шаг 3. Вход на hh.ru

```bash
npm run login
```

Войдите в открывшемся Chromium → **Enter** в терминале.

Проверка: `npm run apply` (должен пройти без редиректа на логин).

---

## Шаг 4. Дашборд

```bash
npm run dashboard
```

Откройте **http://127.0.0.1:3849**

![Очередь вакансий](screenshots/dashboard-queue.png)

---

## Шаг 5. Рабочий цикл

| Действие | Команда / UI |
|----------|----------------|
| Сбор вакансий | `npm run harvest` или кнопка в дашборде |
| Оценка и письма | Карточки → утвердить письмо |
| Массовый отклик | Вкладка **«Без анкет»** → батч |
| Анкета работодателя | Вкладка **«Анкета»** → заполнить → отклик |

![Батч-отклик](screenshots/dashboard-batch.png)

---

## Проверка установки

```bash
npm run verify:local
```

---

## Дальше

| Документ | Зачем |
|----------|-------|
| **[CONFIG-GUIDE.md](CONFIG-GUIDE.md)** | **LLM, профиль, обучение стилю** |
| [USAGE.md](USAGE.md) | Полный сценарий |
| [BATCH.md](BATCH.md) | Массовый отклик, код выхода 5 |
| [CONFIG.md](CONFIG.md) | Все переменные окружения |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Капча, резюме, ошибки |

---

## Безопасность

Не публикуйте: `.env`, `data/session/`, `data/vacancies-*.json`, `CV/`, API-ключи.  
Подробнее: [SECURITY.md](../SECURITY.md).
