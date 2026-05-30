## Контекст

Roadmap **R2.1–R2.2**: учитывать приглашения и отказы при генерации писем.

## Реализовано (2.1.0)

1. Кнопки **«Пригласили»** / **«Отказ»** в дашборде (вкладка «Отклики» и очередь)
2. Запись в `data/feedback.jsonl` (`POST /api/hh-site-state`)
3. Few-shot в generate: `lib/outcome-feedback.mjs` → `lib/cover-letter-openrouter.mjs`
4. Письма с приглашением как эталоны: `loadStyleExamplesFromInvited` в `cover-letter-style-context.mjs`
5. Сводка в «Аналитика»: `computeFeedbackStats`

## Что проверить

1. Откликнулись → вкладка «Отклики» → **Пригласили** на карточке
2. Следующая генерация письма — в промпте блок «Удачные исходы»
3. `node scripts/test-outcome-feedback.mjs`

## Версия

**2.1.0** — закрыто
