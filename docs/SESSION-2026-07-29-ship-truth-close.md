# SESSION 2026-07-29 — закрытие среза ship-truth

> Ретро: [`SESSION-2026-07-29-retro.md`](SESSION-2026-07-29-retro.md) · data/paths: [`SESSION-2026-07-29-data-vs-data-emil.md`](SESSION-2026-07-29-data-vs-data-emil.md) · канон дня: [`HUNT-DAY-ORCHESTRATOR.md`](HUNT-DAY-ORCHESTRATOR.md)

**Цель среза:** разорвать петлю «те же ошибки на отклике» без ритуала «ещё раз кликни видимость».

---

## Что сделано (эффект)

| # | Для партнёра | Где в коде |
|---|--------------|-----------|
| 1 | Если резюме уже видно работодателям — ложный баннер Magritte **не стопит** отклик и **не** пишется как «уже отклик» | `lib/hh-resume-visibility.mjs` · `decideClientsFormBannerPolicy` · `lib/apply-ship-outcome.mjs` |
| 2 | Live `ship --go` **обязан** обновить переговоры; `--no-sync` запрещён (отладка: `--force-no-sync`) | `lib/hunt-day-orchestrator.mjs` · `scripts/devops-hunt-day.mjs` |
| 3 | Досылка письма в чат не висит вечно (~90 с, `HH_DELIVER_LETTER_TIMEOUT_MS`) | `lib/spawn-deliver-letter-vacancy.mjs` |
| 4 | Письма infra/syseng: L2-opening gate только для devops; после падения LLM — шаблон `composeDevopsFramedLetter` | `lib/letter-framing-router.mjs` · `lib/cover-letter-openrouter.mjs` |
| 5 | Ночной harvest: warn если много URL и `skippedTitle=0` | `scripts/harvest.mjs` |
| 6 | Silent nightly → всегда `run-with-instance` (emil) | `scripts/run-harvest-watchdog-bg.mjs` · nightly/install ps1 |
| 7 | АльфаСтрахование: письмо approved без LLM (офис Москва — без авто-ship при requireRemote) | очередь Emil |

---

## Проверки

```powershell
npm run test:ship-truth
npm run test:apply-ship-outcome
npm run test:letter-framing-router
npm run test:hunt-day-plan
npm run test:point-apply-p0
```

---

## План отката

### Быстрый (env, без git)

| Симптом | Откат |
|---------|--------|
| Слишком много откликов при реальном блоке видимости | `$env:HH_RESUME_VISIBILITY_PREFLIGHT='0'` — выключить preflight **или** `$env:HH_RESUME_VISIBILITY_FORM_SKIP='1'` только на форме |
| Нужен ship без sync (отладка) | `--force-no-sync` (не оставлять в проде) |
| Deliver снова режется рано | `$env:HH_DELIVER_LETTER_TIMEOUT_MS='0'` |
| Infra снова режется L2-opening | временный `$env:HH_LETTER_ALLOW_L2_OPENING='1'` (шире) — лучше откат коммита framing |

### Git (срез целиком)

```powershell
# Список файлов среза — см. COMMIT / git show
git revert <commit-sha>   # предпочтительно
# или точечно:
git checkout HEAD~1 -- lib/hh-resume-visibility.mjs lib/apply-ship-outcome.mjs lib/hunt-day-orchestrator.mjs lib/spawn-deliver-letter-vacancy.mjs lib/letter-framing-router.mjs
```

После отката: `npm run test:ship-truth` · `npm run test:hunt-day-plan`.

### Не откатывать вместе

- Данные очереди / approved письмо Альфы в store — отдельно от кода.
- `data/` vs `data-emil` dual-path очереди — отдельная миграция, не часть revert этого среза.

---

## Фраза агенту

Ship-truth 29.07 закрыт: clients default + formBannerIgnored · ship --go sync · deliver timeout · infra framing. Откат — SESSION-2026-07-29-ship-truth-close §откат. Live: hunt-day ship --go на Код Безопасности / МИР ВЕНДИНГА; Альфа только с GO на офис.
