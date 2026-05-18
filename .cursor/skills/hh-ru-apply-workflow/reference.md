# Справка: LLM, секреты, стиль писем

## OpenRouter и оценка вакансий

Полная инструкция: [config/OPENROUTER.md](../../../config/OPENROUTER.md). Ключ и модель — в `config/secrets.local.env` или `.env` (см. [config/secrets.example.env](../../../config/secrets.example.env), [.env.example](../../../.env.example)).

## Gemini

Файл [config/GEMINI.md](../../../config/GEMINI.md) помечен как устаревший; актуальный путь — OpenRouter, см. выше.

## Стиль сопроводительных (env)

Из [README.md](../../../README.md): опционально в `.env` задают `COVER_LETTER_STYLE_MAX_CHARS` (по умолчанию 5000), `COVER_LETTER_STYLE_QUEUE_ITEMS` (по умолчанию 4). Ручные эталоны — `config/cover-letter-style-examples.txt` (шаблон: `config/cover-letter-style-examples.example.txt`).

Код контекста стиля: [lib/cover-letter-style-context.mjs](../../../lib/cover-letter-style-context.mjs); генерация через OpenRouter — см. `lib/cover-letter-openrouter.mjs` и связанные модули в `lib/`.
