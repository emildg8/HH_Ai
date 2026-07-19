# SESSION 2026-07-20 — закрытие рисков ME-ревью

После полного ревью: вердикт был **FIX**. Ниже закрытие P0–P1.

## Сделано

| Риск | Фикс |
|------|------|
| **P0** visibility preflight декоративный | `devops-apply-point-ready`: `verifyVacancyId` + **abort** при `!vis.ok`; ошибка preflight fail-closed |
| **P0** успех `show-hh-clients` без form-verify | после save — verify на форме при `verifyVacancyId` |
| **P1** волна писем = все pending | `collectPointDayWaveLetterItems`: только applied-сегодня + shortlist + focus |
| **P1** title-ok маскировал sticky | sticky **до** title-ok; empty title → STOP; modal STOP и по sticky mismatch |
| **P1** ложный invited | `devops-audit-false-invited` (+ `--reset`); сброшен Devhunt DevSecOps; Helix уже pending |

## Команды

```powershell
npm run devops:audit-false-invited
npm run devops:audit-false-invited -- --reset
node scripts/test-hh-resume-picker-cross-track.mjs
node scripts/test-letter-wave-fingerprint.mjs
node scripts/test-point-apply-gate.mjs
```

## Откат

| Слой | Как |
|------|-----|
| Visibility abort | `HH_RESUME_VISIBILITY_PREFLIGHT=0` |
| Point-wave | `HH_POINT_WAVE_FINGERPRINT=0` |
| Sticky | Вариант B quiz-gate SESSION |
| Invited reset | baseline `data-emil/baselines/false-invited-audit/latest.json` → вернуть site вручную |

## Партнёру

- WE-ON/Флант — по-прежнему не ship без dry-run на **целевой** vac после clients.
- Helix — pending, только руками.
- Коммит этого среза — по просьбе.
