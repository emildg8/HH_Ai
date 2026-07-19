# HUNT-TRACKS — маршруты охоты по специальностям

> **Канон:** одна лента harvest и одна очередь; **маршруты** разделяют резюме, письма, фильтр серии и приоритеты — **не** «два режима охоты».  
> **Код:** `config/hunt-tracks.json`, `lib/hunt-tracks.mjs`  
> **Тест:** `npm run test:hunt-tracks`  
> **Статусы hh:** [`HH-NEGOTIATION-STATUS.md`](HH-NEGOTIATION-STATUS.md)

**Обновлено:** 20.07.2026 (сверка с MASTER: HT.6–HT.7.4 ✅ · письма по маршруту HT.3 код ✅; suggest→golden в MASTER ещё ⬜) · 01.07.2026

---

## Итоги сессии 29.06 (зафиксировано)

### Диагноз отказов (видео + данные)

| Факт | Значение |
|------|----------|
| Отказы в очереди | 42 |
| Просмотрено, без ответа | 48 — база для follow-up |
| «Приглашения» на hh | 3 — **переоценены** (см. inviteKind) |
| Живой диалог с HR | ≈ 0 по синхронизированным чатам |
| Главная причина отказов | Резюме/письма читаются как **L2/поддержка**, не DevOps; разрыв стека (GitLab, DevSecOps, DBA) |

### Уточнения партнёра

1. **Маршруты по профессиям** — да: DevOps, Infra, L2/L3, TAM — каждый со своим резюме, письмом, критериями вакансий и приоритетом. Широкий опыт — не повод смешивать в одном отклике.
2. **«Приглашения» hh** — статус выставляет **сам hh.ru**; нужен `inviteKind`, не «чинить парсер как баг».
3. **Follow-up по просмотренным** — партнёр **вручную** отписался по шаблону 29.06; авто-nudge для `viewed` — в бэклог.
4. **Северная звезда** — слот E **не зажёгся**; Printum/Dataloft — скорее `hh_tab_stage` / `silent_invite`, не созвон.

---

## Модель: одна очередь, параллельные маршруты

```
harvest (широкий) → одна очередь vacancies-*.json
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    track: devops    track: infra    track: l2l3 / tam
    resume devops    resume devops   resume support/tam
    letter R0        letter R1       letter R2
    batch P1         batch P2        batch P3 (approval)
```

**Запрещено** (канон `AGENT-DOMAIN-TRUTH.md`):

- отдельный harvest на трек;
- смешивать package в scoreOverall;
- ослаблять minus на apply ради объёма.

---

## Маршруты (канон)

| ID | Название | R-tier | Резюме hh | Письмо (ядро STAR) | Авто-серия | Point apply | Приоритет |
|----|----------|--------|-----------|-------------------|------------|-------------|-----------|
| `devops` | DevOps / SRE | R0 | DevOps-инженер | СБП + Docker/CI/CD + pet HH Ai (1 фраза) | да | **auto** (HT.7.1) | **P1** |
| `infra` | Смежная инфра | R1 | DevOps-инженер* | FBD Proxmox/Zabbix + банк | да | **auto** (HT.7.2 ✅) | **P2** |
| `l2l3` | L2 / L3 поддержка | R2 | Поддержка / L2 | Softline SLA + банк L2 | только с approval | **auto+approval** (HT.7.3) | **P3** |
| `tam` | TAM | R2 | TAM | эскалации + процессы | только с approval | **auto_with_approval** | **P3** |

\*Infra и DevOps делят `resumeRole: devops` — различие по **R-tier** и chip `huntTrack` в UI обязательно.

### Достаточность маршрутов (канон 29.06.2026)

Четырёх треков **хватает** для инфра-ленты партнёра; пятый не нужен. Сводка ролей × ЗП × HR-tier — [`CANDIDATE-POSITIONING-2026.md`](CANDIDATE-POSITIONING-2026.md).

### Вне маршрутов (ручной контур)

DBA, DevSecOps без evidence, PR, regional, lead, ML — **не** в авто-серии; только `userApproved` на карточке.

