# SESSION 2026-07-20 — visibility Magritte proof

## Вердикт

`showResumeVisibleToHhClients` для infra CV («Системный инженер», hash `64a523ca…`):

- Страница резюме / список: текст «клиентам HH» → раньше **`already: true`**
- Форма отклика (vac `133643774`): всё ещё «поменяйте видимость… клиентам HeadHunter»
- **Фикс детектора (20.07):** verify на форме → `ok: false`, `reason: false_positive_already` (exit 3)

Preflight без verifyVacancyId по-прежнему может дать ложный already — point-ready должен передавать verify.

## Baseline

`data-emil/baselines/visibility-proof-2026-07-20/`

- `snapshot.json` — hash infra, WE-ON `rejected`
- `live-result.json` — лог прогона с `false_positive_already`

## Команда

```powershell
node scripts/run-with-instance.mjs --instance=emil -- node scripts/devops-emil-fix-resume-visibility.mjs --hash=64a523ca
```

## Следствия

| Действие | Статус |
|----------|--------|
| Ship WE-ON / Флант / L2 с visibility-блоком | **запрещён** до ручной сверки Magritte clients на странице резюме |
| Preflight в point-ready | остаётся best-effort; откат `HH_RESUME_VISIBILITY_PREFLIGHT=0` |
| Партнёр | открыть резюме «Системный инженер» → видимость → явно **компаниям-клиентам HH**; повторить verify |

## Откат

Не меняли store WE-ON. Baseline только для аудита.
