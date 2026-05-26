# Как запускать без Docker (и альтернативы)

**Версия:** 2.0.1

Цель: любой соискатель может начать за **15–30 минут** без контейнеров.

## Публичный релиз 2.0 (рекомендуется для передачи)

| Артефакт | Команда | Содержимое |
|----------|---------|------------|
| Каталог | `npm run export:public` | `dist/hh-ai-public/` |
| Zip | `npm run release:public` | `releases/hh-ai-public-v2.0.1.zip` |

Инструкция получателю: [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md). В архиве **нет** сессий, ключей, очередей, CV.

Перед публикацией на GitHub: распакуйте zip локально, проверьте отсутствие `sk-or-v1`, hash резюме, `data/session`.

## Рекомендуемый путь сегодня: Node + Playwright (как сейчас)

| Шаг | Действие |
|-----|----------|
| 1 | Установить [Node.js LTS](https://nodejs.org/) |
| 2 | `git clone https://github.com/emildg8/HH_Ai.git` → `npm install` → `npx playwright install chromium` |
| 3 | `npm run login` (один раз, вручную на hh.ru) |
| 4 | `npm run dashboard` |

**Плюсы:** полный контроль, сессия в `data/session`, без серверов.  
**Минусы:** нужен ПК, Chromium, ручной логин при сбросе сессии.

---

## Варианты на будущее (roadmap)

### A. Установщик / «программа» (desktop)

- **Tauri** или **Electron**-оболочка вокруг текущего дашборда + кнопка «Установить Chromium».
- Встроенный мастер: `.env`, профиль, `login`, ссылка на дашборд.
- **Плюсы:** один .exe/.dmg, не нужен терминал.  
- **Минусы:** разработка и подпись сборок, обновления.

### B. Portable ZIP (**в работе, R1.2–R1.4**)

- `npm run release:public` → `releases/hh-ai-public-v2.0.1.zip` (для передачи другим)
- `npm run release:pack` → полный локальный снимок **с вашими data** (не публиковать)
- `scripts/install-portable.ps1` + `start-dashboard.bat` на рабочий стол
- Цель: **скачивание с [GitHub Releases HH_Ai](https://github.com/emildg8/HH_Ai/releases)** (`hh-ai-public-v*.zip`) без git
- **Плюсы:** без Docker, без git.  
- **Минусы:** антивирусы, ручное обновление; Node.js всё ещё нужен (или bundled в zip позже)

### C. Облачный сервис (SaaS)

- Сервер с очередью и LLM; браузер hh.ru — **удалённый** (Playwright на VPS или extension).
- **Плюсы:** доступ с телефона/планшета.  
- **Минусы:** хранение cookies на сервере (риски), стоимость, правила hh.ru, сложность.

### D. GitHub Codespaces / dev container

- Репозиторий + `devcontainer.json`: браузер с GUI через noVNC.
- **Плюсы:** не ставить Node локально.  
- **Минусы:** платно, капча/логин hh.ru неудобны в облаке.

### E. Расширение браузера (полуавтомат)

- Только вставка письма / подсказки на странице hh.ru без Playwright-сервера.
- **Плюсы:** проще распространять.  
- **Минусы:** меньше автоматизации (harvest, scoring — отдельно).

---

## Рекомендация по приоритету

1. **Сейчас (2.0):** Node-путь + `release:public` + `profile:init` + [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md).
2. **v2.1:** `install.ps1` / portable zip из CI на GitHub Releases.
3. **v1.2+:** Tauri-дашборд, если нужен «как программа».
4. **SaaS** — только после явной модели доверия и изоляции сессий.

Docker остаётся **опциональным** для тех, кто уже использует контейнеры — не как требование для всех.
