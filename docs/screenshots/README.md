# Скриншоты HH Ai

Демо-интерфейс дашборда **без личных данных** (фиктивные вакансии из `docs/demo/vacancies-demo.json`).

| Файл | Содержание |
|------|------------|
| `dashboard-queue.png` | Очередь вакансий с оценками |
| `dashboard-batch.png` | Панель батч-отклика |
| `dashboard-questionnaire.png` | Вкладка «Анкета» |
| `dashboard-card.png` | Карточка вакансии |

Пересоздать marketing-скрины:

```bash
npm run docs:screenshots
```

Regression baseline (DS-07): `docs/screenshots/baseline/` — `npm run test:dashboard-screenshots`.

Требуется Playwright (`npx playwright install chromium`).
