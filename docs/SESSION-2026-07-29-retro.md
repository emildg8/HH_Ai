# SESSION 2026-07-29 — ретро: правила, функции, стабильность

> Сравнение с [`SESSION-2026-07-16-full-retrospective.md`](archive/2026-07-session-handoffs/SESSION-2026-07-16-full-retrospective.md), аудитом [`SESSION-MONTH-AUDIT-2026-06-13-to-07-15.md`](SESSION-MONTH-AUDIT-2026-06-13-to-07-15.md), ретро-фиксами [`SESSION-2026-07-20-retro-fixes.md`](SESSION-2026-07-20-retro-fixes.md).

**Проверки 29.07:** `test:hygiene` ✅ · `test:point-apply-p0` ✅ · **`test:ship-truth`** ✅ · закрытие среза [`SESSION-2026-07-29-ship-truth-close.md`](SESSION-2026-07-29-ship-truth-close.md) (откат внутри).

---

## Вердикт одной строкой

**Архитектура и правила — в порядке и зрелее, чем 16.07. Живой first-pass отклик — всё ещё хрупкий на границе Magritte/hh.** Проект не «разваливается»; узкое место — операционная стабильность ship, не отсутствие канона.

---

## Сравнение с прошлыми ретро

| Ось | 16.07 (полная) | 15.07 (месяц) | 20.07 (фиксы) | **29.07 (сейчас)** |
|-----|----------------|---------------|---------------|---------------------|
| Зрелость цепочки | зрелая | pivot mass→point ✅ | gate/visibility усилены | **то же + hunt-day как единственный live вход** |
| North star E | **E=0** | E=0 | — | **сдвинулось:** live собесы / next_step (Новые башни и др.); KPI E не «закрыт», но уже не ноль активности |
| Главный совет | 7–14 дней point, не фичи | качество CV/письма | Magritte руками | **тот же совет верен**; фичи не нужны |
| Magritte visibility | lead office руками | — | `false_positive_already` доказан; partner «ок» ≠ форма | **тот же блокер убил ship сегодня** (Код Безопасности, МИР ВЕНДИНГА) |
| Apply truth | naked/дубли риск | first-pass P0 | fingerprint/sticky | mapping skip→«уже отклик» при visibility — **шум в outcome** |
| Очередь / data | MC hardcode `data/` | P2 | — | **dual-path:** очередь Emil = `data/vacancies-devops.json`, прогресс silent → `data/` без instance (**починен silent**) |
| Письма | KEEP M0 | шаблоны / DS Lab | wave fingerprint | quality/JD-hook/min-len **часто режут ship** (Плати, Альфа) |
| Harvest | KEEP-light | HT.1 ⬜ | — | ночь +1354 с `skippedTitle:0` → **мусор в живой очереди** |
| Правила агента | каноны есть, шум SESSION | — | — | **сильные** (hunt-day, domain-truth, playbook); иногда **перестраховывают** (outcome labels) |

**Круги 16.07 — статус 29.07**

| Цикл 16.07 | Сейчас |
|------------|--------|
| CV ↔ письма | частично разорван (канон CV есть); письма всё ещё daily friction |
| Apply bug ↔ повторный ship | **жив:** Magritte + already_applied без sync + letter-repair hang |
| Harvest ↔ «расширить DevOps» | правилом закрыт; но silent без instance → грязный объём |
| Copilot vs охота | держится: I-track не съел день 29.07 |

---

## Правила — всё ли в порядке?

| Слой | Оценка | Комментарий |
|------|--------|-------------|
| Domain truth / no mass apply | ✅ | Не размывается |
| Live только `hunt-day` | ✅ | Соблюдается; обходы запрещены |
| One apply-lane | ✅ | Работает |
| Decline / prep маршруты | ✅ | МиАТел разобран по канону |
| Visibility → outcome | ⚠️ | `false_positive_already` → UI «уже отклик / повтор» — **врёт партнёру** |
| Assess go без live sync | ⚠️ | «Плати по миру» был go, на hh уже applied |
| Dual `HH_DATA_DIR` vs `HH_VACANCIES_QUEUE_FILE` | ⚠️ | Документировано, но легко снова спутать |
| MASTER «Где мы» | ⚠️ | Дата 25.07; снимок агента 28.07 — **чуть отстаёт** от живой охоты 29.07 |

**Итог по правилам:** канон правильный; дыры — в **честности сигналов** (outcome, sync, пути данных), не в «забыли правило».

---

## Функции — стабильность

| Функция | Стабильность | Доказательство 29.07 |
|---------|--------------|----------------------|
| Hygiene / docs links | ✅ | `test:hygiene` OK |
| Point-apply P0 тесты | ✅ | `test:point-apply-p0` OK |
| S1 preflight | ✅ | закрыт |
| Hunt-day plan/assess | ✅ код / ⚠️ выборка | go включает мусор titles + already_applied |
| Hunt-day live ship | ⚠️ | 0/3 новых ok; blockers Magritte + already |
| Letter quality gate | ⚠️ intentionally strict | блокирует слабые письма; ломает infra framing (Альфа) |
| Letter repair на already | ❌ hang | spawn deliver без submit — убит вручную |
| Harvest watchdog silent | 🔧→✅ | фикс instance; статус Emil ещё «27.07» |
| Multi-profile isolation | ✅ | QA отдельно |
| Prep / interview route | ✅ | Новые башни кейс отработан |

**Оценка стабильности (субъективно, для партнёра):**

| Контур | Балл /10 | Смысл |
|--------|----------|--------|
| Код + тесты + docs hygiene | **8** | Регресс ловится; канон не гниёт |
| Правила / агентский контур | **8** | Дисциплина hunt-day сильная |
| Ops (harvest/paths/status) | **5** | Dual-path + junk night + stale status |
| Live apply first-pass | **4** | Magritte + sync + letter gates |
| Продуктовый north star (E→F) | **5→6** | Лучше 16.07 (есть собесы/next_step), не закрыто |

**Общая стабильность продукта как системы охоты: ~6/10** — «управляемо хрупко»: правила держат, hh UI и ops-края ломают день.

---

## Что в порядке / что чинить (приоритет)

### Не трогать (KEEP)
- North star E, не mass apply  
- Minus на apply  
- Hunt-day как единственный live ship  
- Decline-review маршрут  
- MC изоляция  

### P0 на стабильность ship (не новые фичи)
1. **Magritte clients** — ручная сверка DevOps + Системный инженер; автоскрипт не закрывает форму  
2. **Outcome honesty** — `false_positive_already` ≠ «уже отклик»  
3. **Assess/ship только после sync** (или probe) перед волной — ловить already_applied  
4. **Не spawn letter-repair** на already без GO / timeout  

### P1 ops
5. Night harvest: алерт `skippedTitle===0` при большом urlsTotal  
6. Позже: миграция очереди Emil под `data-emil/` одной операцией  
7. Обновить MASTER «Где мы» под живую охоту + Magritte как активный блокер  

### Не сейчас (как 16.07)
- HI.1 API harvest, UI S3+, public/Desktop, массовый Telegram  

---

## Фраза агенту

Ретро 29.07: правила/канон OK; ship хрупкий на Magritte+sync+letters. Сравни с 16.07 — инфра лучше, E-активность выше, тот же Magritte. Не фичи — visibility руками → sync → ship 1–2 с probe.
