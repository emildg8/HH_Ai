# Чистая установка (QA)

Чеклист для проверки, что **новый пользователь** ставит HH Ai за **≤30 минут** без ваших локальных данных.  
Используйте **чистую VM** (Win10/11) или отдельную учётную запись Windows.

**Связь с roadmap:** R1.7 · **Демо-очередь:** `docs/demo/vacancies-demo.json` (не `data/vacancies-devops.json`).

---

## Подготовка VM

| # | Шаг | OK |
|---|-----|-----|
| 0.1 | Windows 10/11, интернет | ☐ |
| 0.2 | Node.js **18+** LTS ([nodejs.org](https://nodejs.org)) | ☐ |
| 0.3 | Git (или только zip с [Releases](https://github.com/emildg8/HH_Ai/releases)) | ☐ |
| 0.4 | Нет папки `data/session/` и личных `config/profiles/*.env` | ☐ |

---

## Вариант A — git clone

| # | Команда / действие | Ожидание | OK |
|---|-------------------|----------|-----|
| A1 | `git clone https://github.com/emildg8/HH_Ai.git` && `cd HH_Ai` | Репозиторий на диске | ☐ |
| A2 | `powershell -ExecutionPolicy Bypass -File scripts/install.ps1` | `npm install`, Chromium, копии `.env` / examples | ☐ |
| A3 | `npm run setup:check` | Нет критичных `→` (допустимы ⚠ про LLM/CV) | ☐ |
| A4 | `npm run setup` (опционально) | Профиль + пресет LLM без ручного копирования | ☐ |
| A5 | Заполнить `config/secrets.local.env` (ключ или `no-llm`) | По [CONFIG-GUIDE.md](CONFIG-GUIDE.md) | ☐ |
| A6 | `config/profiles/devops.env` — `HH_PROFILE_RESUME_TITLE` | Совпадает с заголовком резюме на hh.ru | ☐ |
| A7 | `npm run login` | Браузер, вход на hh.ru, окно можно закрыть | ☐ |
| A8 | `npm run apply` | Сессия жива (без редиректа на логин) | ☐ |
| A9 | `npm run dashboard` | http://127.0.0.1:3849 открывается | ☐ |
| A10 | Дашборд с `--queue-file=./docs/demo/vacancies-demo.json` | Карточки без PII (см. ниже) | ☐ |

**Демо-дашборд (без личной очереди):**

```powershell
node scripts/dashboard-server.mjs --queue-file=./docs/demo/vacancies-demo.json
```

---

## Вариант B — zip с Release (2.2.0+)

| # | Шаг | OK |
|---|-----|-----|
| B1 | Скачать `hh-ai-public-v2.2.0.zip` или `hh-ru-apply-win-x64-v2.2.0.zip` с [Releases](https://github.com/emildg8/HH_Ai/releases/tag/v2.2.0) | ☐ |
| B2 | Распаковать, открыть `EXPORT-README.md` | ☐ |
| B3 | `powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1` | ☐ |
| B4 | Повторить A5–A9 (login, apply, dashboard) | ☐ |
| B5 | Опционально: двойной клик `start-dashboard.bat` | ☐ |

---

## Smoke (мейнтейнер / CI)

На машине разработчика или в GitHub Actions:

```bash
npm run smoke:release
npm run verify:local
npm run qa:clean-install              # вариант B: export → portable install → UI smoke
npm run qa:clean-install -- --skip-playwright   # быстрее, если Chromium уже установлен
```

Отчёт: `data/qa-clean-install-report.json`

---

## Критерии успеха R1.7

- [ ] Установка ≤30 мин (записать фактическое время: _____ мин)
- [ ] `setup:check` без блокирующих пунктов после шага A5–A6
- [ ] `login` + `apply` без «browser closed» (если был — [Issue #…](https://github.com/emildg8/HH_Ai/issues))
- [ ] Дашборд показывает демо-очередь без ошибок в консоли F12
- [ ] **3 friction point** записаны в [UX-FRICTION-LOG.md](UX-FRICTION-LOG.md)

---

## Что не проверяем на чистой VM

- Реальный `devops:apply-batch` на лимитах hh.ru (только по желанию, отдельно)
- Личные ключи OpenRouter в отчётах
- Push в `Steev193/hh-ru-apply` (не канонический репозиторий)

---

## Отчёт

После прогона: обновите [UX-FRICTION-LOG.md](UX-FRICTION-LOG.md) и при необходимости откройте Issue (шаблон «Онбординг / friction»).
