# Стандарты продукта HH Ai

Канонический документ (§22 плана воронки). Новые фичи должны соответствовать этим правилам.

## Принципы

| # | Принцип | Проверка |
|---|---------|----------|
| P1 | **Registry-first** — новый ключ settings / endpoint / event → реестр | `test:standards` |
| P2 | **Settings only** — конфигурация пользователя только в модалке Настройки | `test:settings-registry` |
| P3 | **Русский наружу** — UI и ошибки пользователя на русском | `test-copy-ru-lint` |
| P4 | **Единый error envelope** API: `{ ok, error?, code?, hint? }` | `test-api-envelope` (план) |
| P5 | **Design tokens** — `--hh-*`, `--ds-*`, не произвольный hex | `check:design-tokens` |
| P6 | **lib/ = domain** — бизнес-логика в `lib/`, HTTP в server | `test-module-boundaries` (план) |
| P7 | **Runtime data ∉ git** — `data/*` кроме example и fixtures | `test:hygiene` |
| P8 | **No secrets in repo** | `test-export-no-pii`, `secrets:check` |

## Реестры

| Реестр | Файл | Статус |
|--------|------|--------|
| Settings | `lib/settings-registry.mjs` | ✅ |
| API routes | `lib/api-registry.mjs` | план STD-1 |
| Data schemas | `lib/data-schema-registry.mjs` | план STD-1 |
| Observability | `lib/observability-registry.mjs` | план §9 |
| Modules | `lib/module-registry.mjs` | план STD-4 |

## Документация

- Инвентарь: [docs-manifest.json](docs-manifest.json)
- Анатомия: [PRODUCT-ANATOMY.md](PRODUCT-ANATOMY.md)
- Гигиена: [HYGIENE-BACKLOG.md](HYGIENE-BACKLOG.md)

## Handoff и релиз

- Публичный zip: [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md)
- Перед передачей: `npm run test:handoff` + `npm run smoke:release`

## Версионирование

- `VERSION` = `package.json` version — `npm run verify:release`
- CHANGELOG — Keep a Changelog, секция Unreleased для PR
