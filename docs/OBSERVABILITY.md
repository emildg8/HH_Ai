# Наблюдаемость (OBS)

Локальная наблюдаемость воронки: **JSONL** + digest + (позже) SQLite rollups. Без внешнего Grafana на MVP.

## Схема события v1

Каждая строка JSONL:

```json
{
  "v": 1,
  "ts": "2026-06-19T14:30:22.123Z",
  "type": "apply.finished",
  "correlationId": "attempt-a1b2c3d4",
  "batchRunId": "batch-20260619143022",
  "attemptId": "attempt-a1b2c3d4",
  "recordId": "abc123",
  "phase": "apply.finished",
  "payload": { "outcome": "ok" }
}
```

Обязательные поля: `v`, `ts`, `type`, `correlationId`, `payload`.

## Correlation IDs

| ID | Область |
|----|---------|
| `batchRunId` | одна серия откликов |
| `attemptId` | один отклик на вакансию |
| `jobRunId` | harvest / rebuild / daily |
| `correlationId` | произвольная цепочка (часто = attemptId или batchRunId) |

## Маршрутизация по type

| Префикс | Файл |
|---------|------|
| `glue.*`, `gate.*`, `apply.*`, `outcome.*`, `vacancy.*` | `data/conversion-events.jsonl` |
| `rag.*`, `l4.*`, `knowledge.*` | `data/logs/apply-intelligence.jsonl` |
| `llm.*` | `data/logs/llm-usage.jsonl` |
| `letter.*` | `data/letter-metrics.jsonl` |
| `copilot.*` | `data/logs/copilot-events.jsonl` |
| `job.*` | `data/logs/job-events.jsonl` |

## API emit

```javascript
import { emitObsEvent, newCorrelationId } from '../lib/observability.mjs';

emitObsEvent('apply.finished', { outcome: 'ok' }, {
  correlationId: newCorrelationId('attempt'),
  batchRunId,
  phase: 'apply.finished',
});
```

Через glue: `emitConversionEvent()` — с kill switch.

## Реестр

`lib/observability-registry.mjs` — каждый модуль с emit обязан иметь запись. CI: `npm run test:observability`.

## Чтение

- `readConversionEvents({ limit, batchRunId, correlationId, typePrefix })`
- `GET /api/conversion-events` — debug/expert в дашборде

## Kill switch

`observability.enabled` в preferences или `HH_OBSERVABILITY=0`.

## OBS-0 (срез)

- `lib/observability.mjs`, registry, schema v1
- emit в glue + batch/ingest
- тесты: `test-observability-registry`, `test-observability-schema`, `test-conversion-glue`

Следующие волны: digest metrics blocks, alerts, `metrics_daily` SQLite.
