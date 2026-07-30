# ПОЛНАЯ ВЫЖИМКА ЧАТА 23–30.07.2026

> **Транскрипт:** [`7d11e720-80da-4421-9d6e-eb6e46d20c0d`](7d11e720-80da-4421-9d6e-eb6e46d20c0d)  
> **Запросов партнёра извлечено:** **342** (23.07 → 30.07)  
> **Сырой дамп (все тексты запросов по дням):** [`archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-USER-QUERIES-BY-DAY.md`](archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-USER-QUERIES-BY-DAY.md)  
> **JSON:** [`archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-USER-QUERIES.json`](archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-USER-QUERIES.json)  
> **Хвост-закрытие (короткий):** [`SESSION-2026-07-30-chat-close-handoff.md`](SESSION-2026-07-30-chat-close-handoff.md)

Этот файл — **кураторская выжимка всего чата**, не только 29–30. Сырой дамп не сокращать; здесь — смысл, итоги, запреты, удаления, артефакты.

---

## Объём по дням

| Дата | Запросов | Главные темы |
|------|----------|--------------|
| 23.07 | 10 | Старт после day-close · квота откликов · OOM Cursor · harvest |
| 24.07 | 25 | Merlion + Devhunt · TronaSOC/KCS · боты в чате · harvest |
| 25.07 | 58 | Отклики · письма/LLM cascade · Настя · P0 point-apply · chat-ai |
| 26.07 | 88 | hirix prep · Proxmox/Ansible · TG-капча · ночной harvest · **битая очередь** · sync в hunt-day |
| 27.07 | 76 | hirix собес+дебриф · TG фото · Настя funnel · письма · GitHub scan · SIMaster отказ |
| 28.07 | 33 | Двойная волна Emil+Настя · sales-miss · Аквариус · Setka ATS · лишние прогоны · пауза |
| 29.07 | 40 | Новые башни · отказы МиАТел · data vs data-emil · ретро · ship-truth · store-truth · Bell |
| 30.07 | 11 | Ready-счёт · facility-дыры · ревизия · фиксация · закрытие чата |

**Темы (эвристика по тексту):** apply ~72 · harvest ~49 · Настя ~55 · interview ~30 · retro/plan ~30 · decline ~20 · captcha/TG ~14 · letters ~12 · queue-integrity ~9.

---

## Сквозные запреты и решения партнёра

| Когда | Решение | Статус |
|-------|---------|--------|
| 24.07 | Не начинать ботов в чате до сигнала; капчу **скрыть**, ввод после собеса | разовый ops |
| 26.07 | Убрать старый ночной таск → повесить **harvest на ночь** | сделано (nightly) |
| 26.07 | Идея ослабить minus helpdesk/crypto — **обсуждение**; канон domain-truth: **не ослаблять** без явной просьбы позже | не ослабляли |
| 28.07 | Офис Москва/МО в chat-ai → согласие+warn; вне → отказ | канон `hh-chat-ai` |
| 28.07 вечер | **Пауза** на сегодня | соблюдено |
| 29.07 | Второй Merlion: «жду решения по другой» → **не шипать**; шип тройки + разбор Альфы | в handoff |
| 29.07 | «Программа врёт» → store-truth обязательно | `60e67f9` |
| 30.07 | Не объяснять через git — локальная цепочка причин | LEARNING-LOG |
| 30.07 | Закрыть чат → полный extract + новый чат | этот файл |

---

## Удаления / замены / откаты

| Что | Когда | Кто | Почему |
|-----|-------|-----|--------|
| Старый Scheduled Task (не harvest) | 26.07 | агент по просьбе «убери тот и повесь харвест на ночь» | заменён nightly harvest |
| Временные `scripts/_tmp-fix-escalir*.mjs` | 30.07 | агент | одноразовые патчеры `\w` |
| Временный `_tmp-extract-chat-*.mjs` | 30.07 (после extract) | агент | утилита извлечения |
| `.cursor/rules/synergy-interview-prep.mdc` | working tree `D` | **не решено в чате** | старое правило Синергия; **не коммитить удаление без просьбы** |
| Letter-repair hang на already | 29.07 | агент убил процесс | spawn без submit; потом timeout в ship-truth |
| Ложный Magritte → «уже отклик» mapping | 29.07 | код ship-truth | не удаление файла — смена outcome |
| Mass-apply как north star | весь чат | канон | не возвращали |
| Ослабление minus helpdesk/crypto | 26.07 предложение | **отклонено практикой/каноном** | domain-truth |

