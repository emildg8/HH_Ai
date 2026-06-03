# План развития: QA дашборда и модалка «Настройки»

**Период:** 2026-06-02 · **Статус:** выполнен (снимок после диалога)

Цель: закрыть регресс «Настройки не открываются», зафиксировать автоматические проверки и обновить документацию/CI, чтобы сбой не повторился.

---

## Фаза A — Исправление (P0)

| # | Задача | Статус |
|---|--------|--------|
| A1 | Найти причину: `settings-modal.mjs` не парсится | [x] |
| A2 | Закрыть JSDoc перед `initSettingsModal` (`*/`) | [x] |
| A3 | `@typedef SettingsModalDeps`, guard в `openDashboardSettings` | [x] |
| A4 | Cache-bust `app.js` в `index.html` | [x] |

**Корень:** незакрытый `/** … */` — код до `/* ignore */` считался комментарием, модуль не грузился.

---

## Фаза B — Статические проверки (P1)

| # | Задача | Статус |
|---|--------|--------|
| B1 | `lib/dashboard-static-check.mjs` — JSDoc, DOM-контракт, app.js | [x] |
| B2 | `npm run check:dashboard` | [x] |
| B3 | `scripts/test-dashboard-static-check.mjs` (unit + регрессия JSDoc) | [x] |
| B4 | `verify:local` и CI вызывают `check:dashboard` | [x] |
| B5 | `test:unit` включает static-check | [x] |

---

## Фаза C — E2E и интеграция (P1)

| # | Задача | Статус |
|---|--------|--------|
| C1 | Расширить `test:dashboard-settings` (вкладки, Esc, event, тост) | [x] |
| C2 | Хелперы в `dashboard-test-helpers.mjs` | [x] |
| C3 | CI: `test:dashboard-settings` после UI smoke | [x] |
| C4 | `test:dashboard` начинается с `check:dashboard` | [x] |

---

## Фаза D — Документация (P2)

| # | Задача | Статус |
|---|--------|--------|
| D1 | CHANGELOG [Unreleased] | [x] |
| D2 | TROUBLESHOOTING, CONTRIBUTING, README | [x] |
| D3 | SETTINGS-MODAL-PLAN, HANDOFF, DASHBOARD, ROADMAP Q12 | [x] |
| D4 | PR template: `check:dashboard` | [x] |
| D5 | `npm run quality:dashboard` | [x] |

---

## Фаза E — Backlog (после плана)

| # | Задача | Приоритет |
|---|--------|-----------|
| E1 | Индикатор dirty на всех вкладках | [x] |
| E2 | Общий `modal-layout.mjs` для модалок | средний → [DEVELOPMENT-IDEAS.md](DEVELOPMENT-IDEAS.md) M-01 |
| E3 | Portable ZIP в Releases (R1.2) | roadmap → R-01 |
| E4 | Константа версии кэша app.js + v4 CSS | [x] `dashboard-asset-version.mjs` |

---

## Фаза F — Каталог идей (2026-06)

Полный бэклог с приоритетами и оценкой усилий: **[DEVELOPMENT-IDEAS.md](DEVELOPMENT-IDEAS.md)** (30+ пунктов: дашборд, настройки, модалки, письма, релиз, метрики).

Ближайшие кандидаты:

| ID | Идея | P |
|----|------|---|
| M-01 | `modal-layout.mjs` | P1 |
| L-05 | Batch report → настройки FP | P1 |
| D-05 | DOM-контракт precheck / letter-hub | P1 |
| S-07 | Live-превью таргетинга | P2 |

---

## Команды (ежедневно)

```bash
npm run check:dashboard           # перед коммитом UI
npm run quality:dashboard         # check + unit static
npm run test:dashboard-settings   # Playwright (дашборд :3849)
npm run test:dashboard            # полный набор дашборда
```

---

## Критерии «готово» (10/10)

См. [DASHBOARD-QA-SCORECARD.md](DASHBOARD-QA-SCORECARD.md).

- [x] `check:dashboard` без ошибок
- [x] `test:dashboard-static-check` OK
- [x] `test:dashboard-settings` OK при запущенном дашборде
- [x] `modal-layout.mjs`, pre-commit, batch report → settings
- [x] Документация и CI синхронизированы
