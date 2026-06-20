# Анатомия продукта HH Ai

Одностраничная карта слоёв (§22 STD-0).

```
dashboard/public/     UI — отображение, fetch, модалки
scripts/dashboard-server.mjs   HTTP-фасад localhost
lib/*.mjs             доменная логика (gate, store, copilot, …)
scripts/hh-*.mjs      Playwright и CLI entry points
data/                 runtime state (в git только *.example, fixtures)
config/               preferences, presets, *.example
docs/                 документация и demo/
```

## Поток данных (упрощённо)

1. **Harvest** → очередь `data/vacancies-*.json`
2. **Gate / score** → оценка, фильтры
3. **Batch apply** → Playwright + письма
4. **Sync** → чаты, negotiations cache
5. **Dashboard** → UI + Settings API

## Ключевые модули lib/

| Модуль | Роль |
|--------|------|
| `store.mjs` | очередь вакансий |
| `dashboard-preferences.mjs` | preferences + registry |
| `settings-registry.mjs` | схема ключей Settings |
| `demo-queue.mjs` | демо для первого запуска |
| `chat-inbox.mjs` | inbox переписок |
| `interview-copilot-*.mjs` | суфлёр собеседований |

## Запрещено

- Бизнес-правила gate в `dashboard/public/app.js`
- Секреты в git (`config/secrets.local.env`, `data/session/`)
- Пользовательские настройки вне Settings (кроме employer overrides)

## См. также

- [SETTINGS-MODULE.md](SETTINGS-MODULE.md)
- [SOURCE-EXPERTISE.md](SOURCE-EXPERTISE.md)
- [PRODUCT-STANDARDS.md](PRODUCT-STANDARDS.md)
