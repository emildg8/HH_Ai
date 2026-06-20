# HH Ai — правила для агента

Гибрид app+bot в `apps/hh-ai`. Глобальные линзы — в `D:\Dev\.cursor\rules\15-expertise-lenses.mdc`.

## Быстрые якоря

- **Ingest / harvest / очередь:** skill `hh-ru-apply-workflow`, `lib/vacancy-ingest.mjs`, `docs/SOURCE-EXPERTISE.md`.
- **Дашборд:** `design-tokens.css`, `dashboard-unify.css`, `docs/DASHBOARD-DESIGN-TOKENS.md`.
- **Профиль кандидата:** DevOps junior+/middle, удалёнка, очередь multi-source.
- **Handoff / релиз:** `docs/PUBLIC-RELEASE.md`, `npm run test:handoff`, `npm run release:public`.
- **Стандарты / гигиена:** `docs/PRODUCT-STANDARDS.md`, `npm run test:hygiene`, `npm run hygiene:audit`.
- **OPS / baseline:** `docs/OPS-RHYTHM.md`, `npm run test:ops-readiness`, `npm run devops:ops-readiness`, `npm run devops:intelligence-baseline`.

## Доменные линзы (дополнительно к универсальным)

| Домен | Фокус |
|-------|-------|
| HR / рекрутинг | Воронка кандидата, тон писем, tier A/B, лимиты, не спамить |
| Рынок труда (RU IT) | Зарплаты, удалёнка, hh/Habr/ATS, свежесть вакансий |
| Дизайн-система | `--hh-*` / `--ds-*`, `--font-ui`, модалки вне shell |

## UI
- Копирайт через `dashboard-ux.mjs` / `dashboard-copy-ru.mjs`, не хардкод в HTML.
- Токены из `design-tokens.css`, не разовые hex/шрифты.

## Проверки
- `npm run check:*`, `test:*` в `scripts/` после нетривиальных правок UI/API.
