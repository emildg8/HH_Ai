# Дневной оркестратор охоты (`hunt-day`)

> **Срез 1 (17.07.2026):** `status` · `plan` · логический mutex `apply-lane.lock`.  
> **Срез 2:** `ship` (point|basket) + outcome JSON · `repair` отдельной фазой · без авто-repair в ship · skip-id на лестнице.  
> **Срез 3:** radio/анкета pre-submit · HTTP 200 без verify = fail.  
> **Срез 4:** агенту live ship **только** через `hunt-day` (не прямой pack-ship / point-ready).  
> Live ship только с `--go`. Канон поверхностей: [`APPLY-END-TO-END-PLAYBOOK.md`](APPLY-END-TO-END-PLAYBOOK.md) · DoD: [`APPLY-CHAIN-STABLE.md`](APPLY-CHAIN-STABLE.md).  
> **UI2:** оболочка дня — `http://127.0.0.1:3849/day` · API `/api/day/*` (status / plan / ship → spawn hunt-day). Expert = `/`.

---

## Зачем

Много равноправных входов (`apply-point-ready`, `emil-pack-ship`, прямой `hh-apply-chat`, `deliver-letter`, robot) с разным DoD и риском параллельного ship. Оркестратор — **тонкая маршрутизация и mutex**, не новый Playwright-монолит.

Движок отклика по-прежнему [`hh-apply-chat-letter.mjs`](../scripts/hh-apply-chat-letter.mjs). Робот — отдельная поверхность ([`ROBOT-RECRUITER.md`](ROBOT-RECRUITER.md)).

---

## Агенту: live ship только здесь

| Делать | Не делать (live, без явной просьбы партнёра) |
|--------|-----------------------------------------------|
| `npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1` | `npm run devops:apply-point-ready -- …` (live) |
| `… -- ship --mode=basket --go --only=<uuid>` | `npm run devops:emil-pack-ship -- …` (live) |
| `… -- ship --dry-run` / отладка движка с dry-run | Прямой `hh-apply-chat` live «для проверки» |
| `… -- ship --go --after-ship=watch` | robot watchdog |
| `… -- ship --go --after-ship=chat-ai` | enqueue ИИ `/chat` → wait → `hh-chat-ai-queue process --go` (×2 в первую минуту) |
| `… -- repair --id=` после naked | Авто-repair внутри ship |
| `npm run devops:hunt-day:anastasia -- ship --mode=basket --go --only=<uuid>` | Прямой live `anastasia-pack-ship` (без явной просьбы) |

Закреплено: `AGENTS.md` · `agent-domain-truth.mdc` · skill `hh-ru-apply-workflow` · playbook Day.

**Анастасия (`:3850`):** live только `devops:hunt-day:anastasia -- ship --mode=basket --go …`. Point на QA — `status`/`plan` ok; live point только после ручного plan и явной просьбы. Движок корзин `anastasia-pack-ship` остаётся для dry-run/отладки. Курс дня ≤ `hhApplyChatMaxPerDay` (сейчас 5). `--pack=` у Насти не поддержан.

---

## Команды

**Ритуал дня (pain-wave1 + automation plan):** `status` → `plan` → **`assess`** (go/conditional/no-go) → prep писем по go/conditional → **live probe** на кандидатах → `ship --go --limit=1…3` **без** `--force-only` вслепую. После sync: `npm run devops:audit-false-invited`. Канон автоматизации: [`HUNT-APPLY-AUTOMATION-PLAN.md`](HUNT-APPLY-AUTOMATION-PLAN.md).

### Без лишних прогонов (урок 28.07)

| Делать | Не делать |
|--------|-----------|
| `prep --with-probe` / live `detectHhVacancySiteState` перед волной | HTTP-only «жива?» (бот-HTML врёт) |
| `ship --limit=1…3` из shortlist | Волна `--limit=9` + `--force-only` на всё |
| Архив/отказ → skip, **без** letter-repair (default) | Spawn `deliver-letter` на архиве (висит минутами) |
| Один apply-lane; параллельно — только разбор/доки | В том же треде форма Google + ship |
| Sales/AM режет `role-classify` | Надеяться, что score 66 = инфра |

