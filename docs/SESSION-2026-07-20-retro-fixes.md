# SESSION 2026-07-20 — ретро-фиксы H (после 05–19.07)

Закрытие плана исправлений после полной ретро. Коммиты срезов 1–2 — по просьбе партнёра 20.07 вечер.

## Сделано

| Этап | Результат |
|------|-----------|
| **A2 sticky P2** | `questionnaireInfraFamilyStickyMismatch` → STOP devops↔infra на quiz + reload×1; тесты ✅ |
| **A3 point-wave** | `analyzePointDayWaveLetterFingerprints` в point-apply-gate; IT_One ≥2 block; `HH_POINT_WAVE_FINGERPRINT=0`; в `test:letters` |
| **A1 visibility** | Live proof: `false_positive_already` — список/страница CV ≠ форма отклика; детектор усилен; WE-ON не ship |
| **B2 drift** | `pending`+`already_applied` = **0** хвостов |
| **B1 prep probe** | `prep --with-probe --probe-limit=N`; plan `needsProbe`; тест mock spawn ✅ |
| **B3 docs** | MASTER · HUNT-TRACKS шапка · WORK-PLAN статус · README S1 |
| **C** | [`COMMIT-SLICES-2026-07-20.md`](COMMIT-SLICES-2026-07-20.md) · stub hunt-day помечен test-only |

## Baselines

- `data-emil/baselines/visibility-proof-2026-07-20/`
- `data-emil/baselines/status-drift-2026-07-20/` (count 0)
- `data-emil/baselines/apply-quality-2026-07-19/` (ранее)

## Откат

| Слой | Как |
|------|-----|
| Sticky P2 | Вариант B [`SESSION-2026-07-18-resume-quiz-gate.md`](SESSION-2026-07-18-resume-quiz-gate.md) |
| Point-wave | `HH_POINT_WAVE_FINGERPRINT=0` |
| Visibility preflight | `HH_RESUME_VISIBILITY_PREFLIGHT=0` |
| Prep probe | без `--with-probe` |

## Партнёру (дополнение 20.07 вечер)

1. Magritte infra CV «компаниям-клиентам HH» — **партнёр: ок**. Авто-verify на форме (vac `133643774`) всё ещё `false_positive_already` / блок видимости — Magritte список ≠ gate на **этой** форме; ship WE-ON/Флант по-прежнему не делать без dry-run на целевой вакансии.
2. **Касперский Helix** `135281073`: в store был ложный `invited`/`responded`; на hh кнопка «Откликнуться» — **отклика нет**. Карточка сброшена в `pending`. Не auto-ship (опыт 6+, Helix stretch) — только руками / после письма+gate.
3. Коммиты — срезы 1–2 ретро-фиксов + push.

## Проверки

```powershell
node scripts/test-hh-resume-picker-cross-track.mjs
node scripts/test-letter-wave-fingerprint.mjs
node scripts/test-point-apply-gate.mjs
node scripts/test-hunt-day-plan.mjs
```
