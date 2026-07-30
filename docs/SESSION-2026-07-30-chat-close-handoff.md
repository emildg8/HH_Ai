# SESSION 2026-07-30 — закрытие чата (короткий указатель)

> **Полная выжимка всего чата 23–30.07 (не только хвост):**  
> [`SESSION-2026-07-23-to-07-30-FULL-CHAT-EXTRACT.md`](SESSION-2026-07-23-to-07-30-FULL-CHAT-EXTRACT.md)  
> **Сырые 342 запроса:** [`archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-USER-QUERIES-BY-DAY.md`](archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-USER-QUERIES-BY-DAY.md)

> **Транскрипт:** [`7d11e720-80da-4421-9d6e-eb6e46d20c0d`](7d11e720-80da-4421-9d6e-eb6e46d20c0d)  
> **Партнёр:** закрыл вкладку → продолжение в **новом чате**. Не переспрашивать фазу.

Ниже — только якоря хвоста 29–30. Всё остальное (23–28: Merlion, Devhunt, hirix, очередь, Настя, TG, ATS…) — в FULL extract.

Связанные срезы уже на диске (читать по задаче):

| Doc | О чём |
|-----|--------|
| [`SESSION-2026-07-29-retro.md`](SESSION-2026-07-29-retro.md) | Ретро: правила OK, ship хрупкий Magritte+sync+letters |
| [`SESSION-2026-07-29-ship-truth-close.md`](SESSION-2026-07-29-ship-truth-close.md) | Magritte clients, sync на `--go`, deliver timeout, infra framing |
| [`SESSION-2026-07-29-store-truth.md`](SESSION-2026-07-29-store-truth.md) | Chip/формат + declined status |
| [`SESSION-2026-07-29-data-vs-data-emil.md`](SESSION-2026-07-29-data-vs-data-emil.md) | Прогресс `data/` vs очередь `vacancies-devops.json` |
| [`AUDIT-2026-07-30-targeting-holes.md`](AUDIT-2026-07-30-targeting-holes.md) | Почему «здания» и авто-поддержка попали в ready |
| [`SESSION-2026-07-18-sber-facility-obninsk.md`](SESSION-2026-07-18-sber-facility-obninsk.md) | Источник facility-gate |

**Коммиты среза:** `44baa02` (ship-truth) · `60e67f9` (targeting + store-truth + hunt-day-assess).  
**Важно партнёру:** работа локальная; не объяснять сбои через «незакоммичено» — говорить цепочкой причин (формат → backfill → роль).

---

## Где мы (одна строка)

Слоты E живы (**Bell Integrator** тех **пн 3 авг 14:00 МСК**); store/targeting правды закрыты; live ship только `hunt-day:emil`; не шипать второй Merlion / Альфу без GO.

---

## Хронология хвоста чата (29→30.07)

### 1. Отказы и harvest-пути
- **МиАТел** — разбор по канону decline: класс `role_mismatch_k8s_spb_hybrid_go_plus` (A/H/C).
- Путаница **`data/` vs `data-emil`:** silent harvest писал прогресс в `data/`; очередь Emil = `data/vacancies-devops.json` (канон dual-path). Фикс silent → `run-with-instance` emil. Док: `SESSION-2026-07-29-data-vs-data-emil.md`.
- Ночной мусор (+1354, `skippedTitle:0`) — не слать вслепую.

### 2. Ship-волна (партнёр)
- **Не шипать** второй Merlion (явный запрет).
- Тройка к ship: **Код Безопасности · Плати по миру · МИР ВЕНДИНГА** ( Magritte/already ломали first-pass до ship-truth).
- **Альфа** — разобрать; потом store врал (офис vs гибрид, pending vs отказ) → store-truth; **не авто-ship** офис Москва без GO.

### 3. Ретро → план ship-truth A–E → сделано
См. `SESSION-2026-07-29-retro.md` + `SESSION-2026-07-29-ship-truth-close.md`.  
Эффект: clients default / formBannerIgnored · sync обязателен на `--go` · deliver ~90с · infra framing · harvest warn на `skippedTitle=0`.

### 4. Store-truth
Chip «на месте» без verify ≠ офис; JD-гибрид снимает thin chip; sync отказ → `status=declined`; CLI `devops:repair-store-truth(:emil)` · backfill chip shortlist ≥50 закрыт.

### 5. Bell Integrator — слот E
| Поле | Значение |
|------|----------|
| Vacancy | `135444621` · https://hh.ru/vacancy/135444621 |
| Card id | `b452c494-3802-498c-bd99-fb9faa1c3e71` |
| Статус | `real_hr_invite` / `hhSiteState=invited` |
| Слот | **2026-08-03 14:00 МСК** (`interviewSlot` 2026-08-03T11:00:00.000Z) |
| Кейс | `my/emil/Интервью/cases/bell-integrator-tech-20260803/` (+ копия `…-b452c494/`) |
| Prep | сценарий · `rehearsal-p5.md` · `live.md` · `copilot-day-t.md` · Swarm/GitFlic cards |
| Банк карт | `docker-swarm`, `gitflic-ci` (+ sync data-emil); early-hook Swarm vs squash в `lib/interview-knowledge-cards.mjs` |
| Ссылка на звонок | **ещё нет** → партнёр: `вставь ссылку Bell в слот: <URL>` |
| Сигнал партнёра | `P5 Bell сделал` |

### 6. Пул без ship (30.07, снимок)
Gate devops/infra/l2l3 ~148 · remote/hybrid ~116 · ≥70 remote/hybrid ~41 · approved письмо ~13 · офис ≥70 ~18 · hunt-day plan fresh-tier-A: **15 ready / 25 candidates**.

