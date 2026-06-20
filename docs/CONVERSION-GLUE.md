# Conversion glue (склейка воронки)

Единая точка **стыковки** модулей воронки «отклик → интервью». Glue **не** дублирует бизнес-логику gate/RAG — только emit событий и hooks.

## Модули

| Файл | Назначение |
|------|------------|
| `lib/conversion-glue.mjs` | `emitConversionEvent`, `registerConversionHook`, `runConversionHooks` |
| `lib/observability.mjs` | JSONL emit, correlation ids, маршрутизация |
| `lib/observability-registry.mjs` | контракт: модуль → события |
| `data/conversion-events.jsonl` | журнал glue/gate/apply/outcome |

## Kill switch

Отключение (no-op, legacy path без записи):

- `config/preferences.json`: `conversionGlueEnabled: false` или `observability.enabled: false`
- env: `HH_CONVERSION_GLUE=0` или `HH_OBSERVABILITY=0`

Проверка: `resolveApplyIntelligence()` в `lib/apply-intelligence-prefs.mjs`.

## Фазы hooks (порядок)

```
vacancy.ingested → gate.preview → gate.decided →
letter.prepared → resume.tailored → apply.started → apply.finished →
negotiation.synced → outcome.classified → knowledge.written →
invite.detected → prep.triggered → interview.debrief → pattern.learned →
contact.extracted → contact.linked → hitl.queued → hitl.resolved
```

**Glue-0 (текущий срез):** emit в `vacancy-ingest`, `hh-apply-batch`.

## Подключение модуля

```javascript
import { emitConversionEvent } from './conversion-glue.mjs';

emitConversionEvent('vacancy.ingested', { recordId, source }, {
  correlationId: recordId,
  recordId,
  phase: 'vacancy.ingested',
});
```

Новый emit → строка в `observability-registry.mjs` + тест `test:observability`.

## API

`GET /api/conversion-events?limit=50&batchRunId=...&correlationId=...&typePrefix=apply.`

## Тесты

```bash
npm run test:conversion
npm run test:observability
```
