# План работ после C2-серии (мультимодальный разбор)

> **Канон «где мы»:** [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md).  
> **Детальный разбор (агент):** `.cursor/plans/l4_и_письма_004f30ff.plan.md`  
> **Статус (20.07):** C2-серия mass apply — **архив**; актуальный north star — **слот E** через `hunt-day` point (не «ждём прогон серии»). Уроки C2 (грязный пул) остаются в силе.

**Обновлено:** 20.07.2026 (статус) · 29.06.2026

---

## Итог C2-серии (24.06, `apply-series-gated-c2.log`)

| Метрика | Значение |
|---------|----------|
| Precheck | **14 ready** @ min-score **65** |
| Отклики ok | **2 / 20** (оба DevOps-инженер) |
| Пропуски | **41** · off-target **23** |
| Стоп | `skip_ratio` (60% при пороге 50%) |
| L4 | лимит **15/15** `resumeEditMaxPerDay` — отклики шли **без** подгонки на hh.ru |

**Вывод:** узкое место — не score и не только письма, а **грязный пул кандидатов** (уже откликались, нет удалёнки, off-target в очереди).

---

## Три контура (не путать)

| Контур | Ограничивает поиск? | Что делает | Трек |
|--------|---------------------|------------|------|
| **H-TARGET minus** | Нет на hh.ru; да — чистоту очереди | architect, СПб, crypto… на **apply-gate** | HT.1 / HT.1b |
| **L4 apply** | Нет | подгонка резюме на hh.ru, **15 правок/день** (наш лимит) | B1 + M0 границы |
| **Письма LLM** | Нет | tier A → LLM+M0; сбой → шаблон | LLM-L0 + M0.2 |

---

## Очередь работ (после текущего прогона)

### Фаза 0 — гигиена очереди (**✅ 26.06**)

1. ✅ `sync-hh-responses` — обновлено **19** карточек / 886 (26.06)
2. ✅ `prune-responded-queue` — 1 responded убран (26.06)
3. ✅ свежий harvest (26.06) — **+15** в очередь, 157 skip title, 226 skippedTitle total
4. ✅ `devops:funnel-digest` — baseline 26.06 (`data/logs/funnel-digest-latest.md`)

**Precheck @65 (26.06, HT.1b):** ready **0 / 28** eligible (пул 68 → off-target −40); блокеры: red-flag **19**, letterQuality **9**. Fresh tier A @65–70: **0 ready** — серия не стартует без regen/harvest.

### 26.06 вечер — closure-срез (P0 conversion + ops)

1. ✅ **Recap-gate** — exit 7, strict questionnaire, chips UI, `HUNT-ARCHITECTURE.md`, SCENARIOS №66
2. ✅ `devops:rescan-approved-letters` — scanned **228**, recap снят **1** (DevOps Engineer Middle); повторный прогон **227 / 0** (`data/logs/rescan-approved-letters-latest.md`)
3. ✅ `devops:regenerate-letters --only-fixable` — **0** кандидатов (recap уже не в approved)
4. ✅ `devops:funnel-digest` — 26.06 ~23:37 MSK
5. **Precheck лестница (fresh tier A):** @55 → **0 ready / 8** · @50 → **0 ready / 9** · общий @50 → **1 ready / 52**
6. **Top блокеры:** стоп-сигнал (cooldown/hh_state) **~6**, letterQuality **~3** — не «нет удалёнки»

**Не доказано на hh.ru:** exit 7 post-check, strict questionnaire submit, micro-серия после fix.

### 27.06 — пауза охоты

- **Охота на паузе:** пул исчерпан — блокеры cooldown/hh_state и letterQuality; precheck **~0 готовых tier A** (fresh @65–70).
- **Ждём ответы HR** по откликам серии 24.06 (**2 ok**); **точечная охота**; серия — только по кнопке на дашборде.
- **I-track (суфлёр):** отдельная вкладка чата → [`COPILOT-ROADMAP.md`](COPILOT-ROADMAP.md); **не смешивать** с H-сессией.

### 29.06 — H-TRACKS HT.1–HT.4 + письма + ME-план

**Сделано (код + ops):**

| Блок | Итог |
|------|------|
| **HT.1–HT.2** | `config/hunt-tracks.json`, UI chips, precheck `byTrack`, badges `inviteKind` |
| **HT.3** | Письма по `huntTrack`: `cover-letter-role-prompt.mjs`, bias inventory, `test:cover-letter-m0-pack` |
| **HT.4** | KPI north star только `real_hr_invite`; viewed-nudge 3–7д в `chat-follow-up.mjs` |
| **Regen писем** | Снимок `data/logs/hunttrack-letter-before.json`; fix env dslab (`HH_ENV_PRELOADED`, `buildDslabChildEnv`); regen Haiku tier A DevOps |
| **Precheck devops** | **2 / 12 ready** tier A (было 0–1); блокеры **9× стоп-сигнал** (RWB `duplicate_company` до ~19.07), не letterQuality |
| **RWB аудит** | `data/logs/rwb-stop-signals-audit.json` — один отклик 19.06 «DevOps WB ID» → cooldown 30д на все RWB |

**Диагноз отказов (видео + sync):** 42 declined, 48 viewed; HR видит **L2/title** и письма с L2-framing на DevOps JD; «3 приглашения» hh — в основном `hh_tab_stage`, не слот E.

**Скрипты сессии:**

```powershell
node scripts/hunttrack-restore-and-regen.mjs          # restore + regen dslab
node scripts/devops-precheck-letter-fix.mjs           # precheck devops tier A
node scripts/rwb-stop-signals-audit.mjs                 # аудит RWB cooldown
npm run devops:batch-precheck -- --hunt-tracks=devops --fresh-tier-a --tier-a-only
```