---

## Конфиг

- Канон: [`config/hunt-tracks.json`](../config/hunt-tracks.json)
- Шаблон: [`config/hunt-tracks.example.json`](../config/hunt-tracks.example.json)
- Резюме: [`config/resume-routing.json`](../config/resume-routing.json) (или `.local.json`)
- R-tier: [`config/role-ladder.json`](../config/role-ladder.json)
- Письма × tier: [`ROLE-LADDER-M0-MATRIX.md`](ROLE-LADDER-M0-MATRIX.md)

### CLI / серия

```powershell
# Только DevOps (замена --devops-title-only)
node scripts/hh-apply-batch.mjs --dry-run --hunt-track=devops --limit=5

# DevOps + смежная инфра
node scripts/hh-apply-batch.mjs --dry-run --hunt-tracks=devops,infra --limit=10

# L2 — только с batchAllowRoleTierR2 / approved
node scripts/hh-apply-batch.mjs --dry-run --hunt-track=l2l3 --limit=5
```

`listBatchCandidates({ huntTracks: ['devops'] })` — фильтр после apply-gate и R-tier.

---

## План реализации (фазы)

### Фаза HT.1 — ядро серии ✅ (29.06.2026)

| Задача | Статус |
|--------|--------|
| `config/hunt-tracks.json` | ✅ |
| `lib/hunt-tracks.mjs` | ✅ |
| `batch-candidates` + `hh-apply-batch` CLI | ✅ |
| `test:hunt-tracks` | ✅ |
| Документация inviteKind | ✅ [`HH-NEGOTIATION-STATUS.md`](HH-NEGOTIATION-STATUS.md) |
| `lib/hh-invite-kind.mjs` + sync | ✅ |
| `test:hh-negotiations-sync` | ✅ |

### Фаза HT.2 — UI и precheck ✅ (29.06.2026)

| Задача | Статус |
|--------|--------|
| Chip `huntTrack` на карточке | ✅ `card-status.mjs`, enrich API |
| Селектор трека в toolbar серии | ✅ `#batch-hunt-tracks` в sidebar |
| Precheck breakdown по трекам | ✅ `byTrack` в `batch-precheck-report` + модалка |
| Settings: `batchHuntTracks` default | ✅ `settings-registry`, `preferences.json` |
| API `huntTracks` query | ✅ `/api/batch-precheck`, `/api/hh-launch-apply-batch`, `/api/hunt-tracks` |
| Badges `inviteKind` в «Отклики» | ✅ `card-status` + `app.js` tooltips |

### Фаза HT.3 — письма по маршруту ✅

| Задача | Файлы | Статус |
|--------|-------|--------|
| `pickLetterTalkingPoints` с bias по `track.inventoryRoles` | `candidate-skills-inventory.mjs` | ✅ |
| Промпт письма по маршруту (`STRUCTURE_BY_HUNT_TRACK`, anti-framing) | `cover-letter-role-prompt.mjs`, `cover-letter-openrouter.mjs` | ✅ |
| `huntTrack` в knowledge pack + M0 fallback | `candidate-knowledge-pack.mjs`, `cover-letter-cv-facts.mjs` | ✅ |
| Тесты devops vs l2l3 | `test:cover-letter-m0-pack` | ✅ |

### Фаза HT.4 — воронка и follow-up ✅

| Задача | Файлы | Статус |
|--------|-------|--------|
| KPI north star только `real_hr_invite` | `funnel-analytics.mjs`, `outcome-classifier.mjs`, `funnel-north-star-metrics.mjs` | ✅ |
| UI badges inviteKind | `app.js`, `card-status.mjs` | ✅ (HT.2) |
| Nudge для `viewed` 3–7 дней | `chat-follow-up.mjs`, `chat-follow-up-schedule.json` | ✅ |
| Авто-черновик viewed nudge | `defaultViewedNudgeText()`, `dashboard-server.mjs` | ✅ |

### Фаза HT.5 — резюме по маршруту (после M0.2 baseline)

