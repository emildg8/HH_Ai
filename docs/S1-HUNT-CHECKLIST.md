# S1 — precheck и точечный автоотклик

**Северная звезда:** точечный автоотклик по карточкам с tier A → слот E. **Канон:** [MASTER-ROADMAP.md](MASTER-ROADMAP.md) блок «Где мы».

Исторический чеклист mass apply (среда 25.06): [`archive/2026-06-mass-apply-era/S1-HUNT-CHECKLIST-mass-apply-era.md`](archive/2026-06-mass-apply-era/S1-HUNT-CHECKLIST-mass-apply-era.md).

## Автопроверка (агент)

```powershell
cd D:\Dev\apps\hh-ai
npm run devops:s1-preflight
npm run devops:s1-prepare-letters -- --dry-run --limit=25
npm run devops:s1-prepare-letters -- --regen --limit=25 --min-score=50
npm run test:s1-hunt-preflight
npm run test:s1-prepare-letters
```

### Точечный автоотклик (дефолт)

- Рабочий ритм: **1–2 готовые карточки** в день — gate + письмо tier A → отклик с карточки или через «Готов к отклику».
- В очереди нет свежих tier A — берём **топ по score ≥ 50** (DevOps/SRE в приоритете по сортировке).
- Gate **60** (пресет «Сбалансированный») — базовый порог; «Разведка» (45) — только осознанно, на короткий период.
- `batchAutoApproveBestLetter: true` — лучший черновик утверждается после генерации.

## Настройки охоты (DevOps, удалёнка, 200k+)

| Параметр | Цель |
|----------|------|
| `minMonthlyRub` | ≥ 200 000 |
| `targetMonthlyRub` | ≥ 200 000 |
| `requireRemote` | `true` |
| `batchRequireRemote` | `true` |
| `applyIntelligence.enabled` | `true` |
| `batchLetterMinScore10` | ≥ 6 (рекомендуем 7) |
| `hhApplyChatMaxPerDay` | 10–50 |
| `dashboardBatchSize` | размер серии, если запускаете вручную |

Пресет в дашборде: **«Сбалансированный»** + удалёнка.

## Перед точечным откликом

1. `devops:s1-preflight` — зелёный итог
2. `devops:funnel-digest` — свежий отчёт (не старше недели)
3. На карточке: gate pass, **approvedText** не пустой; при нужде «Перегенерировать» письмо
4. Expert-precheck в UI — не слепой автопилот
5. L4 partial на вакансии — skip или без L4
6. **Ритуал hunt-day (Emil):** `status` → `plan` → `prep --with-probe --probe-limit=2` → `ship --go --limit=1…3` ([`HUNT-DAY-ORCHESTRATOR.md`](HUNT-DAY-ORCHESTRATOR.md))
7. После sync чатов — `npm run devops:audit-false-invited` (сначала отчёт; `--reset` только после просмотра)
8. Skip `resume_visibility` в отчёте серии = «видимость резюме на hh (нужны клиенты HH)» — не ship Magritte/WE-ON/Флант, пока форма не чистая глазами

## Серия на дашборде (инструмент)

Серия откликов — **кнопка в UI**, не ежедневная цель. Запуск только по явному клику.

Перед серией — **те же правила precheck**, что и для точечного отклика:

1. `devops:s1-preflight` — зелёный итог
2. В дашборде: precheck серии → **готовность писем > 0**; при нужде «Перегенерировать»
3. Expert-precheck в UI
4. Scope «Без анкет» — дефолт для серии; анкеты — отдельный контур

CLI (опционально): `npm run devops:apply-batch` · `npm run devops:batch-precheck`.

## P0 перед охотой

```powershell
npm run devops:prep-wednesday          # harvest → письма → expert precheck (авто)
npm run devops:batch-precheck          # expert precheck → data/logs/batch-precheck-latest.md
npm run devops:wednesday-p0
npm run devops:s1-prepare-letters -- --approve-only --limit=32
```

1. **Harvest** — свежие вакансии
2. **Письма** — tier A с непустым `approvedText` на выбранных карточках
3. **LLM** — `config/presets/dslab-primary.env` → `secrets.local.env`; при OR 429 → `ollama-primary.env`