Откат repair: `HH_LETTER_REPAIR_ON_DECLINED=1` · `HH_LETTER_REPAIR_ON_ARCHIVED=1`.

**Переговоры перед status/plan/assess/`ship --go`:** всегда merge `hh-negotiations-cache.json` в очередь (`status=applied` при viewed/awaiting/…). Live `sync-hh-responses`, если кэш старше **12 ч** или файла нет (или явный `--sync`). На **live ship** `--no-sync` запрещён (отладка: `--force-no-sync`). Для plan/assess: `--no-sync` / `HH_HUNT_DAY_SYNC=0` — только merge без браузера. В JSON: `negotiationsPrep`. Ready не включает карточки с `hhSiteState` viewed / awaiting / already_applied (даже `hhDetectedOnly` без письма) — letter-repair через `repair --id=` / `ship --only=`.

**Видимость резюме:** если на hh уже «всем работодателям / клиентам» — не звать партнёра кликать снова. Ложный баннер Magritte на форме → `formBannerIgnored`, ship продолжается; в отчёте не писать «уже отклик».

### Слои ворот (порядок)

1. Minus роли (architect / ИБ / **L1** через `titleLooksL1HelpdeskRole` / crypto-**роль** из policy)  
2. Маршрут (devops / infra / l2l3)  
3. Локальный status / pack exclude  
4. Fit / ЗП / удалёнка или гибрид  
5. Свежесть Tier A — по умолчанию **14 дней** (`HH_FRESH_TIER_A_MAX_HOURS`, default `336`; откат `=72`)  
6. Письмо: soft в assess/ready при `pointApplyAutoPrepareLetters` → prep до ship  
7. Live на hh (архив / отказ / already)  
8. Ship + квота дня  

Assess = шаги 1–6. Probe = 7. Ship = 8. Голое слово *helpdesk* в assess **не** режет L2/L3; компания «Криптонит» ≠ crypto-роль.

### Откат ворот (быстро)

| Симптом | Действие |
|---------|----------|
| Много мёртвых на probe | `$env:HH_FRESH_TIER_A_MAX_HOURS=72` |
| Письмо снова жёстко в ready | prefs `pointApplyAutoPrepareLetters: false` |
| Assess «разъехался» | `git checkout -- lib/hunt-day-assess.mjs lib/fresh-tier-a.mjs` (+ `role-classify.mjs` если правили L1) |
| Полный откат среза | `git revert` коммита ворот → `npm run test:hunt-day-assess` |

Сценарий repair: [`SCENARIOS-PLAYBOOK.md`](SCENARIOS-PLAYBOOK.md) №89.

```powershell
cd d:\Dev\apps\hh-ai

npm run devops:hunt-day:emil -- status --mode=point
npm run devops:hunt-day:emil -- status --mode=point --no-sync
npm run devops:hunt-day:emil -- plan --mode=point --dry-run --limit=15
npm run devops:hunt-day:emil -- plan --mode=point --dry-run --limit=15 --sync
npm run devops:hunt-day:emil -- assess --limit=20
npm run devops:hunt-day:emil -- prep --limit=8
npm run devops:hunt-day:emil -- prep --limit=8 --with-probe --probe-limit=2
npm run devops:hunt-day:emil -- ship --mode=point --dry-run --limit=1
npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1 --skip-id=<uuid>
npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1 --only=<uuid>
npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1 --only=<uuid> --prepare-letters
npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1 --after-ship=watch
npm run devops:hunt-day:emil -- ship --mode=basket --go --only=<uuid>
npm run devops:hunt-day:emil -- repair --id=<uuid>

# После sync-chats — ложные invited (только отчёт; --reset осознанно)
npm run devops:audit-false-invited
npm run devops:sync-chats:emil

# Настя — basket
npm run devops:hunt-day:anastasia -- status --mode=basket
npm run devops:hunt-day:anastasia -- plan --mode=basket --dry-run
npm run devops:hunt-day:anastasia -- ship --mode=basket --dry-run --limit=1
npm run devops:hunt-day:anastasia -- ship --mode=basket --go --only=<uuid>
npm run devops:hunt-day:anastasia -- repair --id=<uuid>
```