**Откат срезов кода:** см. `SESSION-2026-07-29-ship-truth-close` · `SESSION-2026-07-29-store-truth` · `git revert 60e67f9` / `44baa02`.

---

## День за днём — что делали / изменили / итог

### 23.07 (чт) — старт хвоста

**Запросы:** читать day-close · Merlion 14:00 + Devhunt 16:00 + hirix пн · квота откликов · CV на hh · OOM Cursor · статус harvest · «зачем повторяем harvest».

**Сделано / артефакты:**
- Вход: [`SESSION-2026-07-23-day-close-handoff.md`](SESSION-2026-07-23-day-close-handoff.md)
- Работа с откликами после harvest; черновик CV vs live hh (партнёр уточнял)
- Cursor OOM → обновление с оф. сайта

**Урок:** не путать «harvest уже был» с «нужен scoring/resume» / повторным прогоном.

---

### 24.07 (пт) — два собеса + продукт + боты

**Запросы:** статус · боты после harvest · Merlion суфлёр · «не начинай ботов / скрой капчу» · Bandicam Merlion · Devhunt prep · видео Devhunt · TronaSOC docs · Kaspersky Container Security · большой список задач на уход · проверка ответов ботам (оффтоп/дубли).

**Сделано / артефакты:**
- Prep/суфлёр Merlion LiteManager; разбор видео Merlion + Devhunt
- Изучение TronaSOC / docs.tronasoc.ru / KCS под prep
- Канон **hh-chat-ai** (вместо one-shot bots-four): wave/audit/letter/queue · правило `hh-chat-ai.mdc` · LEARNING-LOG 23–24.07
- Harvest watchdog / статусы по запросу

**Итог дня:** два live контакта (Merlion + Devhunt); чат-боты на hh вынесены в канон; partner злился на оффтоп ответов.

---

### 25.07 (сб) — письма, P0 point-apply, Настя, chat-ai after-ship

**Запросы (много):** отклики · лестница LLM не работает · повторить Насте · INFOWATCH false-positive · ППК Proxmox в chat · ретро only= на declined · квоты треков.

**Сделано (по LEARNING-LOG + чат):**
- **Letter cascade:** `buildLetterCascadeChildEnv` — DS Lab / Ollama / CUSTOM не сносить друг друга
- **Point-apply P0:** soft/hard site-preflight · deficit quota pick · `test:point-apply-p0` · [`PLAN-POINT-APPLY-P0-2026-07-25.md`](PLAN-POINT-APPLY-P0-2026-07-25.md)
- **Apply truth:** INFOWATCH banner + letter-repair → false-positive already; outcome/exits
- **hh-chat-ai after-ship:** wait + auto process; темы proxmox/clickhouse
- Подтягивание функционала Emil → профиль Насти (письма)

**Итог:** инфраструктура точечного отклика укреплена; письма/каскад починены.

---

### 26.07 (вс) — hirix prep, TG-капча, ночь, **битая очередь**, sync

**Запросы:** prep hirix · Proxmox/Ansible по-русски · 1 док prep + 1 live · печать · сценарий 3-м файлом · TG: картинка→код, не любой текст · «врёшь про капчу» · ночной таск → harvest · топ для откликов · «почему в hunt-day уже откликнутые» → план Sync+память · Cursor crash · **2× битый JSON очереди** → fix+restore.

