# Стабильная цепочка: harvest → отклик → слот E

> **North star:** слот E · точечные отклики 2–5/день · не mass apply.  
> **Канон маршрута корзины:** [`HUNT-BASKET-ROUTE.md`](HUNT-BASKET-ROUTE.md) · **постмортем 13.07:** [`SESSION-2026-07-13-parallel-apply-postmortem.md`](SESSION-2026-07-13-parallel-apply-postmortem.md) · SCENARIOS **№83**.  
> **Обновлено:** 14.07.2026 (анкеты + анти-naked)

---

## DoD успешной корзины (e2e)

Корзина / один id в волне считается **ok** (first-pass), только если все пункты истинны:

1. На hh.ru есть отклик («Вы откликнулись» / negotiation).
2. Сопроводительное **доставлено** (форма или пузырь chatik) — `letterDelivered` после **live verify**, не текст в открытом composer.
3. Нужное резюме выбрано (или шаг анкеты, где резюме уже выбрано).
4. Анкета работодателя (если есть поля): все обязательные ответы в DOM до submit; для **lead** — все `savedAnswers` (см. § Анкета).
5. Итог в `*-pack-ship-summary.json`: `status: "ok"` **без** `repaired: true`.

**Не ok:**

| Статус | Смысл | Действие |
|--------|--------|----------|
| `fail` + `letter_missing` / empty resume / submit disabled / lead-gate / **`questionnaire_incomplete` (radio)** | Submit не жмём | Swap / probe / руками в дашборде |
| `fail` / `verify_fail` — HTTP 200 без verify на карточке | Сеть сказала ok, страница вакансии всё ещё «Откликнуться» | Не считать отклик; exit `8` / `applySubmitUnverified` |
| `naked` | Отклик на hh есть, письма нет | **Сбой first-pass** · repair только аварийно · цель ≈0 |
| `partial` | Анкета pending / letter-repair не verify | Ручной дожим или swap |
| `ok` + `repaired` | Спасли голый | Условно; не цель волны |

---

## Голый отклик → ≈0 (не «repair как норма»)

Auto-repair **вреден как основной путь:** HR уже видит «Без сопроводительного»; риск чипов hh, старого текста, ложного `letterDelivered`, дубля пузыря.

**Сначала prevention (код):**

1. `letterInForm` только после `verifyCoverLetterInForm` (не partial на vacancy_response).
2. После N fill → exit `9` / `letter_missing`, **не** submit.
3. Перед финальным кликом анкеты — re-check письма **и** radio (`questionnaire_incomplete` / `unfilled-radios`); клик по варианту без verify checked ≠ успех (Magritte без `name`).
4. Пустой список резюме / submit disabled → exit `9`, не крутить до `already_applied`.
5. HTTP 200 формы **без** `verifyHhApplyRegisteredOnVacancy` → exit `8` / `verify_fail`, не ok.
6. Один apply-lane (№83).
7. Ship без авто-repair (`--no-letter-repair` / hunt-day `ship --go`).

**Repair (`spawn-deliver-letter-vacancy` ×1)** — только если отклик уже ушёл (гонка / старый голый). Не считать first-pass успехом.

---

## Анкета работодателя (пункт 4 DoD)

### Типы полей на hh (что умеет код)

| Тип | DOM | Авто-fill сегодня |
|-----|-----|-------------------|
| `textarea` / contenteditable | текст ответа | да — `savedAnswers` / CV / LLM |
| `text` | короткий input | да — в т.ч. короткое число «2» (годы) |
| `radio` | группа вариантов | да — choice heuristics + saved |
| `checkbox` | варианты | fill есть, extract слабый |
| `select` | выпадающий | да, редко в выборке |
| External test | вопрос с URL теста | нет — нужен URL результата руками |
| hintOnly | «есть вопросы» без полей | нет — ждать поля / Marksman |

Контейнеры: Magritte fieldset, popup / `applicant/vacancy_response`. Не анкета: сопроводительное, radio резюме, капча.

### Какие вопросы бывают (кластеры)

| Кластер | Примеры | Авто сейчас |
|---------|---------|-------------|
| ЗП / вилка | «ожидания на руки» | да — saved / CV-заглушка (лучше ME вилка) |
| Формат | удалёнка / гибрид / офис | да — radio; **не** авто-«да» на office |
| Опыт лет / грейд | «N лет», шкала 1–5 | radio + short text («2») |
| Lead / команда | IBS «годы управления» | lead-gate стоп, пока DOM неполный |
| Стек / skill lists | *nix, CI/CD, мониторинг (Gear) | да — списки из CV |
| Behavioral / coding | «первые действия», compress | да — special-answers |
| Локация / Telegram / ТК–ИП | radio + text | частично |
| Неинтересные домены | букмекер/крипта (Maxima) | да — text из ME |
| Внешний тест | ссылка в label | руками |

Эталоны: IBS `2c884c04` · Holyweb/Maxima в `vacancies-devops.json` · [`SESSION-2026-07-03-ibs-apply-lessons.md`](SESSION-2026-07-03-ibs-apply-lessons.md).

### Lead-gate (когда «все savedAnswers в DOM»)

Включается если (env не `HH_QUESTIONNAIRE_REQUIRE_ALL=0`):

- title ~ QA Lead / Manual QA / Technical QA, **или**
- label ~ «управление командой» / «в годах».

Стоп, если `filled < saved` или `filledOnPage < visibleOnPage`. Иначе — обычный partial-audit (`unfilled-radios`, empty textareas).

### Уже автоматизировать сейчас

```
probe-questionnaire → savedAnswers в карточке → HH_QUESTIONNAIRE_AUTO=1 / --questionnaire-auto
→ pack-ship
```

