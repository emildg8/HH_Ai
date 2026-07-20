# SESSION 2026-07-20 — регрессия писем: разбор, план, тесты

**Статус:** L1 внедрён в код (20.07) · тесты `test:letter-l1-quality` ✅  
**Связано:** [`SESSION-2026-07-20-letter-quality-fix.md`](SESSION-2026-07-20-letter-quality-fix.md) · [`LETTER-FRAMING-ROUTER.md`](LETTER-FRAMING-ROUTER.md) · [`HUNT-APPLY-AUTOMATION-PLAN.md`](HUNT-APPLY-AUTOMATION-PLAN.md) · [`SESSION-2026-07-20-pain-wave1.md`](SESSION-2026-07-20-pain-wave1.md)

---

## Сводка

За 17–20.07 конвейер стал **безопаснее** (gates, wave, hygiene, sticky), но **первый контакт с HR ухудшился**: gate «есть цифра» ≠ mid DevOps; анти-каскад решали укорочением; L0 без framing router дал язык L2.  
Цель этого документа: зафиксировать **что меняли → ожидали → получили**, риски плана, влияние, и как L1+тесты не дают повторить ту же дыру.

---

## 1. Что меняли → ожидали → получили

| # | Изменение | Ожидали | Получили | Влияние на HR / north star |
|---|-----------|---------|----------|----------------------------|
| 1 | **17.07** peer stretch (−15% / +15% партнёры) в каноне писем | Разнообразие метрик ближе к рынку | LLM чаще вставляет −15% в волну | Среднее: каскад «одинаковых» писем |
| 2 | **18.07** quiz-gate / sticky / virt→infra | Меньше wrong-resume | Механика ship стабильна; письма не трогали | Нейтрально / плюс к apply |
| 3 | **19.07** ME: visibility abort, point-wave fingerprint, sticky до title-ok | Не уйдёт false-ok / каскад IT_One | Gates ловят **форму**; смысл для HR не проверяют | Плюс безопасность; минус ложное «письмо ок» |
| 4 | **19.07** apply-quality: `--force` не обходит letter quality | Жёстче контроль | Контроль формальный | Нейтрально |
| 5 | **20.07** pain-wave1: hygiene 6800→1290, UI «к отклику», ротация metrics | Меньше шума; разные метрики; быстрый ship | UI ~81 «к отклику»; ready plan ~1/16; старые письма с −15%/IT_One | UX+; конверсия не выросла |
| 6 | **20.07** P0 automation: `--only` без prepare; no repair declined | Точечный ship без порчи лестницы | Работает как задумано | Плюс процесс |
| 7 | **20.07 L0** junior-ban, min 320, pet sanitize, greeting | Не пропустит junior/телеграмму | Короткие L2-tone всё ещё «цифровые»; hotfix → язык эксплуатации | **Ухудшение тона** до framing router |
| 8 | **20.07** framing router + edit 5 на hh | DevOps-opening, не L2 | Исправлено **после** ship (3 раунда) | Реактивно; первый взгляд HR уже испорчен |
| 9 | **20.07** SLA Softline 78→93; SLA не lead в DevOps | Честный канон; DevOps без тикетного KPI | Канон ок; DevOps safe без SLA lead | Плюс позиционирование |
| 10 | Infra regen LLM → overqual (14+/7000+) | Сильное infra-письмо | Gate спас; ETGP уже applied → edit | Среднее: лишний edit |

### Живые отклики 20.07 (факт ухудшения)

| Компания | Len | Gate | HR-вердикт дня | Корневая причина |
|----------|----:|------|----------------|------------------|
| Каспер IDP | 386 | pass | слабо | Привет / −15% / практикуюсь |
| МАГНИТ Vault | 357 | pass | **эталон** | крючок Vault + коммерческий факт |
| Рестрим | 245 | pass | слабо | укорочение + L2 (MSSQL) |
| ДОМ.РФ | 264 | pass | слабо | укорочение + pet-обрезка |
| Сбер | 288 | pass | слабо | учебные стенды / мало SberTech |

---

## 2. Корневые причины (не симптомы)

1. **Метрика успеха в коде ≠ метрика партнёра** — pass/exit 0 vs «звучит как middle DevOps на Vault».  
2. **`letterHasCandidateMetric` = любая цифра** — «2+ сервиса» проходит.  
3. **Анти-каскад волны** чинили **укорочением**, а не regen с M0/framing.  
4. **L0 без framing** → безопасный L2-язык (инциденты/Zabbix).  
5. **Ship до ME-глаза** на банк/Сбер.  
6. **«К отклику» ≠ shipReady** — ложное ощущение готовности пула.

---

## 3. Влияние ухудшений (оценка)

| Область | Тяжесть | Почему |
|---------|---------|--------|
| Первый текст в chatik у HR | **Высокая** | North star E; слабый opening не чинится тестами после sent |
| Доверие к gate «письмо ок» | **Высокая** | Партнёр ship'ит, полагаясь на pass |
| Темп охоты (ok/день) | Низкая | 5 ok ушли; квоты не сорваны |
| Очередь / UX дашборда | Плюс | Hygiene + toApply — реальный выигрыш |
| Visibility / WE-ON | Средняя | Блокер среды; не регрессия писем, но режет shortlist |

**Итог влияния плана L1:** снижает риск повтора слабого opening **до** ship; не обещает рост E за сутки (это конверсия рынка).