**Сделано:**
- Пакет prep hirix (prep / live / сценарий / печать) + Ansible/Proxmox/Linux
- TG captcha: только `/captcha` или reply на фото; `applied` ≠ captcha cleared
- Nightly harvest вместо старого таска
- Hunt-day: sync + память already applied (план внедрён)
- **Queue atomic write v2** + snapshots + recover + `HH_HARVEST_REUSE_URLS` · SCENARIOS №90 · то же для Anastasia позже
- QA prefs изоляция (не писать PDF Эмиля на QA; квоты; 1С)

**Итог:** критичный P0 по целостности очереди; hirix готов к пн; капча-дисциплина.

---

### 27.07 (пн) — hirix live, дебриф, Настя funnel, письма, GitHub

**Запросы:** капча без фото в TG · прокси из D:\Dev bots · hirix 12:00 prep+суфлёр · Bandicam дебриф · план доработок · оценка vs другие собесы · отказы+Bell чат · видео для дыр · GitHub hh-репы → план → внедрить · письма топ-8 без браузера · Настя ship пока Emil harvest · Task Scheduler старый путь · «почему мало вариантов у Насти» · must vs nice Python · manual/senior freeze · SIMaster отказ · Озон формат · СОГАЗ remote в письме · Сравни letter.

**Сделано:**
- hirix P7: pitch якорь Softline/Proxmox · Ansible STAR · stage=hr · [`PLAN-HIRIX-P7-FOLLOWUP-2026-07-27.md`](PLAN-HIRIX-P7-FOLLOWUP-2026-07-27.md)
- TG photo: compress/JPEG · Worker JSON · Clash proxy path
- Настя: funnel (must/nice, tracks auto_with_approval, fresh 14д, hybridMoscowOnly, live workFormat)
- QA letter gates (floor/clone/CV-dump)
- Letter remote claims · Сравни anti-applicationese
- SIMaster debrief: LLM на проекте
- Post-harvest todo: [`SESSION-2026-07-27-post-harvest-todo.md`](SESSION-2026-07-27-post-harvest-todo.md)
- Scheduler path → `D:\Dev\apps\hh-ai`

**Итог:** сильный день E (hirix) + большой MC/письма/капча слой.

---

### 28.07 (вт) — волна откликов, мимо роли, ATS, пауза

**Запросы:** догнать письма обоим · 1+6 Настя / 1+9 Emil · Playwright login · Аквариус мимо · Google Form Настя · почему долго · BetBoom/Т-Банк sales · Setka пост → что брать/не брать · лишние прогоны · пауза.

**Сделано:**
- Sales-miss fix (AM≠TAM, исполнитель по продаж)
- Lead DevOps `\p{L}` boundaries
- force-only → point-gate
- hintOnly phantom · gaming captcha stale
- Аквариус OFF_PROFILE telecom-hardware
- Setka → `ATS-RESUME-SIGNALS` (§брали / §не брали)
- no-extra-runs: skip repair on archived; plan→probe→ship
- hh-chat-format office МСК/МО

**Итог:** волна с браком (sales) поймана и закрыта правилами; день закончен паузой.

---

### 29.07 (ср) — Новые башни, МиАТел, ретро, ship/store-truth, Bell

**Запросы:** Newtowers PDF+видео · follow-up тексты Merlion/Мария/Анастасия · отказы · чей harvest · пометить классы · Bandicam Новые башни + опросник · МиАТел+data-emil · второй Merlion? · тройка ship + Альфа · ретро · одни и те же ошибки · план ship-truth · «программа врёт» · chip backfill · Bell приглашение · prep Bell P5+Swarm.

**Сделано / docs:**
- Кейс Новые башни (prep/docs)
- Decline: МиАТел `role_mismatch_k8s_spb_hybrid_go_plus` · СберTech `archive_autoscreen`
- [`SESSION-2026-07-29-data-vs-data-emil.md`](SESSION-2026-07-29-data-vs-data-emil.md)
- [`SESSION-2026-07-29-retro.md`](SESSION-2026-07-29-retro.md)
- [`SESSION-2026-07-29-ship-truth-close.md`](SESSION-2026-07-29-ship-truth-close.md) · commit `44baa02`
- [`SESSION-2026-07-29-store-truth.md`](SESSION-2026-07-29-store-truth.md)
- Bell: слот E 03.08 14:00 · кейс `my/emil/Интервью/cases/bell-integrator-tech-20260803/`
- Chip backfill shortlist ≥50

