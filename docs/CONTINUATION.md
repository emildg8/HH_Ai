# Чекпоинт для продолжения работы

**Обновлено:** 2026-05-30 · **Версия:** 3.0.5 (финальный релиз)

**Release:** https://github.com/emildg8/HH_Ai/releases/latest

---

## Продукт 3.0

| Канал | Артефакт |
|-------|----------|
| Portable (все ОС) | `hh-ai-public-v3.0.5.zip` |
| Windows zip alias | `hh-ru-apply-win-x64-v3.0.5.zip` |
| Windows desktop | `HH-Ai_*-setup.exe` (NSIS, CI) |

### Быстрый старт Windows

1. **Приложение:** скачать `*-setup.exe` → установить → «Установить Chromium» → login
2. **Portable:** zip → `install-portable.ps1` → `start-dashboard.bat`
3. **Git:** `install.ps1` → `npm run login` → `npm run dashboard`

```powershell
npm run verify:local
npm run qa:clean-install
powershell -File start-hh-ai.ps1
```

---

## Backlog post-3.0

- macOS/Linux desktop installer
- Автообновление Tauri
- Bundled node.exe в installer (локально `--bundle-node`, CI — опционально)
