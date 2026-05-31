# Виды карточек

Актуальная спецификация: **[CARD-DESIGN-SYSTEM.md](./CARD-DESIGN-SYSTEM.md)** (QC v1).

Кратко:

| Пресет | Layout | Назначение |
|--------|--------|------------|
| Краткий | `tile-compact` | Список-строка, сканирование очереди |
| Средний | `tile-medium` | Полные `.card` в CSS grid, футер прижат к низу |
| Полный | `expanded` | Полная `.card` |

Переключение: тулбар **Вид** → `ui-card-tuning.mjs` → `card-tiles.mjs` + `dashboard-card-tiles.css`.