> **Чеклист baseline:** [`MULTIMODAL-ROADMAP.md`](MULTIMODAL-ROADMAP.md) §M0.2 baseline · **~70%** на 29.06 (осталось CV hh).

| Задача | Файлы | Статус |
|--------|-------|--------|
| Prep текстов без L4 / без записи на hh | [`config/hunt-track-resume-drafts.json`](../config/hunt-track-resume-drafts.json), [`lib/hunt-track-resume-drafts.mjs`](../lib/hunt-track-resume-drafts.mjs) | ✅ prep |
| Тест черновиков | `npm run test:hunt-track-resume-drafts` | ✅ |
| Отдельные тексты резюме hh по треку | `resume-variants` + sync | M0.2 baseline ✅ (галочки 1–7); запись на hh — отдельный шаг |
| Запись `devops` в hh из draft | `scripts/devops-apply-hunt-track-resume.mjs`, `--verify-only` | ✅ 29.06 live (5 навыков; Playwright в about) |
| L4 подгонка по треку | лимит 15/день — не скипать tier A | после prep + approve |

**Черновики по треку:** `aboutMe`, `titleSuggestion`, `experienceFraming`, `skillsHighlight` (letterSafe из inventory), `antiPatterns`. API: `getDraftForTrack('devops'|'infra'|'l2l3'|'tam')`.

### Фаза HT.6 — кабинет hh.ru (все маршруты) ▶

> **Канон:** [`H-PROFILE-ROADMAP.md`](H-PROFILE-ROADMAP.md) · слой 1 · субагенты HT.6.0–6.8

| Задача | Статус |
|--------|--------|
| Аудит 5 резюме + baseline воронки | ⬜ HT.6.0 |
| Черновики devops / infra / l2l3 / tam | ⬜ HT.6.1–6.4 |
| L3 ревью партнёра + `resume-routing` | ⬜ HT.6.5 |
| Запись hh (`verify-only` → live) | ⬜ HT.6.6 (devops ✅ 29.06) |
| Regen писем tier A по трекам | ⬜ HT.6.7 |
| L4 resumeSafe tier A (опц.) | ⬜ HT.6.8 |

### Фаза HT.7 — умный точечный автоотклик ▶

> **Канон:** [`H-PROFILE-ROADMAP.md`](H-PROFILE-ROADMAP.md) §слой 2 · **не** mass apply · `pointApply.mode` в [`config/hunt-tracks.json`](../config/hunt-tracks.json)

| Задача | Статус |
|--------|--------|
| Auto devops 1–2/день (`--track=devops`) | ▶ HT.7.1 |
| Auto infra (пилот HT.7.2) | ✅ HT.7.2 |
| l2l3 — auto **с approval**; title L2/L3 не менять | ▶ HT.7.3 |
| tam — auto_with_approval (`apply-point-ready --track=tam`) | ✅ HT.7.3 |
| KPI: +1 `real_hr_invite`, funnel digest | ⬜ HT.7.4 |
| viewed-nudge: фильтр thread в sync | ⬜ backlog |

---

## Допущения и риски

- **Допущение:** R-tier + resume-routing достаточно для классификации трека; edge cases (support_lead, data) — вручную или расширение конфига.
- **Риск:** Infra/DevOps с одним резюме hh — HR всё ещё видит L2 в опыте до L4/M0.2.
- **Запасной вариант:** ручная серия по одному треку через `--hunt-track` без UI.

---

## Проверки

```powershell
npm run test:hunt-tracks
npm run test:hunt-track-resume-drafts
npm run test:hh-negotiations-sync
npm run test:role-ladder
npm run test:batch-readiness
```

---

## См. также

- [`HUNT-ARCHITECTURE.md`](HUNT-ARCHITECTURE.md)
- [`ROLE-LADDER-M0-MATRIX.md`](ROLE-LADDER-M0-MATRIX.md)
- [`AGENT-DOMAIN-TRUTH.md`](AGENT-DOMAIN-TRUTH.md)
- [`WORK-PLAN-C2-FOLLOWUP.md`](WORK-PLAN-C2-FOLLOWUP.md)