**Итог:** главная продуктовая правда (ship+store) + новый слот E Bell.

---

### 30.07 (чт) — ready, дыры targeting, фиксация, закрытие

**Запросы:** сколько подходящих · почему здания в ready · глубокая ревизия · закомить · «при чём git» · цепочка формат→дыра · залатать · закрыть чат с **полным** сохранением.

**Сделано:**
- [`AUDIT-2026-07-30-targeting-holes.md`](AUDIT-2026-07-30-targeting-holes.md)
- Facility `\w` + авто-поддержка (Правокард)
- Commit `60e67f9` targeting+store-truth+hunt-day-assess
- Commit `1109b21` docs close (частичный) → **дополнен этим FULL extract**
- MASTER «Где мы» · SESSION-INDEX · agent-context

---

## Коммиты этого чата (релевантные срезы)

| SHA | Смысл |
|-----|--------|
| `44baa02` | ship-truth Magritte/sync/deliver/framing + retro/data docs |
| `60e67f9` | facility/auto + store-truth + hunt-day-assess |
| `1109b21` | docs close handoff + MASTER (до FULL extract) |

На диске остаётся **большой грязный working tree** вне этих срезов — в новый чат **не** коммитить оптом.

---

## Слоты E / собесы за чат

| Когда | Компания / роль | Артефакт |
|-------|-----------------|----------|
| 24.07 14:00 | Merlion LiteManager | видео + сценарий; follow-up Елене 29.07; ответ ждали пн |
| 24.07 16:00 | Devhunt HR 134841282 | видео + TronaSOC/KCS prep |
| 27.07 12:00 | hirix SRE/Linux | Bandicam дебриф · P7 follow-up |
| 29.07 | Новые башни HR | Bandicam + опросник |
| 27.07 | SIMaster (Настя) | отказ после 3 этапов (LLM) |
| **03.08 14:00** | **Bell Integrator** тех | vac `135444621` · id `b452c494-…` · ссылка звонка **нет** |

---

## Карта «где уже лежит» (не дублировать с нуля)

| Тема | Doc / путь |
|------|------------|
| Старт 23.07 | `SESSION-2026-07-23-day-close-handoff.md` |
| Post-harvest 27.07 | `SESSION-2026-07-27-post-harvest-todo.md` |
| Rетро / ship / store / data 29.07 | `SESSION-2026-07-29-*.md` |
| Targeting holes 30.07 | `AUDIT-2026-07-30-targeting-holes.md` |
| Короткий close | `SESSION-2026-07-30-chat-close-handoff.md` |
| Уроки построчно | `LEARNING-LOG.md` строки 23–30.07 |
| Сырые 342 запроса | `docs/archive/.../CHAT-7d11e720-RAW-*` |
| Bell кейс | `my/emil/Интервью/cases/bell-integrator-tech-20260803/` |

---

## Итог всего чата (23→30) одной страницей

**Для партнёра:** прошли неделю охоты с живыми собесами (Merlion, Devhunt, hirix, Новые башни) и слотом Bell на 3 авг; починили письма/каскад, капчу TG, битые очереди, funnel Насти, sales-дыры, правду Magritte/формата/отказов и targeting «здания/авто»; ретро показало: канон ок, first-pass ship ещё хрупкий.

**Для агента в новом чате:** читать **этот файл** + сырой RAW при споре «что говорили»; не второй Merlion; Альфа declined; live только `hunt-day:emil`; Bell — ссылка+P5; не git-лекция.

**Фраза:**

```
Читай docs/SESSION-2026-07-23-to-07-30-FULL-CHAT-EXTRACT.md
(и при необходимости RAW в docs/archive/2026-07-session-handoffs/CHAT-7d11e720-RAW-*).
MASTER «Где мы» актуален на 30.07. Дальше: [задача].
```
