# Чекпоинт для продолжения работы

**Обновлено:** 2026-05-30 · **Версия:** 3.0.0

**Релиз:** тег `v3.0.0` — zip + NSIS installer · ветка `HH_Ai`

---

## Продукт 3.0.0

| Канал | Артефакт |
|-------|----------|
| Windows desktop | `HH-Ai_*-setup.exe` |
| Portable | `hh-ai-public-v3.0.0.zip` |
| Git | `install.ps1` / `install.sh` |

```powershell
npm run verify:local
npm run qa:clean-install
npm run desktop:smoke
npm run release:public
```

---

## Backlog post-3.0

- [ ] macOS/Linux desktop installer
- [ ] Автообновление Tauri
- [ ] VM QA login/apply вручную → UX-FRICTION-LOG

См. [TAURI-PLAN.md](TAURI-PLAN.md) · [ROADMAP.md](ROADMAP.md)
