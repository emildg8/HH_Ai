# Дневной оркестратор охоты (`hunt-day`)

> **Срез 1 (17.07.2026):** `status` · `plan` · логический mutex `apply-lane.lock`.  
> **Срез 2:** `ship` (point|basket) + outcome JSON · `repair` отдельной фазой · без авто-repair в ship · skip-id на лестнице.  
> **Срез 3:** radio/анкета pre-submit · HTTP 200 без verify = fail.  
> **Срез 4:** агенту live ship **только** через `hunt-day` (не прямой pack-ship / point-ready).  
> Live ship только с `--go`. Канон поверхностей: [`APPLY-END-TO-END-PLAYBOOK.md`](APPLY-END-TO-END-PLAYBOOK.md) · DoD: [`APPLY-CHAIN-STABLE.md`](APPLY-CHAIN-STABLE.md).

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
| `… -- repair --id=` после naked | Авто-repair внутри ship |
| `npm run devops:hunt-day:anastasia -- ship --mode=basket --go --only=<uuid>` | Прямой live `anastasia-pack-ship` (без явной просьбы) |

Закреплено: `AGENTS.md` · `agent-domain-truth.mdc` · skill `hh-ru-apply-workflow` · playbook Day.

**Анастасия (`:3850`):** live только `devops:hunt-day:anastasia -- ship --mode=basket --go …`. Point на QA — `status`/`plan` ok; live point только после ручного plan и явной просьбы. Движок корзин `anastasia-pack-ship` остаётся для dry-run/отладки. Курс дня ≤ `hhApplyChatMaxPerDay` (сейчас 5). `--pack=` у Насти не поддержан.

---

## Команды

**Ритуал дня (pain-wave1 + automation plan):** `status` → `plan --limit=10…15` (меню дня) → prep писем по shortlist → `ship --go --limit=1…3` (пачка, не все 15). После sync: `npm run devops:audit-false-invited`. Канон автоматизации: [`HUNT-APPLY-AUTOMATION-PLAN.md`](HUNT-APPLY-AUTOMATION-PLAN.md).

```powershell
cd d:\Dev\apps\hh-ai

npm run devops:hunt-day:emil -- status --mode=point
npm run devops:hunt-day:emil -- plan --mode=point --dry-run --limit=15
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
