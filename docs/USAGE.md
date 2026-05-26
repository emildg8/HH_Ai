# Руководство пользователя HH Ai

**Версия:** 2.0.1 · [Оглавление документации](README.md)

Полный цикл: установка → сбор → оценка → письма → отклик (вручную, из дашборда или батчем).

---

## 1. Установка

```bash
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
git checkout HH_Ai
npm install
npx playwright install chromium
cp .env.example .env
cp config/secrets.example.env config/secrets.local.env
cp config/profiles/devops.env.example config/profiles/devops.env
```

Windows: `powershell -ExecutionPolicy Bypass -File scripts/install.ps1`

Подробно: [SETUP.md](SETUP.md) · без git: [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md).

---

## 2. Вход на hh.ru

```bash
npm run login
```

Войдите в Chromium, затем **Enter** в терминале. Сессия: `data/session/chromium-profile`.

Проверка: `npm run apply`.

---

## 3. Профиль и поиск

```bash
# свой профиль
npm run profile:init -- --id=devops --title=DevOps
# правка config/profiles/devops.env
set HH_PROFILE=devops   # Windows
```

- Ключевые слова: `config/search-keywords-devops.txt` (или свой файл в профиле).
- Фильтры: `config/preferences.json`.
- Переменные: [CONFIG.md](CONFIG.md).

---

## 4. Резюме и LLM

1. PDF/md в `CV/` — для оценки и писем.
2. `config/secrets.local.env` → `OpenRouter_API_KEY=...`
3. `config/cover-letter.txt` из `cover-letter.example.txt`
4. Резюме на hh.ru: `npm run devops:list-resumes` → hash в профиле.

[config/OPENROUTER.md](../config/OPENROUTER.md)

---

## 5. Сбор и оценка

```bash
npm run harvest
# DevOps-профиль:
npm run devops:harvest
```

Результат: `data/vacancies-<profile>.json` с полями `scoreOverall`, `geminiTags`, …

Harvest может пометить **вероятную анкету** по тексту вакансии (`HH_HARVEST_QUESTIONNAIRE_HINT`).

---

## 6. Дашборд

```bash
npm run dashboard
```

→ http://127.0.0.1:3849

- Просмотр очереди, генерация и **утверждение** писем.
- Разделы **«Без анкет»** / **«Анкета»**.
- Запуск батча и одиночного отклика.

Подробно: [DASHBOARD.md](DASHBOARD.md).

---

## 7. Отклик

### Одна вакансия

```bash
npm run hh-apply-chat -- --id=<uuid>
```

Или кнопка **«Отклик в браузере»** в дашборде (нужно утверждённое письмо).

Только вставить письмо в форму без отправки:

```bash
npm run hh-fill-letter -- --id=<uuid>
```

### Массовый батч

```bash
npm run devops:apply-batch
```

Рекомендуется область **«Без анкет»** в дашборде. Подробно: [BATCH.md](BATCH.md).

---

## 8. Типовой рабочий день

1. `npm run devops:harvest` — свежие вакансии.
2. `npm run dashboard` — утвердить письма для топ-скора.
3. Батч **«Без анкет»** или точечные отклики.
4. Раздел **«Анкета»** — дозаполнить и откликнуться вручную.
5. Лог: `data/hh-apply-chat.log`.

---

## 9. Docker (опционально)

```bash
docker compose up -d
docker compose run --rm dashboard npm run login
docker compose run --rm dashboard npm run harvest
```

Данные на хосте в `data/`. Основной путь — без Docker: [DISTRIBUTION.md](DISTRIBUTION.md).

---

## 10. Прочие команды

| Команда | Назначение |
|---------|------------|
| `npm run devops:rescore` | Переоценка очереди |
| `npm run devops:reject-similar` | Отклонить похожие |
| `npm run devops:probe-questionnaire` | Сбор вопросов анкеты |
| `npm run codegen-hh` | Обновление селекторов |
| `npm run backup` | Локальный бэкап |
| `npm run verify:local` | Самопроверка |

---

## Проблемы

[TROUBLESHOOTING.md](TROUBLESHOOTING.md)
