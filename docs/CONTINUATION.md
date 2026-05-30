# Чекпоинт для продолжения работы

**Обновлено:** 2026-05-30 · **Версия:** 2.2.0 · **Desktop:** 3.0.0-alpha

**Релиз:** [v2.2.0](https://github.com/emildg8/HH_Ai/releases/tag/v2.2.0) · ветка `HH_Ai`

---

## Сделано недавно

| Область | Статус |
|---------|--------|
| QA clean install A+B | `npm run qa:clean-install` — автотест git clone + portable |
| Tauri фаза 0–3 | sidecar дашборда, кнопка Chromium, `desktop:smoke` |
| CI | qa:clean-install + desktop:smoke в workflow |

```powershell
npm run verify:local
npm run qa:clean-install
npm run desktop:check
npm run desktop:smoke
npm run dashboard   # Ctrl+F5
```

---

## Следующее

- [ ] Tauri **фаза 4**: `tauri build` + installer в CI (нужен Rust/windows runner)
- [ ] Прогон [QA-CLEAN-INSTALL.md](QA-CLEAN-INSTALL.md) на VM (login/apply вручную)
- [ ] Friction → [UX-FRICTION-LOG.md](UX-FRICTION-LOG.md)

См. [TAURI-PLAN.md](TAURI-PLAN.md) · [ROADMAP.md](ROADMAP.md)
