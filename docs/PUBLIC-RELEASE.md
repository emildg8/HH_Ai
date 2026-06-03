# HH Ai 3.2.0 — для нового пользователя

**Скачать:** [Releases](https://github.com/emildg8/HH_Ai/releases/latest)

| Артефакт | Для кого |
|----------|----------|
| **HH-Ai_*-setup.exe** | Windows — приложение «как программа» (рекомендуется) |
| **hh-ai-public-v3.2.0.zip** | Любая ОС с Node.js — portable / git-free |
| **hh-ru-apply-win-x64-v3.2.0.zip** | То же, alias для Windows |

**Минимум ручного труда:** [FIRST-RUN.md](FIRST-RUN.md) · **5 шагов:** [QUICKSTART.md](QUICKSTART.md)

**Новое в 3.2.0:** на пустой установке можно сразу загрузить **демо-очередь** и посмотреть дашборд; **входящие чаты** в menubar; полировка UI и автоматические QA-gates в CI.

---

## Вариант 1 — Desktop installer (Windows)

1. Скачайте `HH-Ai_*-setup.exe` с Releases.
2. Установите (Current User, без admin).
3. Запустите **HH Ai** из меню Пуск.
4. На экране подготовки: **Установить Chromium** → один раз **login** на hh.ru (см. FIRST-RUN).

Приложение само поднимает дашборд на http://127.0.0.1:3849.

---

## Вариант 2 — Portable zip

### 1. Распакуйте

Путь **без кириллицы**, например `C:\Tools\hh-ai`.

### 2. Установщик

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1
```

Или **`start-dashboard.bat`** / **`start-hh-ai.ps1`** после install.

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

На пустой очереди — кнопка **«Загрузить демо»** или `npm run setup:first-run`.

---

## Что внутри zip

| Есть | Нет (создаёт install) |
|------|------------------------|
| Код, дашборд, примеры конфигов | Сессия hh.ru |
| `docs/`, `EXPORT-README.md`, `start-dashboard.bat` | Ваши вакансии и CV |
| `docs/demo/vacancies-demo.json` — демо-очередь | API-ключи, hash резюме |
| `config/*.example.*`, `scripts/install-portable.ps1` | Логи и скриншоты ошибок |

---

## Требования

- **Node.js 18+** (для zip; в desktop installer Node bundled)
- **Windows 10/11** для `.exe` installer
- Интернет для hh.ru и опционально LLM

---

## Безопасность

Не публикуйте `data/session/`, `config/secrets.local.env`, `CV/`. См. [SECURITY.md](SECURITY.md).

Канонический репозиторий: [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai).
