# Чекпоинт для продолжения работы

**Обновлено:** 2026-06-03 · **Версия:** 3.2.0 (UX v3 release)

**Release:** https://github.com/emildg8/HH_Ai/releases/latest

---

## Продукт 3.2

| Канал | Артефакт |
|-------|----------|
| Portable (все ОС) | `hh-ai-public-v3.2.0.zip` |
| Windows zip alias | `hh-ru-apply-win-x64-v3.2.0.zip` |
| Windows desktop | `HH-Ai_*-setup.exe` (NSIS, CI) |

### Быстрый старт Windows

1. **Приложение:** скачать `*-setup.exe` → установить → «Установить Chromium» → login
2. **Portable:** zip → `install-portable.ps1` → `start-dashboard.bat` → «Загрузить демо» на empty state
3. **Git:** `install.ps1` → `npm run login` → `npm run dashboard`

```powershell
npm run verify:local
npm run verify:release    # перед git tag v3.2.0
npm run qa:clean-install
powershell -File start-hh-ai.ps1
```

---

## Следующий train (3.3+)

См. [IMPROVEMENT-PLAN-2026-06.md](IMPROVEMENT-PLAN-2026-06.md), [ROADMAP.md](ROADMAP.md) — R-01 portable в Releases, DS-18 friction, mobile polish.
