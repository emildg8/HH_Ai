# Knowledge Store — локальные артефакты

Каталог для снимков резюме/писем/JD при откликах. **Не коммитить** содержимое `artifacts/` и `exports/`.

- `artifacts/{attemptId}/` — снимки на момент apply (фаза B)
- `exports/` — zip-экспорты БД (фаза B)

База: `data/hh-ai-knowledge.db` (или `HH_KNOWLEDGE_DB`).

Инициализация: `npm run devops:knowledge-init`
