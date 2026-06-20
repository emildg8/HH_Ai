# Операционный ритм HH Ai

Когда и зачем выполнять ритуалы поиска работы. Дополняет [HIRING-OPERATIONS.md](HIRING-OPERATIONS.md) («что запускать»).

## Матрица интенсивности (D0–D3)

| Уровень | Когда | Ежедневно | Еженедельно |
|---------|-------|-----------|-------------|
| **D0** | отпуск / пауза | — | — |
| **D1** | 5–10 откликов/нед | digest, inbox | — |
| **D2** | активный поиск (по умолчанию) | harvest sync, чаты | 20+20 patterns |
| **D3** | дедлайн / много приглашений | + prep собесов | baseline сверка |

## Ежедневно (D1+)

1. `npm run dashboard` — очередь, чаты, письма.
2. Inbox: ответы HR &lt; 2 ч (если есть).
3. Не более N откликов в день (см. Настройки → Отклики).

## Еженедельно (D2+)

1. **Ритуал 20+20** — разобрать ~20 invited и ~20 declined, записать паттерны.
2. Файл: `data/ops-reviews/patterns-YYYY-Www.json` (см. пример в `scripts/fixtures/ops-patterns-example.json`).
3. `npm run devops:ops-weekly-report` — черновик отчёта (ORG-5).

## Ежемесячно

1. Сверка `intelligence-baseline.json` — нужен новый снимок?
2. Решение по LLM-бюджету → `data/ops-log.jsonl`.
3. `plan-snapshot` перед сменой пресетов gate.

## Перед первым батчем (волна 1)

```powershell
npm run devops:intelligence-baseline
npm run devops:ops-readiness
```

Ожидается: baseline записан, hr-screening заполнен, secrets или no-llm.

## Перед батчем со строгой проверкой

```powershell
node scripts/hh-apply-batch.mjs --strict-ops ...
```

## Артефакты

| Файл | Назначение |
|------|------------|
| `data/intelligence-baseline.json` | точка отсчёта invite% |
| `data/intelligence-digest.json` | последний digest |
| `data/ops-log.jsonl` | решения LLM, крупные сдвиги |
| `data/ops-reviews/patterns-*.json` | weekly 20+20 |
| `config/hr-screening-answers.json` | ответы на скрининг HR |

## Автопроверки

```powershell
npm run test:ops-readiness
npm run devops:ops-readiness
```

## Связанные документы

- [HIRING-OPERATIONS.md](HIRING-OPERATIONS.md)
- [HANDOFF-TEMPLATE.md](HANDOFF-TEMPLATE.md)
- [PRODUCT-STANDARDS.md](PRODUCT-STANDARDS.md)