- Текст + radio (+ select) при живом probe и ответах в дашборде.
- CV-fallback для стека / EN / гражданства / skill-lists.
- Choice: формат работы, грейд, «есть опыт?».

### Разобрать → потом автоматизировать

| Пробел | Почему важно | Статус |
|--------|--------------|--------|
| Короткие числа («2» годы) | Lead-анкета IBS | ✅ `questionnaireFieldValueMatchesAnswer` + topic `lead_years` |
| ME-draft ≠ live probe | Ложные ответы | ✅ validate + Anastasia pack-ship skip без `probedAt` |
| Checkbox extract | недобор вариантов | ✅ `groupNamedChoiceInputs` + fill `input[type=checkbox]` · `test:questionnaire-checkbox` |
| External test URL | блок submit | бэклог · ME / skip |
| hintOnly → поля позже | Marksman | ✅ re-probe + abort `hintOnly_timeout` · `questionnaire-hint-reprobe.mjs` |
| Office yes | отказ Консалт Плюс | ✅ `office-answer-guard` · нет авто-office в choice/robot |
| Журнал анкет волны | нет единого списка | ✅ скелет `apply-wave-digest` · `lib/apply-wave-digest.mjs` |

---

## Классы исхода (кратко)

| Класс | Успех? |
|-------|--------|
| First-pass e2e (письмо+анкета) | Да — цель |
| ok + repaired | Условный, разбор причины naked |
| naked без prevention | Нет — баг процесса |
| Wizard / letter_missing / lead-gate | Нет — fail до клика |
| HR refuse после ok | Процесс ок |

---

## Обязательный порядок

### Emil (`:3849`)

```bash
npm run devops:s1-preflight
npm run devops:emil-draft-pack -- --size=5 --write
npm run devops:emil-build-baskets -- --pack=<id>
npm run devops:emil-baskets-validate -- --pack=<id> --strict
# при анкете: probe-questionnaire --id=… → savedAnswers
npm run devops:emil-pack-ship:dry -- --pack=<id>
npm run devops:emil-pack-ship -- --only=<uuid8>
```

**Дубли (№85):** повторный ship на уже откликнутую вакансию → SKIP (`already_applied_guard`).  
«Отклик другим резюме» без снятия старого чата = **два** отклика на hh. Сначала снять лишний тред руками.

Cross-track → pre-submit `wrong_resume`, отправка запрещена:

- **Альтуэра (16.07):** `Рук. поддержки` / L2 при ideal devops\|infra\|tam.
- **Биржа (18.07):** DevOps (tech CV) при ideal support\|support_lead\|tam — на шаге анкеты симметричный STOP (`questionnaireStepResumeBlocksSubmit`).  
  Док/откат: [`SESSION-2026-07-18-resume-quiz-gate.md`](SESSION-2026-07-18-resume-quiz-gate.md).  
  virt/VMware → plan infra; devops↔infra на quiz пока совместимы (P2: reload sticky).

### Анастасия (`:3850`)

```bash
npm run devops:anastasia-build-day-baskets
# QA lead: probe + savedAnswers до ship
npm run devops:anastasia-pack-ship -- --only=<uuid8>
```

**1 apply-lane:** не параллелить Emil + Anastasia; не править selectors mid-run.

---

## Что делает ship (контракт)

1. `patchFromBasket` → store.
2. `hh-apply-chat-letter` (+ questionnaire-auto).
3. **Pre-submit:** empty resume / submit disabled / lead / **letter_missing** → exit `9`.
4. Классификация (`lib/apply-ship-outcome.mjs`).
5. Если всё же `naked` (легаси/гонка) → один spawn repair → `ok`+`repaired` или `partial` — **разбор**, не норма.

---

## Живой smoke (1 корзина)

```bash
npm run devops:emil-pack-ship -- --only=<id>
```

Проверено 14.07: unit + dry; живой submit — только новый ME pack.

---

## После отклика: Робот-рекрутер (chatik)

Не путать с формой-анкетой. Канон **P0–P4** (send-truth, шаблоны, freeze, repair, watchdog): [`docs/ROBOT-RECRUITER.md`](ROBOT-RECRUITER.md).

```bash
npm run devops:robot-recruiter-reply:emil -- --id=<uuid> --dry-run
npm run devops:robot-recruiter-reply:emil -- --id=<uuid> --send --go
npm run devops:robot-recruiter-watch:emil -- --limit=15 --notify
```

Урок AYA 15.07: [`SESSION-2026-07-15-aya-robot-recruiter.md`](SESSION-2026-07-15-aya-robot-recruiter.md).

---

## Связанные файлы

| Файл | Роль |
|------|------|
| `lib/apply-presubmit-guard.mjs` | empty / disabled / lead / **letter_missing** |
| `lib/hh-employer-questionnaire.mjs` | detect + fill DOM |
| `lib/hh-questionnaire-auto.mjs` | оркестратор AUTO |
| `lib/questionnaire-lead-gate.mjs` | lead DOM complete |
| `lib/questionnaire-choice.mjs` | radio/checkbox heuristics |
| `lib/apply-ship-outcome.mjs` | ok / naked / partial / fail |
| `lib/basket-ship-wave.mjs` | apply → classify → emergency repair×1 |
| `lib/apply-wave-digest.mjs` | сводка ok/partial/fail/naked/repaired/q400 волны |
| `lib/robot-recruiter.mjs` | Робот-рекрутер P0–P4: classify + gate + freeze |
| `lib/robot-recruiter-send.mjs` | send-truth |
| `lib/robot-recruiter-repair.mjs` | правка исходящего |
| `docs/ROBOT-RECRUITER.md` | канон chatik ≠ форма |
| `docs/SESSION-2026-07-03-ibs-apply-lessons.md` | эталон дыр анкеты |
