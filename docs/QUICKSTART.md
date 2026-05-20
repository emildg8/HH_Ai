# Быстрый старт HH Ai

**5 шагов** — от нуля до дашборда. Полная документация: [README.md](README.md).

---

## Что нужно

- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- Аккаунт на [hh.ru](https://hh.ru)
- *(Опционально)* ключ [OpenRouter](https://openrouter.ai) для LLM-оценки и писем

---

## Шаг 1. Установка

### Windows (рекомендуется)

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

1. Скачайте [hh-ai-public-v2.0.0.zip](https://github.com/emildg8/HH_Ai/releases/latest)
2. Распакуйте в `C:\Tools\hh-ai` (без кириллицы в пути)
3. Запустите `install.ps1` или `install.sh` из папки проекта

---

## Шаг 2. Конфиг (2 минуты)

| Файл | Действие |
|------|----------|
| `config/secrets.local.env` | Вставьте `OPENROUTER_API_KEY=...` *(или свой LLM — см. `.env.example`)* |
| `config/profiles/devops.env` | Укажите `HH_PROFILE_RESUME_TITLE=...` (название резюме на hh.ru) |
| `config/cover-letter.txt` | Скопируйте из `cover-letter.example.txt` и отредактируйте |

Без LLM-ключа harvest всё равно работает — локальная оценка по ключевым словам.

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
| [USAGE.md](USAGE.md) | Полный сценарий |
| [BATCH.md](BATCH.md) | Массовый отклик, код выхода 5 |
| [CONFIG.md](CONFIG.md) | Все переменные окружения |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Капча, резюме, ошибки |

---

## Безопасность

Не публикуйте: `.env`, `data/session/`, `data/vacancies-*.json`, `CV/`, API-ключи.  
Подробнее: [SECURITY.md](../SECURITY.md).
