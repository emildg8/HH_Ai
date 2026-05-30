# HH Ai Desktop v3.0.0 — release notes

**Дата:** 2026-05-30 · **Тег:** `v3.0.0`

## Что нового

- **Windows installer** (`HH-Ai_*-setup.exe`) — дашборд как приложение, без терминала.
- **Portable zip** — по-прежнему для Node.js-пути и macOS/Linux.
- **Автотест установки** A (git clone) + B (portable) — `npm run qa:clean-install`.
- **Chromium в один клик** в desktop-приложении.

## Скачать

| Файл | Назначение |
|------|------------|
| `HH-Ai_*-setup.exe` | Windows desktop |
| `hh-ai-public-v3.0.0.zip` | Portable / devops |
| `hh-ru-apply-win-x64-v3.0.0.zip` | Alias portable |

## Первый запуск (desktop)

1. Установить `.exe`
2. Запустить HH Ai
3. «Установить Chromium»
4. `config/profiles/devops.env` → `HH_PROFILE_RESUME_TITLE` (если ещё не задан)
5. Login на hh.ru через Chromium (один раз)

## Первый запуск (zip)

См. `EXPORT-README.md` в архиве или [docs/PUBLIC-RELEASE.md](../docs/PUBLIC-RELEASE.md).

## Upgrade с 2.2.0

- Данные `data/` и `config/profiles/*.env` совместимы — скопируйте в новую папку или оставьте на месте при git pull.
- Desktop installer использует отдельный каталог установки; сессию hh.ru нужно перенести или выполнить `login` заново.

## Known limits

- macOS/Linux desktop installer — backlog (используйте zip).
- Автообновление installer — не в 3.0.0.
