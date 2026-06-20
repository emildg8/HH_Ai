# Инфраструктура Knowledge Store

Фаза A плана «Отклики → Интервью»: локальная SQLite-база для employer intelligence, снимков откликов и паттернов.

## Быстрый старт

```powershell
cd D:\Dev\apps\hh-ai
npm install
npm run devops:knowledge-init
npm run test:knowledge-store
npm run check:knowledge-infra
```

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `HH_DATA_DIR` | `./data` | Корень данных (Tauri/desktop — абсолютный путь) |
| `HH_KNOWLEDGE_DB` | `{HH_DATA_DIR}/hh-ai-knowledge.db` | Путь к SQLite |

## Настройки

`applyIntelligence.knowledgeStoreEnabled` (expert, default **false**) — при `true` дашборд запускает миграции при старте. Dual-write в batch — **фаза B**.

## Модули

| Файл | Роль |
|------|------|
| `lib/data-root.mjs` | `getDataRoot()`, пути artifacts/logs |
| `lib/knowledge-store.mjs` | singleton DB, транзакции, PRAGMA WAL |
| `lib/knowledge-migrate.mjs` | `migrations/knowledge/*.sql` |
| `lib/knowledge-bootstrap.mjs` | старт из preferences |

## Windows: сборка better-sqlite3

Нужны prebuild-бинарники или MSVC Build Tools. При ошибке `npm install`:

```powershell
npm install --build-from-source better-sqlite3
```

Тесты используют `:memory:` — сборка всё равно нужна для импорта модуля.

## Git

В `.gitignore`: `data/hh-ai-knowledge*.db`, `data/knowledge/artifacts/`, PII в jsonl-логах.
