# План доработок мульти-источникового ingest (2026-06)

## Экспертная оценка (до доработок)

| Область | Сделано | Пробел / риск |
|---------|---------|----------------|
| Архитектура | `vacancy-ingest.mjs`, `externalKey` | Два pipeline: hh harvest vs ingest |
| HR | tier A–D, playbook, letter gate | Нет top-20 виджета «куда откликаться сегодня» |
| Разработка | ATS/Habr/TG/jobboards | Telegram без обогащения hh-карточки |
| Тестирование | `test:ingest` | Нет E2E дашборда для новых API |
| UX/UI | бейдж source/tier | Не было фильтров, кнопок harvest, digest |
| Аналитика | `bySource` в digest | Не отображалось в UI |

## Выполнено в этой итерации

### P0 — функциональность
- [x] Fallback описания для URL-only ingest (Telegram, jobboards)
- [x] `sourceQualityTier` на записях hh harvest
- [x] `scripts/backfill-source-meta.mjs` + API
- [x] Habr harvest читает ключи из `search-keywords.txt`

### P1 — API дашборда
- [x] `POST /api/run-external-harvest`
- [x] `POST /api/ingest-url`
- [x] `GET /api/top-tier`
- [x] `POST /api/backfill-source-meta`
- [x] `daily-routine-run` + `withHabrHarvest`
- [x] Фильтры `source` / `tier` в `/api/vacancies`

### P2 — UI
- [x] Кнопки «Внешние источники», «Ссылка в очередь»
- [x] Чекбокс Habr/TG/ATS в рутине
- [x] Фильтры источник / tier в сайдбаре
- [x] Сортировка «Tier A/B + свежие»
- [x] Блок `intelligence-sources` в KPI
- [x] Chip «ручной отклик» / «ATS форма»

### P3 — тесты
- [x] `test-ingest-description-fallback.mjs`

## Бэклог (волна 3)

1. Унифицировать hh harvest через `vacancy-ingest` (один pipeline)
2. Playwright-обогащение hh-ссылок из Telegram
3. Виджет top-20 tier-A в сайдбаре (данные `/api/top-tier`)
4. Реальные компании в `ats-companies.json` (банки/финтех)
5. Habr sync «О себе» (`profile-optimize.mjs` + ручной шаг)
6. E2E: `test-dashboard-ingest-api.mjs`

## Команды

```powershell
npm run devops:backfill-source-meta    # legacy → source/tier
npm run devops:harvest-all
npm run devops:daily-routine -- --with-harvest --with-habr-harvest
npm run test:ingest
npm run quality:check
```
