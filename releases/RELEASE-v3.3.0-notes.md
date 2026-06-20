# HH Ai 3.3.0 — release notes

**Дата:** 2026-06-17 · **Тег:** `v3.3.0`

## Что нового

- **Живой суфлёр** — Q→A на созвоне (loopback + опционально mic), двухуровневые ответы, offer-guard, память живых ответов.
- **HH Ai Desktop** — overlay поверх Zoom/Телемост, dock «над встречей», Ctrl+Shift+H (паника), `contentProtected`.
- **Два окна** — live AI (`teleprompter.html`) и сценарий (`teleprompter-prep.html`).
- **Пост-собес** — debrief (1–5), merge в заметки, follow-up в черновик чата, offer-tracker.
- **Прогон на записи** — simulate без второго человека (`npm run devops:copilot-simulate` или кнопка в хабе).

## Проверки перед собесом

```powershell
npm run test:copilot
npm run desktop:check
npm run devops:copilot-simulate -- --dry-run
```

## Первый live-созвон

1. Дашборд → **Собесы** → слот E → **План собеса** (prep-pack).
2. **Что подтянется в ответы** — контекст не пустой.
3. HH Ai Desktop → **Поверх + живой**.
4. Zoom: при RTX — NVIDIA Broadcast Eye Contact.
5. После созвона — debrief и follow-up ≤ 24 ч.

## Env (опционально)

См. `.env.example`: `COPILOT_STT`, `COPILOT_MIC`, `COPILOT_WASAPI_DEVICE`, `HH_CANDIDATE_CONTEXT_DIRS`.

Документация: `docs/HIRING-OPERATIONS.md` (раздел «Суфлёр и Live Copilot»).
