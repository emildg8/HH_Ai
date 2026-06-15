# Дашборд UX v4 — план и wireframes

Краткая фиксация реализованного UX/UI v4 для multi-source HH Ai.

## Workflow (4 шага)

1. **Найти** — панель `sources`: поиск hh, внешние (Habr/TG/ATS), ingest URL, top-20 tier A/B.
2. **Разобрать** — фильтры source/tier в тулбаре и сайдбаре, пресеты «A свежие» / «Ручные», breadcrumbs.
3. **Откликнуться** — «Авто-отклики» (hh) + chip «ручной» / «ATS форма» на карточках.
4. **Следить** — воронка, intelligence bySource/byTier, отклики, чаты.

## Блоки UI

| Блок | id / panel | Назначение |
|------|-------------|------------|
| Источники | `data-panel="sources"` | Harvest hh, external dropdown, ingest, top tier |
| Главные действия | `actionsPrimary` | Утренний цикл, авто-отклики, разобрать tier A |
| Intelligence mini | `#intelligence-sources` | Chips bySource + tier bars → модалка digest |
| Ingest | `#ingest-url-modal` | URL + bulk, preview parse, результат |
| Фильтры | toolbar + `#sidebar-queue-filters` | source, tier, пресеты |

## Simple vs Expert

- **Simple:** панель sources (без external dropdown), top tier, основные действия.
- **Expert:** полный external harvest, intelligence modal, все фильтры.

## Тесты

```powershell
npm run check:dashboard
npm run test:dashboard-ingest-api   # дашборд на :3849
npm run test:dashboard
```

## Smoke-чеклист

- [ ] Очередь с tier-бейджами на карточках
- [ ] Фильтр Tier A сужает список, breadcrumbs обновляются
- [ ] Ingest modal → запись с source
- [ ] External harvest → toast
- [ ] Intelligence panel → модалка bySource
- [ ] Mobile toolbar не ломается