---

## 4. План изменений L1 (исполнение)

| # | Что | Где | DoD |
|---|-----|-----|-----|
| L1.1 | JD-hook soft-fail: в opening (1–2 предл.) маркер из title/category | `letter-framing-router` + `letter-batch-gate` | Vault/IDP/ЕФО без крючка → fail batch/point |
| L1.2 | Уже: DB-first ban (MSSQL в opening) | `letter-mid-quality` | регресс-тест |
| L1.3 | Wave-aware метрики **без укорочения**: avoid MTTR15/IT_One по волне; inject только расширяет | `basket-letter` + `letter-wave-fingerprint` | тест: волна с −15% → новый текст без −15% и len≥исходного |
| L1.4 | Golden эталон МАГНИТ + анти-кейсы (Рестрим L2, junior Каспер) | `letter-quality-golden-set.json` + L1 test | `test:letter-l1-quality` exit 0 |
| L1.5 | Fallback `composeDevopsFramedLetter` при fail L2-tone / mid в basket finalize | `basket-letter.mjs` | unit: L2-ish → framed pass |
| L1.6 | Weak-volume metric: «N+ сервисов» без коммерческого факта → fail batch | `letter-mid-quality` + batch gate | тест |

**Не в этом срезе:** ME pre-ship UI; mass regen всей очереди; ship WE-ON/Флант; правка CV на hh.

---

## 5. Риски и нюансы

| Риск | Нюанс | Мера | Откат |
|------|-------|------|-------|
| JD-hook слишком жёсткий | Title «DevOps» без Vault → generic category | soft only на batch; generic требует CI/автоматизац в opening | `HH_LETTER_JD_HOOK=0` |
| Strong/weak metric false fail | Дата «2026» ≠ метрика | годы 20xx не считаются сильной метрикой | `HH_LETTER_ALLOW_WEAK_VOLUME=1` |
| Wave-aware ломает regen | inject после «Здравствуйте» удлиняет письмо | **запрет truncate**; только prepend/replace фразы той же длины | `HH_LETTER_FORCE_MTTR15=1` (legacy) |
| Fallback шаблонный | Все framed похожи | fallback только при fail gate; LLM first | без fallback в env `HH_LETTER_NO_FRAMED_FALLBACK=1` |
| Golden раздувает CI | длинные тексты | 2–3 кейса mid | — |
| Shortlist «к отклику» | партнёр ship'ит старые письма | prep --with-probe + L1 gate на ship | ритуал в HUNT-DAY |

### Допущения и риски

- Предполагаем: партнёр принимает soft JD-hook и mid-floor на point/batch, не на всех unit-фикстурах `assessLetterQuality`.  
- Может пойти не так: часть шаблонов day-mode уйдёт в framed fallback чаще — смотреть долю `template:` / `composeDevopsFramedLetter` в логах.  
- Запасной вариант: только L1.4 golden + L1.5 fallback, без JD-hook hard.

---

## 6. Как дальнейшие изменения лягут на результат

```text
                    ┌── L1.1 JD-hook ──┐
 prep / regen ──────┤ L1.3 wave-aware ├──► batch/point gate ──► ship
                    └── L1.5 fallback ─┘         │
                                                 ▼
                                          HR opening mid DevOps
                                                 │
                              (не обещаем E за день; обещаем не слабый L2)
```

| Следующий шаг после L1 | Эффект |
|------------------------|--------|
| L2 ME checklist в prep JSON | меньше «глаз после ship» |
| Wave-aware в LLM prompt (не только inject) | меньше regen-loop |
| Не ship без `assessLetterQualityForBatch` | закрывает обход через старый approvedText |
| Visibility form-verify на целевой vac | отдельно от писем |

**Правило:** любое новое «анти-каскад» / ban-слово **не имеет права укорачивать** approved letter — только replace/regen с floor ≥320.

---

## 7. Слой тестов (анти-регрессия)

| Тест | Ловит ухудшение |
|------|-----------------|
| `test:letter-l1-quality` | нет JD-hook; weak N+; wave без укорочения; МАГНИТ pass; Рестрим L2 fail; framed fallback |
| `test:letter-framing-router` | L2-tone / compose |
| `test:letter-mid-quality` | junior / greeting / min 320 |
| `test:letter-wave-fingerprint` | каскад −15% / IT_One |
| `test:letter-quality-golden` | эталон МАГНИТ в наборе |

Smoke ≠ E2E на hh.ru.

---

## 8. Чеклист приёмки

### Агент
1. L1.1–L1.6 в коде или отложено с причиной.  
2. `npm run test:letter-l1-quality` и `npm run test:letters` (или подмножество letter-*) exit 0.  
3. Документ + LEARNING-LOG + MASTER next step.  
4. Откат env одной строкой (таблица §5).

### Партнёр (~5 мин)
1. Образец Vault/МАГНИТ ≥320, с крючком, без «учебн*».  
2. Волны дня: второе письмо без −15%, если первое уже с −15%.  
3. Вердикт: **принято** / **только soft** / **откат**.

---

## Фраза агенту

`Выполни L1 из docs/SESSION-2026-07-20-letter-regression-plan.md (JD-hook, wave-aware без укорочения, weak-volume, framed fallback, golden МАГНИТ); тесты test:letter-l1-quality; коммит по просьбе.`
