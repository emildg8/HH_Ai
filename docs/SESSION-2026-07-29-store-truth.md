# SESSION 2026-07-29 — store-truth (формат + статус)

## Проблема

Очередь выдавала ложь за правду: chip «на месте работодателя» → «только офис» (как у Альфы до fix), `status=pending` при отказе на hh после sync.

## Фикс

1. `lib/work-format-truth.mjs` — thin chip, JD-гибрид, `formatNeedsPageVerify`, `statusPatchFromNegotiation`
2. Parse: thin chip + явный гибрид в JD → гибрид, не officeOnly
3. Apply: thin chip без `formatVerifiedAt` → стоп с честной причиной (backfill), не «офис Москва»
4. Sync переговоров: отказ → `status=declined`
5. Harvest/backfill → `formatVerifiedAt` + `formatSource=vacancy_page`
6. CLI: `npm run devops:repair-store-truth:emil` (без PW) · `devops:backfill-work-format:emil` (PW)

## Проверка

```bash
npm run test:store-truth
npm run test:vacancy-work-format
npm run devops:repair-store-truth:emil -- --dry-run
```

## Откат

Убрать gate `formatNeedsPageVerify` в `assessWorkFormatForApply`; вернуть status-patch в `hh-negotiations-sync` к «только pending→applied».