### 7. Targeting-дыры → латка → срез `60e67f9`
1. Facility «эксплуатации зданий»: `\w` ≠ кириллица → DevOps title + backfill chip → ready. Фикс `[а-яё]*` + хаус/недвижим; голый «инженер по эксплуатации» ≠ DevOps без IT-якоря.
2. Авто-поддержка (Правокард): `консультант.*поддерж` → l2l3. Фикс early-exit автомобиль/автовладел/КАСКО + TITLE_NOISE.
3. В срез также вошли store-truth libs + **`lib/hunt-day-assess.mjs`** (раньше жил только на диске).

---

## Что изменено / добавлено (код)

| Область | Файлы / команды |
|---------|-----------------|
| Facility / ADAS / авто | `lib/role-classify.mjs` · `lib/vacancy-targeting.mjs` · `scripts/test-vacancy-targeting.mjs` |
| Hunt assess noise | `lib/hunt-day-assess.mjs` · `scripts/test-hunt-day-assess.mjs` |
| Store format/status | `lib/work-format-truth.mjs` · `lib/work-format-inference.mjs` · `lib/vacancy-work-format.mjs` · `lib/hh-negotiations-sync.mjs` · `config/work-format-policy.json` |
| CLI | `devops:repair-store-truth(:emil)` · `devops:backfill-work-format(:emil)` · `test:store-truth` |
| Ship-truth | `lib/hh-resume-visibility.mjs` · `lib/apply-ship-outcome.mjs` · `lib/hunt-day-orchestrator.mjs` · `lib/spawn-deliver-letter-vacancy.mjs` · `lib/letter-framing-router.mjs` · harvest silent/nightly |
| Уроки | `docs/LEARNING-LOG.md` (facility-\w · auto-support · store-truth · ship-truth · data-dir · decline) |

---

## Удаления / откаты / запреты

### Удалено агентом в хвосте (осознанно)

| Что | Когда | Кто | Почему |
|-----|-------|-----|--------|
| `scripts/_tmp-fix-escalir*.mjs` (временные патчеры `\w`) | 30.07 | агент Cursor | одноразовые; после правки `role-classify` не нужны |
| Дублирующие tmp-фиксеры facility | 30.07 | агент | то же |

### Помечено на удаление в working tree — **не** часть коммита `60e67f9`

| Что | Статус | Кто/когда | Почему / что делать |
|-----|--------|-----------|---------------------|
| `.cursor/rules/synergy-interview-prep.mdc` | `D` на диске, в HEAD ещё есть | не зафиксировано решение в хвосте 29–30 | Старое правило prep **Синергия** (`my/Синергия/**`). **Не коммитить удаление и не восстанавливать** без явной просьбы партнёра в новом чате |

### Не «удалили», но вывели из охоты / запретили

| Объект | Действие | Кто | Почему |
|--------|----------|-----|--------|
| Второй Merlion | **не шипать** | партнёр 29.07 | явный запрет |
| АльфаСтрахование | `declined` / без авто-ship офис | sync + store-truth + партнёр | отказ на hh; формат/статус раньше врали |
| МиАТел | архив по decline-классу | агент + канон | K8s + СПб гибрид + Go plus |
| Facility / хаус / авто-поддержка | off-target в assess | агент 30.07 | ложный DevOps/L2 |
| Mass apply / ослабление minus | запрет каноном | domain-truth | без изменений |

### Откат срезов (если понадобится)

- Ship-truth: §откат в `SESSION-2026-07-29-ship-truth-close.md`
- Store-truth: §откат в `SESSION-2026-07-29-store-truth.md`
- Targeting: `git revert 60e67f9` (или точечно `role-classify` + `vacancy-targeting`) → `npm run test:targeting`

---

## Итоги сессии (для партнёра)

### Что сделано для вас
1. Правда в карточках: формат и отказ больше не врут после sync/backfill.
2. Ложный Magritte «уже отклик» не стопит, если резюме уже видно.
3. Мусор «здания / хаус / авто-линия» вырезан из ready.
4. Bell: слот + кейс prep + суфлёр Swarm/GitFlic; ждём ссылку и ваш `P5`.
5. Ретро и ревизия дыр записаны — новый чат не начинает с нуля.

### Что проверено
`test:ship-truth` · `test:store-truth` · `test:targeting` · `test:hunt-day-assess` · `test-role-reject-learn` (хвост 30.07).

### Что не доказано
- Живой plan/ship **после** facility/auto фикса на актуальной очереди.
- Ссылка на звонок Bell и факт, что P5 партнёр отрепетировал.
- Полный chip backfill вне shortlist ≥50 (~1300 тонких chip не гоняли).

### Не трогать в новом чате без просьбы
- Live ship в обход `hunt-day`
- Второй Merlion / Альфа без GO
- Убивать весь Chrome
- Ослаблять minus на apply
- Коммитить весь грязный working tree (там много чужого незакоммиченного)

---

## Фраза агенту (скопировать в новый чат)

```
Читай docs/SESSION-2026-07-23-to-07-30-FULL-CHAT-EXTRACT.md
(при споре «что говорили» — RAW в docs/archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-*).
Bell: 2026-08-03 14:00 МСК, vacancy 135444621 / b452c494 — ссылки на звонок ещё нет.
Не шипать второй Merlion; Альфа declined; live только hunt-day:emil -- ship --go.
Не объяснять через git. Дальше: [твоя задача].
```
