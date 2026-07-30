# Индекс сессий HH Ai — июль 2026

> **Канон «где мы сейчас»:** только [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md) блок «Где мы». Этот файл — **история**, не next step.

**Зачем:** хронология H / MC / P за первую половину июля — без деталей суфлёра (I-track), bandicam и CABLE.

---

## Линия месяца (одним взглядом)

| Период | Фокус | Итог |
|--------|-------|------|
| 02.07 | MC изоляция + HT.7.3 | `test:mc-all-isolation` ✅ · TAM `auto_with_approval` · Trinity apply ✅ |
| 02–03.07 | QA lane apply | HT6.3 verify-ok · Индид · IBS · Kandinsky GigaRecruiter · отказ ГНИВЦ |
| 05–06.07 | Harvest + корзины | watchdog без focus-steal ✅ · Анастасия **1124** в очереди · 4 корзины P0 |
| 08.07 | developerLane + волна откликов | квоты 6/день (3/1/1) ✅ · **6+** откликов · E **0** |
| 13–14.07 | Apply chain + day-v5 | постмортем параллельных чатов · ship 5/5 с письмами ✅ |
| 15.07 | Корзины + робот | anti-pattern L2-волны · AYA + Робот-рекрутер MVP · sanitize/edit-канон |

---

## Хронология сессий (H / MC / P)

