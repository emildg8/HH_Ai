# PreApplyGate (этап 1)

Единая проверка перед откликом: targeting, red flags, resume-fit, качество письма → **gateScore** и эвристика **P(invite)**.

## API

```
GET /api/apply-gate/preview?recordId=<id_очереди>
GET /api/apply-gate/preview?vacancyId=131926667
```

**Какой id куда:**

| Источник | Параметр | Пример |
|----------|----------|--------|
| Число из URL hh.ru (`/vacancy/131926667`) | `vacancyId` | `?vacancyId=131926667` |
| Внутренний id карточки в очереди | `recordId` | смотри ниже |

Внутренний `recordId` **не** равен номеру на hh.ru. Узнать:
- в DevTools на карточке: атрибут `data-record-id` на элементе списка;
- или используйте `vacancyId` из ссылки «Открыть на hh.ru».

После обновления кода **перезапустите дашборд** (`npm run dashboard`), иначе будет `Неизвестный путь API`.

Ответ: `pass`, `skipReason`, `gateScore`, `pInvitePct`, `effectiveMinGate`, `reasons[]`, `components`.

## Настройки (`config/preferences.json`)

```json
"applyIntelligence": {
  "enabled": true,
  "minGateScore": 60,
  "minGateScoreDream": 45,
  "dreamEmployers": [],
  "useEmployerScore": true
}
```

**effectiveMinGate** = `max(minGateScore, dashboardMinScoreFilter)`; для dream-работодателя — `minGateScoreDream`.

Kill switch: `applyIntelligence.enabled: false` или `HH_APPLY_GATE=0`.

## События glue

`gate.preview` → `gate.decided` в `data/conversion-events.jsonl` (при `decideApplyGate` / emit).

## Тесты

```bash
npm run test:apply-gate
```

Связано: `docs/CONVERSION-GLUE.md`, `docs/OBSERVABILITY.md`.
