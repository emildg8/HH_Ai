# HT6.3 — запись резюме Анастасии на hh.ru

**Контур:** `:3850` · **трек по умолчанию:** `qa-lead` · **hash:** `401b1755…`

## Что делать дальше (коротко)

| Кто | Шаг |
|-----|-----|
| **Настя** | L3: OK на about ниже (~10 мин) |
| **Агент** | CV path ✅ 02.07 · `test:ht63-e2e-gate` → HT6.4 regen |
| **После CV** | regen писем tier A + batch-precheck |
| **Охота** | 2–3 отклика/день, qa-lead на lead/manual |

---

## Предусловия

- [x] `npm run test:me-qa-drafts-gate` — зелёный (ME)
- [x] `npm run test:recruiter-minute-scan-qa` — зелёный
- [x] L3 OK от Насти на тексты «О себе» ниже
- [ ] `npm run login:anastasia` — сессия hh живая
- [ ] Зарплата **250–280 net** в поле hh (не в about)

---

## Тексты «О себе» для L3 (qa-lead)

Ведущий специалист по тестированию / QA Lead · 8+ лет · банк и финтех.

Регрессионное тестирование и тест-дизайн: чек-листы, тест-кейсы, smoke и sanity, приоритизация рисков перед релизом. На проекте крупного банка (NDA) выстроила контур контроля качества релизов и регресса — доля дефектов на проде снизилась более чем на 90%.

Интеграционное и API-тестирование: Postman, Apache Kafka, PostgreSQL, Kibana — сквозные сценарии в расчётном контуре для юрлиц; критичные дефекты находят до выкладки.

QA Lead на релизах: Jira, отчётность для стейкхолдеров, координация с разработкой, аналитикой и поддержкой при локализации дефектов.

Функциональное и сквозное тестирование веб-сервисов; опыт запуска продуктов в финтехе.

Контакты, удалёнка, командировки, дежурства — **поля профиля hh**, не в «О себе» (как у DevOps-контура).

---

## Тексты «О себе» для L3 (aqa-ai-assist — второе резюме или смена трека)

AQA / Automation QA (AI-assisted) · сильная база manual и API QA · банк и финтех.

Manual и интеграционное тестирование: регрессия, Postman, Kafka, PostgreSQL, Kibana, Jira — коммерческий опыт в контуре крупного банка (NDA); дефекты на интеграциях ловлю до релиза.

Автоматизация с ИИ-инструментами: Cursor, LLM, copilot для генерации и сопровождения автотестов; pet-практика Playwright (2026) на реальных API-сценариях. Классический SDET-framework на C#/Java в проде не заявляю — честно разделяю коммерцию и pet.

Связка «ручной контур + автотесты там, где ускоряют релиз», а не ради покрытия ради покрытия.

Контакты, удалёнка, on-call — **поля профиля hh**, не в «О себе» (как у qa-lead).

---

## Шаги записи

### 1. Dry-run ✅ (02.07)

```powershell
npm run devops:apply-hunt-track-resume-qa:dry
```

### 2. Live — по частям ✅ (02.07, `verify-ok`)

```powershell
npm run devops:apply-hunt-track-resume-qa -- --about-only
npm run devops:apply-hunt-track-resume-qa -- --experience-only
npm run devops:apply-hunt-track-resume-qa -- --skills-only
```

Или полный оркестратор: `npm run devops:anastasia-ht63-profile` (about → experience → skills → conditions → verify).

### 3. Verify

Gate (offline snapshot + ME, без live hh):

```powershell
npm run test:ht63-e2e-gate
npm run test:me-qa-drafts-gate
```

Опционально — live re-scrape на hh:

```powershell
npm run scrape:anastasia:resume
```

### 4. HT6.4 — письма после CV

Только **qa-lead** (lead/manual QA titles), CV из снапшота `data-anastasia/resume-hh-snapshot/401b1755…`, не `CV/` Эмиля:

```powershell
npm run test:hunt-tracks-qa
npm run test:candidate-knowledge-pack-qa
npm run devops:regenerate-letters:anastasia -- --hunt-tracks=qa-lead --fresh-tier-a --limit=25
# если qa-lead пул пуст (кроме responded Индид) — senior-qa:
npm run devops:regenerate-letters:anastasia -- --hunt-tracks=senior-qa,aqa-ai-assist --fresh-tier-a --limit=10
npm run devops:batch-precheck:anastasia -- --hunt-tracks=qa-lead --fresh-tier-a
npm run devops:batch-precheck:anastasia -- --hunt-tracks=senior-qa,aqa-ai-assist --fresh-tier-a
```

Проверка фильтра: Pentest/SMM/DevOps в tier A не попадают в `--hunt-tracks=qa-lead`.

---

## HT7.1 — полный путь отклика (qa-lead, точечный)