**ME-план (точечный автоотклик):**

| Приоритет | Действие | Статус |
|-----------|----------|--------|
| **—** | **Mass apply (серия 20)** | **снято как цель**; инструмент дашборда остаётся → north star E |
| **P0** | **HT.5** — DevOps CV на hh | ✅ title+about+experience+skills (Playwright — в «О себе», не тег) |
| **P0** | Ops: sync + **viewed-nudge** | ✅ Rambler nudge (партнёр) → **далее агент** через `send-chat-reply` |
| **P0** | Точечный отклик precheck ready | ✅ **ВИМ MLOps** (партнёр) → **далее агент** через `apply-point-ready` + post-check |
| **P0** | M0.2 messaging baseline | ✅ |
| **P1** | RWB: gate до ~19.07 | ▶ |
| **P1** | HT.1 minus policy в harvest | ⬜ |
| **I-track** | Суфлёр T-FULL | отдельная вкладка → COPILOT-ROADMAP |

**Следующая H-сессия (копировать агенту):**

«SESSION-2026-06-29-h-track-close: ops на hh — агент (apply-point-ready + send-chat-reply); ждём HR; RWB до 19.07. I-track — COPILOT-ROADMAP.»

### 29.06 вечер — HT.5 close + north star ops (закрыто)

См. [`SESSION-2026-06-29-h-track-close.md`](SESSION-2026-06-29-h-track-close.md) — HT.5 ✅, ВИМ ✅, Rambler nudge ✅, урок Green Code/thread filter.

### Фаза 1 — H-TARGET: выровнять пул серии (**HT.1b**, **✅ код**)

**Проблема:** `listBatchCandidates` не отсекает `assessVacancyForApply.eligible === false` → precheck **14 ready**, batch крутит **43** карточки и **23** off-target.

**Сделано (24.06):** [`lib/batch-candidates.mjs`](../lib/batch-candidates.mjs) — `applyEligibleOnly` (по умолчанию); `batchPoolStats`; precheck — `offTargetInPool`. Тест: `npm run test:batch-readiness`.

**Не делать:** ослаблять architect / СПб / crypto на apply — профиль DevOps junior+, удалёнка.

### Фаза 2 — H-TARGET: ранний minus в harvest (**HT.1**, **▶ частично**)

Перенести title-only правила из [`reject-role-patterns.mjs`](../lib/reject-role-patterns.mjs) в [`runTitleOnlyFilters`](../lib/filters.mjs) через [`assessHarvestTitleReject`](../lib/targeting-policy.mjs): architect, crypto, QA, PM, analyst, **agile, security** ✅ (26.06). СПб / UTC+7 — только при городе в SERP (apply-gate).

Долгосрочно: единый [`lib/targeting-policy.mjs`](../lib/targeting-policy.mjs) wrapper из `config/targeting-policy.json` — **✅ 26.06** (`harvestTitleRules` + `getSerpMinusTokens` / `getTargetingSimpleToggles`).

### Фаза 3 — L4 vs M0 (**✅ срез кода 24–26.06**)

**L4 не режет harvest.** Перегружен apply-time write.

| Функция | Сейчас | Цель |
|---------|--------|------|
| Pet-факты в отклике | L4 + письмо | **M0 → письмо** (tier A) ✅ fallback; L4 только `resumeSafe` E2+ |
| Gate score boost | projected L4 | **M0 inventoryBoost** (advisory) — ✅ red-flag cvOnly + advisory |
| Резюме рекрутеру | L4 hh | **L3 PDF** + базовое; L4 hh — top-N tier A / день — ⬜ |
| UI превью | projected + квота | badge «правок сегодня: N/15» ✅ `formatResumeL4EditsLine` |

Срезы кода: `canEditToday` в L4 preview ✅; `l4EditsRemaining` в precheck + funnel-digest ✅; опц. `resumeEditReserveTierA` — ⬜.

### Фаза 4 — Письма: умный баланс tier A (**✅ код**)

**Принцип:** tier A — LLM + M0; остальное — шаблон. Fallback **не блокирует** серию, но **режет конверсию** к слоту E.

Пакет **A + C + B (мягкий)** — **✅**:

- A — observability: `tierAFallbackCount` в precheck / funnel-digest ✅
- C — 1–2 pet-факта из inventory в шаблон tier A (`resumeSafe`) ✅ `test:cover-letter-fallback-m0`
- B — мягкий stop в gated-series если &gt;50% tier A на `fallback-template` ✅

---

## Связь с дорожными картами

| Документ | Что обновлено |
|----------|----------------|
| [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md) | C2 итог, next step, риски |
| [`TARGETING-ROADMAP.md`](TARGETING-ROADMAP.md) | HT.1b, три слоя minus |
| [`MULTIMODAL-ROADMAP.md`](MULTIMODAL-ROADMAP.md) | матрица L4 / M0 / H-TARGET |
| [`MEGA-PLAN-NORTH-STAR.md`](MEGA-PLAN-NORTH-STAR.md) | статус C2 серии |
| [`FEATURE-MAP.md`](FEATURE-MAP.md) | строки HT.1b, letter tier, L4 quota UI |

---

## Проверка после фаз 1–4

```powershell
npm run test:targeting
npm run test:batch-readiness
npm run test:funnel-north-star-metrics
npm run devops:apply-series-gated -- --skip-harvest --skip-batch
```

---

## Фраза для агента (копировать)

«North star — точечный автоотклик и слот E; серия на дашборде — инструмент после preflight. HT.5 CV; viewed-nudge top-5; sync. I-track — COPILOT-ROADMAP.»
