# SESSION 2026-07-02 — Анастасия QA: HT6.3 + HT7.1 Индид + Apply Truth

> **Контур:** `:3850` · `data-anastasia/` · qa-lead · **не смешивать** с Эмилем `:3849`

---

## Сводка сессии (ME-взгляд)

| Цель | Итог |
|------|------|
| HT6.3 — qa-lead на hh | ✅ live: about L3 (717), experience, skills 7/7, conditions 265k, `verify-ok` |
| HT7.1 — Индид Technical QA Lead | ⚠️ отклик есть; **два сообщения** в chatik (excerpt резюме + approved repair) |
| Apply truth — письмо | ✅ канон в коде: probe → verify → `letterDelivered`; фикс wiring `verifiedInChat` |
| North star E | ⬜ ждём ответ HR по Индид |

---

## Что сделано (код)

### HT6.3 QA resume

- `scripts/devops-apply-hunt-track-resume-qa.mjs` — `--conditions-only`, verify salary в full verify
- `scripts/devops-anastasia-ht63-profile.mjs` — оркестратор (about → experience → skills → conditions → verify)
- `lib/hunt-track-resume-drafts-qa.mjs` — `buildConditionsPayloadForQaTrack`
- `npm run devops:anastasia-ht63-profile` — live `verify-ok` 02.07

### HT7.1 Индид (`ebe3434c…`, vacancy `132799632`)

- Фиксы детекта `already_applied` / L4 / prune / `finishRepeatApply`
- `lib/hh-chat-selectors.mjs` — chatik, «Приложить сопроводительное», `deliverCoverLetterPostApply`
- `lib/cover-letter-deliver-truth.mjs` — **канон repair:** probe → assert → карточка
- `scripts/devops-deliver-letter-vacancy.mjs` — repair с live verify
- Approved-письмо доставлено в chatik (~23:29); **дубль** с excerpt резюме hh (~22:01)

### Apply truth (общий)

- `verifyCoverLetterDelivered` — probe 72 симв., без textarea
- `chatHasOutgoingExcerptWithoutApproved` — блок дубля в chat-fallback
- `resolveLetterDeliveryOutcome` — `chatSent` alone ≠ delivered
- `hh-apply-chat-letter.mjs` — `verifiedInChat ||= chatStepOk` (фикс ложного exit 7)

### Тесты

- `test:devops-apply-hunt-track-resume-qa`
- `test:cover-letter-deliver-guards` + `test:cover-letter-deliver-truth`
- `test:apply-l4-observability` (обновлён)

### Документация

- `docs/ANASTASIA-HT63-APPLY-RUNBOOK.md` — кейс Индид, таблица сбоев
- `docs/LEARNING-LOG.md` — строки 02.07 apply/chatik
- `.cursor/rules/apply-truth-video.mdc` — letterDelivered gate

---

## Уроки (паттерны для агента)

1. **Три поверхности hh:** список «Без сопроводительного» ≠ chatik iframe ≠ вкладка «Чат» на `/vacancy/{id}`.
2. **Repair:** `probeChatikBeforeLetterRepair` → только потом `deliverCoverLetterPostApply` → `assertLetterDeliveredOnHh`.
3. **`letterDelivered` на карточке** — только после live verify; не доверять `chatSent` / текст в input.
4. **Дубль в чат:** если excerpt резюме уже в chatik — не слать approved вторым сообщением (`CHAT_DUPLICATE_BLOCKED`).
5. **Индид:** больше ничего не отправлять; ждать HR.

---

## Дыры / незавершёнка

| # | Пробел | Приоритет |
|---|--------|-----------|
| 1 | HT6.3: ЗП runbook «250–280» vs код **265k** — согласовать | P2 |
| 2 | HT6.3: `login:anastasia` в runbook `[ ]` | P2 |
| 3 | HT6.4: regen + batch-precheck qa-lead — **senior-qa regen 4/4 DS Lab** 03.07; qa-lead пул пуст (Индид responded) | ✅ partial |
| 4 | `hh-apply-chat-letter` finishRepeatApply — на `deliverCoverLetterPostApply` | ✅ 03.07 |
| 5 | Skill `hh-ru-apply-workflow` — нет chatik-канона | P2 |
| 6 | Log-golden / video для vacancy `132799632` | P2 |
| 7 | Изменения **не в git** — commit по явной просьбе | P1 |
| 8 | Второе резюме senior-qa / aqa на hh | P3 |

---

## План работ (следующая сессия)

### P0 — не трогать Индид

Ждать HR. При вопросе — «первое системное из резюме, второе уточнённое сопроводительное».

### P1 — унификация apply + commit

1. `finishRepeatApply` → `deliverCoverLetterPostApply` + `cover-letter-deliver-truth`
2. Commit среза: apply truth + HT6.3 QA + Индид repair
3. `npm run test:apply-l4-observability` + `test:cover-letter-deliver-*` + `test:hunt-track-resume-apply-qa`

### P2 — HT6.4 + инфра Насти

1. `devops:regenerate-letters:anastasia` + `devops:batch-precheck:anastasia`
2. Сверка ЗП на hh с runbook
3. Обновить skill `hh-ru-apply-workflow` (chatik probe)

### HT6.4 senior-qa (03.07 продолжение)

- **4 письма approved** (letterScore10 10/10 auto-gate)
- **ME regen + patch** 554b976c, f56b50db — убраны GitLab CI / Python SDET claims
- **Precheck:** 0 ready — TRUE GAP стек (Docker/K8s/GitLab CI) vs inventory; **не auto apply**
- **qa-lead пул:** пуст (Индид responded, freeze)
- **Вердикт ME:** senior-qa tier A — ждать harvest или ручной `userApproved` на 48f582c1 (ТАУ) после согласования

---

## Команды-якоря

```powershell
npm run devops:anastasia-ht63-profile:dry
npm run devops:anastasia-ht63-profile
npm run devops:deliver-letter-vacancy:anastasia -- --id=ebe3434c-b0ec-4488-b717-cc4c7beddb33
npm run test:cover-letter-deliver-guards
npm run qa:readiness
```

---

## Фраза агенту

«Анастасия :3850: HT6.3 verify-ok; Индид responded + 2 msg в chatik — не слать ещё; P1 — unify apply repair + commit; читай SESSION-2026-07-02-anastasia-apply-handoff.md»
