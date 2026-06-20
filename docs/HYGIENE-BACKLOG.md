# Backlog гигиены проекта

Живой список техдолга (§23). Обновляется после `npm run hygiene:audit`.

## P0 — до первой передачи zip

| # | Задача | Статус |
|---|--------|--------|
| H1 | Восстановить `docs/PUBLIC-RELEASE.md`, `QUICKSTART.md`, `FIRST-RUN.md` | ✅ 2026-06-19 |
| H2 | Создать `docs/demo/vacancies-demo.json` (≥5) | ✅ 2026-06-19 |
| H3 | `data/vacancies-queue.example.json` | ✅ 2026-06-19 |
| H4 | `.gitignore` — runtime intelligence/plan snapshots | ✅ 2026-06-19 |
| H5 | `test:handoff` / `test:hygiene` в package.json | ✅ 2026-06-19 |

## P1 — до v5-rc

| # | Задача |
|---|--------|
| H6 | Миграция `modals.mjs` → `modal-layout.mjs` |
| H7 | `dashboard-server.mjs` → фасады `lib/dashboard-routes/` |
| H8 | CSS v4/v5/v6 → план слияния с UI v7 |
| H9 | `api-registry.mjs` + error envelope |
| H10 | ARCHIVE: `HANDOFF-2026-06-18.md`, `DASHBOARD-UX-PLAN.md` |

## P2 — после v5.0

| # | Задача |
|---|--------|
| H11 | Удалить оставшиеся `@deprecated` exports |
| H12 | README — убрать ссылки на несуществующие docs (BATCH.md, …) |
| H13 | `test-dead-exports.mjs` nightly |

## Команды

```bash
npm run hygiene:audit      # отчёт data/hygiene-report.json
npm run test:hygiene       # CI gate
```

См. [PRODUCT-STANDARDS.md](PRODUCT-STANDARDS.md).
