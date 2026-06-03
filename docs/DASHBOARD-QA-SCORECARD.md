# Scorecard QA дашборда (10/10)

**Снимок:** 2026-06-03 · Цель: модалка «Настройки» и UI не ломаются незаметно.

| # | Критерий | Проверка | Статус |
|---|----------|----------|--------|
| 1 | Синтаксис всех `dashboard/public/*.mjs` | `npm run check:dashboard` | [x] |
| 2 | JSDoc не обрывается перед `export` | unit + static | [x] |
| 3 | DOM-контракт настроек (14 id) | `SETTINGS_DOM_CONTRACT` | [x] |
| 4 | Версии кэша `app.js` + `dashboard-v4.css` | `dashboard-asset-version.mjs` | [x] |
| 5 | `app.js` импортирует `settings-modal` + `modal-layout` | static | [x] |
| 6 | Все модалки в `MODAL_ROOT_IDS` + Escape | `modal-layout.mjs` | [x] |
| 7 | E2E настроек (вкладки, dirty, deep link) | `test:dashboard-settings` | [x] |
| 8 | Отчёт батча → настройки (FP / письма / лимиты) | UI + static `data-batch-report-settings` | [x] |
| 9 | CI: check + UI smoke + settings E2E | `.github/workflows/ci.yml` | [x] |
| 10 | Pre-commit при diff `dashboard/public/` | `scripts/pre-commit-dashboard.mjs` | [x] |

**Команда «всё сразу»:**

```bash
npm run quality:dashboard
npm run test:dashboard-settings   # дашборд :3849
npm run hooks:install             # pre-commit (опционально)
```

**10/10** = все строки [x] и оба прогона без FAIL.
