# HH Ai 3.2.0 — release notes

**Дата:** 2026-06-03 · **Тег:** `v3.2.0`

## Что нового

- **Демо-очередь** на первом запуске — install и кнопка «Загрузить демо» в дашборде.
- **Inbox чатов** — badge в menubar, модалка, chip «нужен ответ» на карточках.
- **UX v3** — AI-подсказки к score, KPI «Без правки», live preview таргетинга, lean toolbar.
- **QA gates** — `npm run gate-b`, screenshot regression (DS-07), a11y spot (DS-08), `verify:release`.
- **Качество писем** — letter-center, precheck батча, golden set в CI.

## Скачать

| Файл | Назначение |
|------|------------|
| `HH-Ai_*-setup.exe` | Windows desktop (рекомендуется) |
| `hh-ai-public-v3.2.0.zip` | Portable / Node.js |
| `hh-ru-apply-win-x64-v3.2.0.zip` | Alias portable |

## Первый запуск (desktop)

1. Установить `.exe` → запустить **HH Ai**
2. «Установить Chromium» → login на hh.ru
3. `HH_PROFILE_RESUME_TITLE` в `config/profiles/devops.env` (если не задан install)

## Первый запуск (zip)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1
npm run login
start-dashboard.bat
```

На пустой очереди — **«Загрузить демо»** или `npm run setup:first-run -- --demo`.

Подробно: [docs/PUBLIC-RELEASE.md](../docs/PUBLIC-RELEASE.md) · [docs/QUICKSTART.md](../docs/QUICKSTART.md)

## Upgrade с 3.0.x

- `data/` и `config/profiles/*.env` совместимы — git pull или скопируйте в новую папку.
- После обновления дашборда: **Ctrl+F5** (cache-bust `app.js`).

## Maintainer checks

```bash
npm run verify:release
npm run quickstart:gate
npm run release:public
git tag v3.2.0
```

## Known limits

- Portable zip требует Node.js 18+ (desktop installer — Node bundled).
- macOS/Linux desktop installer — backlog; используйте zip.
- North Star ≤45 мин — формально для внешнего тестера (см. UX-FRICTION-LOG).