| Дата | Транскрипт | Тема | Сделано | Docs | Не доказано |
|------|------------|------|---------|------|-------------|
| 30.07 | [7d11e720](7d11e720-80da-4421-9d6e-eb6e46d20c0d) | **FULL extract чата 23–30** + targeting/Bell | 342 запроса в RAW · кураторская выжимка по дням · facility/auto · `60e67f9` | [`SESSION-2026-07-23-to-07-30-FULL-CHAT-EXTRACT.md`](SESSION-2026-07-23-to-07-30-FULL-CHAT-EXTRACT.md) · RAW archive · [`SESSION-2026-07-30-chat-close-handoff.md`](SESSION-2026-07-30-chat-close-handoff.md) | live plan после фикса; ссылка Bell |
| 29.07 | [7d11e720](7d11e720-80da-4421-9d6e-eb6e46d20c0d) | **Ship-truth** — Magritte/outcome/sync/letters | formBannerIgnored · ship --go sync · deliver 90с · infra framing · harvest warn · `test:ship-truth` | [`SESSION-2026-07-29-ship-truth-close.md`](SESSION-2026-07-29-ship-truth-close.md) · retro · data-vs-data-emil · store-truth | live ship после фикса |
| 02.07 | — | **MC изоляция** — фазы 1–3 | data/M0/copilot paths per instance; `test:mc-all-isolation` ✅; HT6.3 snapshot gate | [`SESSION-2026-07-02-mc-isolation-close.md`](SESSION-2026-07-02-mc-isolation-close.md) | HT6.3 live L4 QA; ~29 hardcode `data/` |
| 02.07 | — | **HT.7.3 TAM** + Trinity chat | `tam` → `auto_with_approval`; chatik fix; Trinity TAM apply ✅; Arenadata reject | [`SESSION-2026-07-02-ht73-tam-trinity-chat.md`](SESSION-2026-07-02-ht73-tam-trinity-chat.md) | nudge ЦФТ (→ 04.07) |
| 02.07 | — | **Анастасия QA** — HT6.3 + Индид | qa-lead verify-ok; Индид apply + repair письма; apply-truth wiring | [`SESSION-2026-07-02-anastasia-apply-handoff.md`](SESSION-2026-07-02-anastasia-apply-handoff.md) | слот E по Индид |
| 03.07 | — | **IBS Manual QA Lead** | отклик ✅; анкета 2/3; отказ HR 15 мин | [`SESSION-2026-07-03-ibs-apply-lessons.md`](SESSION-2026-07-03-ibs-apply-lessons.md) | полная анкета (годы управления) |
| 03.07 | — | **Kandinsky GigaRecruiter** | 11 вопросов бота ✅; ждём живого HR | [`SESSION-2026-07-03-kandinsky-gigarecruiter.md`](SESSION-2026-07-03-kandinsky-gigarecruiter.md) | слот E |
| 03.07 | — | **Отказ ГНИВЦ СПОТ** | техэтап ✅ → отказ; охота QA 3–5/день | [`SESSION-2026-07-03-gnivc-rejection.md`](SESSION-2026-07-03-gnivc-rejection.md) | — |
| 05.07 | — | **Harvest stability** (game mode) | watchdog silent; headless harvest без focus-steal | [`SESSION-2026-07-05-gaming-harvest-handoff.md`](SESSION-2026-07-05-gaming-harvest-handoff.md) | — |
| 06.07 | — | **Анастасия harvest + корзины** | +1018 → **1124**; triage; 4 корзины applyReady (Sber/Selecty/М.Видео/IT-Thematic) | [`SESSION-2026-07-06-anastasia-harvest-close.md`](SESSION-2026-07-06-anastasia-harvest-close.md) | E2E apply в сессии |
| 06.07 | — | **Реферал Иннотех** | карточка manual_link; PDF DevOps; письмо знакомого | [`SESSION-2026-07-06-innotech-referral-handoff.md`](SESSION-2026-07-06-innotech-referral-handoff.md) | отправка знакомым; ответ HR |
| 08.07 | — | **developerLane ME review** | pet→стартап-практика; корзина B; квоты 3/1/1; commercial-hand −18 sort | [`SESSION-2026-07-08-developer-lane-me-review.md`](SESSION-2026-07-08-developer-lane-me-review.md) | — |
| 08.07 | — | **План охоты Эмиль P0–P3** | baseline + digest; verify 4 CV; ME GO/FIX/NO-GO | [`SESSION-2026-07-08-emil-hunt-plan.md`](SESSION-2026-07-08-emil-hunt-plan.md) | E через 2–3 нед |
| 08.07 | — | **H-track handoff** — волна 08.07 | **6+** откликов; Production IT ложный лид; отказы Т-Банк/Мультифактор/L2 | [`SESSION-2026-07-08-hunt-session-handoff.md`](SESSION-2026-07-08-hunt-session-handoff.md) | nudge (→ пятница); слот E |
| 13.07 | [1a5611cf](1a5611cf-acc6-4ffd-a6a7-9008ea0c64e7) · [276c5c5c](276c5c5c-da31-4bca-890a-e483eba99137) | **Параллельные apply** — постмортем | правило «один apply-lane»; SCENARIOS №83; repair 4/4 Настя | [`SESSION-2026-07-13-parallel-apply-postmortem.md`](SESSION-2026-07-13-parallel-apply-postmortem.md) | стабильный first-pass без repair |
| 14.07 | — | **Emil H-track** — day-v5 + Манжерок | 5/5 ship+письма; `vacancy-response-letter-submit`; разбор отказов | [`SESSION-2026-07-14-emil-apply-handoff.md`](SESSION-2026-07-14-emil-apply-handoff.md) | day-v6 на hh ещё не ship |
| 15.07 | — | **Anti-pattern L2-волны** | STOP first-pass ради объёма; канон корзины A1–A7 | [`SESSION-2026-07-15-wave-l2-anti-pattern.md`](SESSION-2026-07-15-wave-l2-anti-pattern.md) | чистый L2 pack как у devops |
| 15.07 | — | **AYA + Робот-рекрутер** | ship day-v7; Q1 склейка → P0–P4 robot canon | [`SESSION-2026-07-15-aya-robot-recruiter.md`](SESSION-2026-07-15-aya-robot-recruiter.md) | robot watch E2E |
| 15.07 | — | **Письма + репетиция Насти** | edit-канон; Simplenight ok; sanitize highload/on-prem | [`SESSION-2026-07-15-letter-edit-anastasia-rehearsal.md`](SESSION-2026-07-15-letter-edit-anastasia-rehearsal.md) | полный L3 тон без партнёра |
| 19.07 | — | **Закрытие вкладки TG** | HR push + captcha 1A/1B + NPS; 1B off; handoff | [`SESSION-2026-07-19-close.md`](SESSION-2026-07-19-close.md) | коммит по просьбе |
| 19.07 | — | **TG captcha 1A/1B + HR unread close** | фото капчи; solve под флагом; per-profile chat id; NPS filter | [`SESSION-2026-07-19-tg-captcha-hr-close.md`](SESSION-2026-07-19-tg-captcha-hr-close.md) · [`TG-CAPTCHA-HR-PUSH.md`](TG-CAPTCHA-HR-PUSH.md) | live text-captcha solve на hh |
| 19.07 | — | **HR → Telegram unread** | push вопросов после sync-chats; авто-seed; SCENARIOS №86; откат env | [`SESSION-2026-07-19-tg-hr-unread-push.md`](SESSION-2026-07-19-tg-hr-unread-push.md) · [`TG-CAPTCHA-HR-PUSH.md`](TG-CAPTCHA-HR-PUSH.md) | live TG на стенде; капча 1A/1B |
| 17.07 | [f171ecf8](f171ecf8-0589-4ebf-8aeb-a442b7dac56f) | **Harvest + point-apply + Плати робот** | Emil +368 · l2l3 auto · pace ~8–10 · letter-dup/chat false-OK fix · Плати Q&A | [`SESSION-2026-07-17-point-apply-handoff.md`](SESSION-2026-07-17-point-apply-handoff.md) | L2 visibility · continue apply-point-ready |
| 16.07 | [f171ecf8](f171ecf8-0589-4ebf-8aeb-a442b7dac56f) | **CV-wave + полная ретро** | about/опыт ×5 · IT_One склейка · start=2023 edit · портфель KEEP/ARCHIVE | [`SESSION-2026-07-16-full-retrospective.md`](SESSION-2026-07-16-full-retrospective.md) · canvas | view verify (login) · lead office руками |

### Вне этого индекса (I-track / суфлёр)

Закрытие I-track 02.07, bandicam-сессии 03–07.07, CABLE pilot 13.07, live Zoom remediation 12.07 — см. COPILOT-ROADMAP и соответствующие `SESSION-2026-07-*-copilot*` / `*-bandicam*`.

---

## Разрывы контекста — закрыты

| Было | Стало |
|------|-------|
| HT.7.2 «только manual l2l3/tam» в `.mdc` | HT.7.2/7.3 ✅ — auto с `userApproved` ([`AGENT-DOMAIN-TRUTH.md`](AGENT-DOMAIN-TRUTH.md)) |
| Два чата Cursor → голые отклики | [`SESSION-2026-07-13-parallel-apply-postmortem.md`](SESSION-2026-07-13-parallel-apply-postmortem.md) · один lane |
| L2 «как попало» после исчерпания DevOps | [`SESSION-2026-07-15-wave-l2-anti-pattern.md`](SESSION-2026-07-15-wave-l2-anti-pattern.md) |

---

*Обновление: 16.07.2026 — CV-wave + ретро · месячный аудит → [`SESSION-MONTH-AUDIT-2026-06-13-to-07-15.md`](SESSION-MONTH-AUDIT-2026-06-13-to-07-15.md).*