**`--only=` (point):** по умолчанию **без** авто-regen лестницы (`--no-prepare-letters`). Откат: `--prepare-letters` или `HH_POINT_PREPARE_ON_ONLY=1`. Канон: [`HUNT-APPLY-AUTOMATION-PLAN.md`](HUNT-APPLY-AUTOMATION-PLAN.md).

**P0 25.07 — site preflight + quota-aware pick:** [`PLAN-POINT-APPLY-P0-2026-07-25.md`](PLAN-POINT-APPLY-P0-2026-07-25.md). Soft/hard skip по store перед `--only=` (без браузера); дефицитный трек в pick. Откат: `HH_POINT_ONLY_SITE_PREFLIGHT=0`, `HH_POINT_QUOTA_AWARE_PICK=0`, обход hard: `--force-only`. Audit: `npm run devops:audit-declined-as-ok`.

**Live ship только с `--go`.** Без `--go` всегда dry-run.

**`--after-ship=watch`:** после `status=ok` — `robot-recruiter-watch` по этим id (`--send-auto`, wait 45 с по умолчанию, `--after-ship-wait=`). Чипы hh не жмём. Робот — отдельная поверхность.

### Артефакты

| Файл | Когда |
|------|--------|
| `data-emil/logs/hunt-day-status-latest.json` | `status` |
| `data-emil/logs/hunt-day-plan-latest.json` | `plan` |
| `data-emil/logs/hunt-day-prep-latest.json` | `prep` |
| `data-emil/logs/hunt-day-ship-latest.json` | `ship` (outcomes, без авто-repair) |
| `data-emil/logs/hunt-day-repair-latest.json` | `repair` ×1 → `ok_repaired` |
| `data-emil/session/apply-lane.lock` | занятый lane (ship/repair) |

### Режимы ship

| `--mode` | Движок | Авто-repair |
|----------|--------|-------------|
| `point` | `devops-apply-point-ready` | нет |
| `basket` | `emil-pack-ship --no-letter-repair` | нет |

Naked → отдельно: `repair --id=` (deliver-letter ×1). Статус `ok_repaired` ≠ цель дня (first-pass).

### skip-id и лестница

`resolvePointApplyPool({ skipIds })` не останавливается на единственном ready=skip: идёт на следующий шаг лестницы (fresh → tier A).


---

## Mutex apply-lane

Отдельно от `browser.lock` (профиль Chromium):

- файл: `{HH_DATA_DIR}/session/apply-lane.lock` — `pid`, `owner`, `command`, `at`
- `plan` при чужом live lock → exit **2** (`plan-conflict`)
- второй `ship` при занятом lane → exit **2** (`apply-lane-busy`)
- stale: процесс мёртв или возраст > 45 мин → снимается автоматически

Сообщение агенту: «другой чат уже ship» — не запускать параллельный apply.

---

## Три поверхности (не смешивать)

```text
status/plan  →  (срез 2) prep → ship  →  (отдельно) watch robot
                     │
                     └─ не вызывать robot send из ship
```

| Фаза | Поверхность hh |
|------|----------------|
| ship | мастер отклика (+ анкета в том же мастере) |
| watch / robot reply | chatik после отклика |
| edit bubble ⋯ | правка пузыря — не first-pass |

---

## Проверка

```powershell
npm run test:hunt-day-plan
```

---

## Срезы

| Срез | Содержание |
|------|------------|
| 1–2 | ✅ status/plan/ship/repair · lane lock · без авто-repair |
| 3 | ✅ radio/анкета pre-submit; HTTP 200 без verify = fail |
| 4 | ✅ AGENTS: агенту live ship только через `hunt-day` |
| 5 | ✅ hunt-day Анастасия: basket plan/ship · `--no-letter-repair` · npm `hunt-day:anastasia` |

Дальше: отдельная команда `watch` / `report`; полный point-parity QA.  
**Сейчас:** `ship --go --after-ship=watch` — дожим робота после ok.

---

## См. также

- [`HUNT-BASKET-ROUTE.md`](HUNT-BASKET-ROUTE.md) — разрыв point vs basket писем
- [`HUNT-APPLY-PACE.md`](HUNT-APPLY-PACE.md) — темп
- [`SESSION-2026-07-13-parallel-apply-postmortem.md`](SESSION-2026-07-13-parallel-apply-postmortem.md) — почему нужен lane
