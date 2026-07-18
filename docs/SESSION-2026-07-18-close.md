# Закрытие сессии 18.07.2026 — добор откликов + resume quiz-gate

> **Для новой вкладки:** читать этот файл первым · потом MASTER «Где мы» · при apply — skill `hh-ru-apply-workflow`.  
> Транскрипт чата: агент `66440ea4-113e-4f55-bbb8-126ff33f4ff4` (Cursor).  
> Коммит gate: **`99d3618`** · откат: [`SESSION-2026-07-18-resume-quiz-gate.md`](SESSION-2026-07-18-resume-quiz-gate.md).

---

## Где мы (итог вечера)

| | |
|--|--|
| **Цель дня** | Добрать 2–3 отклика взамен брака (Сбер facility, Marksman L1/сутки) |
| **Ушло на hh** | **СПБ Биржа** 21:17 · **Авангард** (virt) 21:20 — письма чистые, без «14+» |
| **Не ушло** | **ПЕТЕР-СЕРВИС** `134973403` — анкета 400, затем вакансия **недоступна** кандидату → `skipped` / `unavailable` |
| **Код** | P0+P1 resume quiz-gate ✅ · commit `99d3618` |
| **Квоты (на стоп)** | devops ~3–4/4 · infra 3/3 · l2l3 6/3 · hh ~21/35 |

North star без смены: слот **E**, не объём откликов.

---

## Что сделано в этом чате (хронология)

1. Добор clean-пула после фиксов facility / Marksman / letter overqual.
2. Live ship: СПБ Биржа ✅ · Авангард ✅ · ПЕТЕР ✗ (анкета → 400 → недоступна).
3. Сверка писем по скринам hh — тексты = store, quality ok.
4. Разбор: hunt-day **не** делает probe; `--questionnaire-auto` был on, вопросов в JSON не было до ручного probe.
5. Разбор CV: Биржа — план L2, форма sticky DevOps (дыра gate); Авангард — роутинг сразу devops.
6. **P0+P1** внедрены, тесты, док с откатом, коммит `99d3618`.
7. ПЕТЕР помечен skipped в `data-emil`.

### Уроки (уже в LEARNING-LOG)

| Срез | Суть |
|------|------|
| H/facility-obninsk | Сбер объекты / Обнинск |
| H/marksman-l1 | L1 + сутки 1/3 |
| H/letter-14y | «Более 14 лет» в лиде |
| H/resume-quiz-gate | sticky DevOps на support + virt→infra |

Доки уроков:  
[`SESSION-2026-07-18-sber-facility-obninsk.md`](SESSION-2026-07-18-sber-facility-obninsk.md) ·  
[`SESSION-2026-07-18-marksman-l1-schedule.md`](SESSION-2026-07-18-marksman-l1-schedule.md) ·  
[`SESSION-2026-07-18-resume-quiz-gate.md`](SESSION-2026-07-18-resume-quiz-gate.md)

---

## Известные остатки / риски

| ID | Статус | Заметка |
|----|--------|---------|
| СПБ Биржа `7761436b…` | отклик ok | CV на форме был **DevOps** (до P0); письмо L2-ок |
| Авангард `8fc35fd9…` | отклик ok | CV DevOps; после P1 план был бы **infra** |
| ПЕТЕР `b7009d6b…` / vac `134973403` | **недоступна** | не добирать |
| Экто `be3e9ffa…` | не ship | point-gate hrStack/ниша |
| **P2** | ⬜ | sticky DevOps при ideal **infra** на шаге анкеты — reload+sync (не в `99d3618`) |
| hunt-day prep | ⬜ | только письма; probe анкеты до ship — не врезан |

Смягчение «14+» в `me-letter-polish` / soften для support|infra в `cover-letter-prepare` — в дереве сессии; **не** обязательно в том же коммите, что gate — проверить `git status` при следующем ship.

---

## Ссылки hh (проверка)

| | URL |
|--|-----|
| ПЕТЕР (мёртвый) | https://hh.ru/vacancy/134973403 |
| СПБ Биржа | https://hh.ru/vacancy/133310607 |
| Авангард | https://hh.ru/vacancy/132626212 |

---

## Что писать агенту в новой вкладке

```
Читай docs/SESSION-2026-07-18-close.md и MASTER «Где мы».
Emil :3849. Live ship только: npm run devops:hunt-day:emil -- ship --mode=point --go …
Добор брака: 2 ушли (Биржа, Авангард); ПЕТЕР недоступен.
Resume quiz-gate P0+P1 в 99d3618; P2 sticky infra↔devops — бэклог.
Перед ship с анкетой: devops:probe-questionnaire --id= → savedAnswers.
Не предлагать mass apply / ослабить minus.
```

### Следующий разумный шаг (H)

1. `npm run devops:hunt-day:emil -- status`  
2. При новой волне — `s1-preflight` → plan dry-run → ship `--go --limit=1`  
3. Опционально: P2 sticky infra **или** probe в `hunt-day prep` — только по явной просьбе  
4. Не трогать уже ушедшие Биржа/Авангард без нужды (письмо ок)

---

## Проверки сессии

```powershell
npm run test:hh-resume-picker-cross-track
npm run test:resume-canon-split
# уже гоняли ✅
```

Откат gate: SESSION-2026-07-18-resume-quiz-gate → **Вариант B** (не полный revert, если в коммите соседние дельты).