**Эталон:** Индид · Technical QA Lead · `ebe3434c-b0ec-4488-b717-cc4c7beddb33` · vacancy `132799632`

### Этапы (порядок канона)

| # | Этап | Команда / где | Готово когда |
|---|------|---------------|--------------|
| 1 | Readiness | `npm run qa:readiness` | сессия hh, routing qa_lead, очередь tier A |
| 2 | Письмо approved | дашборд `:3850` или regen | `coverLetter.status=approved`, gate 10/10 |
| 3 | L4 preview | карточка → L4 | `resumeL4Preview`, без «Здравствуйте» в буллетах |
| 4 | Precheck | `npm run devops:batch-precheck:anastasia -- --id=…` | eligible, userApproved если СПб/стек |
| 5 | L4 на hh | `--tailor-resume` в apply | `hhApply.resumeL4.status=applied` |
| 6 | Форма отклика | Playwright мастер | резюме qa-lead выбрано, письмо в форме |
| 7 | Отправка + чат | тот же apply | `letterDelivered` или `chatSent` |
| 8 | Verify | `open-hh` + переписка | на hh виден отклик и текст письма |

### Команда точечного отклика (после precheck)

```powershell
node scripts/run-with-instance.mjs --instance=anastasia -- node scripts/hh-apply-chat-letter.mjs --id=ebe3434c-b0ec-4488-b717-cc4c7beddb33 --tailor-resume --stay-open
```

### Проверка вручную (Настя)

```powershell
node scripts/run-with-instance.mjs --instance=anastasia -- node scripts/open-hh-session.mjs --url=https://hh.ru/vacancy/132799632
```

На hh.ru: кнопка «Откликнуться» vs «Вы откликнулись»; резюме qa-lead — блок «О себе» и опыт #0 после L4; переписка с Индид — есть ли письмо.

### Известные сбои (02.07 — исправлено в коде)

**Кейс Индид (Technical QA Lead) — разбор:**

| # | Что случилось | Почему | Как не повторять |
|---|---------------|--------|------------------|
| 1 | Отклик без approved-письма в форме | Автоapply: L4 + submit, письмо в форму не попало; `already_applied` детект мешал | Apply truth: `letterInForm` + `verifyCoverLetterInForm` до `letterDelivered` |
| 2 | Карточка `letterDelivered: true`, в UI пусто | Слабый verify (слова в странице / draft в input) | `verifyCoverLetterDelivered` — probe 72 симв., без полей ввода |
| 3 | «Пусто» в списке откликов | Системная подпись «Без сопроводительного» ≠ пустой chatik; hh уже вложил excerpt из резюме | Перед repair — открыть **Чат** на вакансии (chatik), не только список |
| 4 | Два сообщения в чате | Repair отправил approved вторым пузырём, когда excerpt уже был | `chatHasOutgoingExcerptWithoutApproved` — запрет chat-fallback при дубле |
| 5 | Неверный UI-путь | `negotiations?vacancyId` → редирект на `/vacancy/`; кнопки «Добавить» vs «Приложить» | Доставка: vacancy → `ensureVacancyResponseChatOpen` → chatik |

**Команды repair (только после probe chatik):**

```powershell
npm run devops:deliver-letter-vacancy:anastasia -- --id=<uuid>
```

Скрипт: `probeChatikBeforeLetterRepair` → при `approvedInChatik` только синхронизация карточки; иначе repair → `assertLetterDeliveredOnHh` → `letterDelivered`.

- Ложный `already_applied` сразу после L4 → форма не открывалась, письмо не ушло. **Фикс:** сначала ждём форму, потом детект; при блоке — `finishRepeatApply` (чат).
- `hhDetectedOnly` без письма не должен убирать карточку из очереди. **Фикс:** prune только при `letterDelivered`.
- `npm run apply` на `/applicant` давал false negative. **Фикс:** проверка на `/applicant/resumes`.

### Если карточка «застряла» в responded без отклика

Сбросить `hhSiteState` / `responseSubmitted` / `queuePrunedAt`, вернуть `status: approved` (L4 и письмо сохранить). Спросить агента или восстановить через `updateVacancyRecord`.

---

## Чего не делать

- Mass apply до verify
- Отклик **aqa**-профилем на manual/lead-JD
- Запись всего CV одной командой без проверки между шагами

---

## Подпись ME

- [x] ME gate зелёный (`data-anastasia/logs/me-qa-ht63-gate-latest.json`)
- [x] L3 Настя OK
- [x] Verify scrape совпал с drafts (about 717, skills 7, experience index 0 NDA — 02.07)
- [x] E2E gate `test:ht63-e2e-gate` — snapshot vs qa-lead draft (`data-anastasia/logs/ht63-e2e-gate-latest.json`)
