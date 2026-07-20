# Letter framing router — DevOps vs L2 tone

**Статус:** внедрён 20.07.2026  
**Связано:** [`ROLE-LADDER-M0-MATRIX.md`](ROLE-LADDER-M0-MATRIX.md) · [`SESSION-2026-07-20-letter-quality-fix.md`](SESSION-2026-07-20-letter-quality-fix.md)

---

## Сводка

После L0 hotfix (junior-ban, min 320, без SLA 85%) письма стали **безопасной эксплуатацией** — язык L2, не middle DevOps. Нужен не второй hunt-day, а **тонкий router** в существующем letter-pipeline:

```
vacancy → letter-framing-router (JD hook + lead/tail facts)
       → cover-letter prompt (buildLetterFramingPromptBlock)
       → assessLetterQuality (detectL2ToneDevopsOpening)
       → approve → ship
```

**Модуль:** `lib/letter-framing-router.mjs`  
**Тест:** `npm run test:letter-framing-router`

---

## Риски и меры

| Риск | Влияние | Мера | Откат |
|------|---------|------|-------|
| Hotfix без router → L2-tone | HR читает как линия, не DevOps | `detectL2ToneDevopsOpening` fail + `composeDevopsFramedLetter` | `HH_LETTER_ALLOW_L2_OPENING=1` |
| Router overfit на title | Vault в title, JD про другое | JD stack из `intersectJdToolsWithInventory` в prompt | ручной approve |
| R2 title L2 + DevOps resume | Подмена title (M0 anti-pattern) | `classifyRoleTier` + зеркало title | userApproved |
| Regen ломает длину (<320) | batch-gate fail | `composeDevopsFramedLetter` + `assessLetterQualityForBatch` перед save | — |
| LLM игнорирует framing block | снова L2-tone | gate fail → retry с `composeDevopsFramedLetter` fallback | template safe |
| SLA 78→93 в DevOps opening | тикетный KPI lead | SLA-дуга только l2l3 (`SOFTLINE_SLA_ARC`) | inventory канон |
| Edit на hh не проходит | старый текст в chatik | `fix-hh-letters-*` + `forceAlwaysEdit` | — |
| Нет JD-hook в opening | generic mid-письмо | `detectMissingJdHook` в batch/point | `HH_LETTER_JD_HOOK=0` |
| Weak «N+ сервисов» | gate pass без коммерческого факта | `detectWeakVolumeOnlyMetric` | `HH_LETTER_ALLOW_WEAK_VOLUME=1` |
| Анти-каскад укорачивает | Рестрим 245 симв. | `rewriteMttr15WithoutShorten` · inject ≥ len | — |
| Merchant/SM/Toad lead в DevOps | тикетный СБП-тон | `detectMerchantLeadDevopsOpening` | `HH_LETTER_BAN_MERCHANT_LEAD=0` |
| l2l3 без ДПСИТ/мерчант | слабый L2 hook | `composeL2l3FramedLetter` + framing prompt | `HH_LETTER_SBP_L2_HOOKS=0` |

**Допущения и риски:**
- Предполагаем: title вакансии отражает крючок (Vault, IDP, ЕФО) достаточно для opening.
- Может пойти не так: gate слишком жёсткий → regen loop; смягчить regex или warn-only на 1 сессию.
- Запасной вариант: только `composeDevopsFramedLetter` для point ship без LLM.

Срез Bandicam/спич (вечер 20.07): [`SESSION-2026-07-20-sbp-evidence-letters.md`](SESSION-2026-07-20-sbp-evidence-letters.md) · тест `npm run test:letter-sbp-l2-hooks`.

---

## API

| Функция | Назначение |
|---------|------------|
| `extractJdHook(rec)` | Крючок из title (vault/idp/automation/…) |
| `detectMissingJdHook(rec, text)` | L1: крючок в opening или soft-fail |
| `detectMerchantLeadDevopsOpening(rec, text)` | Ban тикетного СБП lead в devops/infra |
| `resolveLetterFramingBundle(rec)` | lead/tail facts, forbidden, risks |
| `buildLetterFramingPromptBlock(rec, huntTrack)` | Блок в LLM prompt (devops/infra/l2l3/tam) |
| `detectL2ToneDevopsOpening(rec, text)` | Gate: L2 в opening DevOps |
| `composeDevopsFramedLetter(rec)` | Детерминированный DevOps-first текст |
| `composeL2l3FramedLetter(rec)` | L2: ДПСИТ + мерчанты/QR |
| `composeTamFramedLetter(rec)` | TAM: статус партнёров + Postman |
| `assessLetterFramingRisks(rec, letter?)` | Prep JSON: risks + mitigations |

---

## DevOps opening (канон)

**Lead:** CI/CD, автоматизация, секреты/Vault, IDP, релизы, платформа  
**Tail (1 фраза):** PostgreSQL/мониторинг как часть эксплуатации  
**Не lead:** инциденты, SLA, «3+ сервиса», Zabbix-first

---

## Сегодняшние 5 (20.07)

Regen: `scripts/regen-devops-framed-letters-2026-07-20.mjs`  
Edit hh: `scripts/fix-hh-letters-2026-07-20.mjs`
