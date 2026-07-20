# SESSION 2026-07-20 — Bandicam/спич → inventory + письма (п.1–3)

**Статус:** внедрено · тесты ✅ · коммит в этой сессии  
**Связано:** [`evidence-it1-bandicam-sbp-2025-2026.md`](../my/emil/evidence-it1-bandicam-sbp-2025-2026.md) · [`LETTER-FRAMING-ROUTER.md`](LETTER-FRAMING-ROUTER.md) · [`SESSION-2026-07-20-softline-aplana-facts.md`](SESSION-2026-07-20-softline-aplana-facts.md)

---

## Сводка

По evidence Bandicam (СБП) и спичу ДПСИТ усилили **inventory**, **framing l2l3/tam**, **запрет merchant-lead в DevOps**, шаблоны **«о себе» по маршрутам**. CV на hh **не** трогали.

| # | Что | Где |
|---|-----|-----|
| 1 | STAR `bank-sbp-l2` (мерчант/QR/Postman/SQL) + talking points без мета-пометок + `aboutMeByTrack` | `data/candidate-skills-inventory.json` |
| 2 | Lead-факты l2l3/tam; prompt block; `composeL2l3FramedLetter` / `composeTamFramedLetter`; `detectMerchantLeadDevopsOpening` в quality + batch | `letter-framing-router` · `basket-letter-templates` · `letter-quality` · `letter-batch-gate` · `basket-letter` |
| 3 | Тексты «о себе» по 5 маршрутам | `aboutMeByTrack` (не live-push hh) |

---

## Откат

| Флаг | Эффект |
|------|--------|
| `HH_LETTER_SBP_L2_HOOKS=0` | Legacy l2l3 safe (без ДПСИТ/мерчант lead); нет framing prompt для l2l3/tam |
| `HH_LETTER_BAN_MERCHANT_LEAD=0` | Разрешить merchant/SM/Toad в opening devops/infra |
| `HH_LETTER_NO_FRAMED_FALLBACK=1` | Без fallback `composeL2l3FramedLetter` в basket |
| git | `git revert` коммита среза |

Inventory: откат файла из git; затем `npm run devops:sync-skills-inventory`.

---

## Тесты

```bash
npm run test:letter-sbp-l2-hooks
npm run test:letter-framing-router
npm run test:letter-l1-quality
npm run test:skills-inventory-hygiene
```

---

## Влияние и риски

| | Оценка |
|--|--------|
| Влияние | Среднее на **l2l3/tam** письма; низкое на devops (только защита от тикетного opening) |
| Риск overclaim | Низкий — без hostname/PII; цифры сервисов Softline не в letter text |
| Риск L2-tone devops | Снижен (`detectMerchantLeadDevopsOpening`) |
| CV hh | Без изменений — отдельный HT при необходимости |

### Допущения и риски

- Предполагаем: talking points с `useIn: letter` попадают в M0 pack без сырых hostname.  
- Может пойти не так: LLM всё ещё вставит «мерчант» в devops opening → gate fail → framed fallback.  
- Запасной вариант: оба env-флага отката на сессию + legacy safe templates.

---

## Не делали

- Live CV-push / правка «о себе» на hh.ru  
- Mass regen очереди  
- Октябрьское обучение кураторов в tech-буллеты  

---

## Фраза агенту

`SBP L2 hooks 20.07: inventory+framing l2l3/tam+merchant ban; тесты test:letter-sbp-l2-hooks; откат HH_LETTER_SBP_L2_HOOKS=0 / HH_LETTER_BAN_MERCHANT_LEAD=0`
