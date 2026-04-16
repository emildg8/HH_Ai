# OpenRouter (оценка вакансий)

## Ключ

1. Зарегистрируйтесь на [openrouter.ai](https://openrouter.ai/), создайте API key.
2. В **`config/secrets.local.env`** (или `.env` / `.env.local`):

   ```
   OpenRouter_API_KEY=sk-or-v1-...
   ```

   Допустимо и имя **`OPENROUTER_API_KEY`**. Без пробелов вокруг `=`.

## Только бесплатные модели (по умолчанию)

Скрипт принимает модель только если:

- **`openrouter/free`** — маршрутизатор, сам выбирает доступную бесплатную модель, или  
- id заканчивается на **`:free`** (например `google/gemma-2-9b-it:free`).

Переменная **`OPENROUTER_MODEL`**, если не задана: в коде используется **`openrouter/free`** (маршрутизатор бесплатных моделей). Явную модель с суффиксом `:free` задайте так: **`OPENROUTER_MODEL=google/gemma-2-9b-it:free`** и т.п.

Чтобы разрешить **платные** модели (не для тестового «только free» режима):

```
OPENROUTER_ALLOW_PAID=1
OPENROUTER_MODEL=anthropic/claude-3.5-haiku
```

## Запросы

Используется endpoint `https://openrouter.ai/api/v1/chat/completions` (совместим с OpenAI Chat).

Заголовки `HTTP-Referer` и `X-Title` — по [рекомендации OpenRouter](https://openrouter.ai/docs); при желании задайте `OPENROUTER_HTTP_REFERER`.

## Три скора (кандидат решает, откликаться ли)

В одном запросе модель возвращает:

- **scoreVacancy** (0–100) — насколько объявление само по себе уместно под ваш профиль (без детальной сверки с CV).
- **scoreCvMatch** (0–100) — насколько ваши резюме из `CV/` перекрывают требования вакансии.
- **scoreOverall** (0–100) — стоит ли в целом откликаться; если модель дала некорректное значение, итог пересчитывается как взвешенная сумма двух первых.

Веса в `config/preferences.json`: **`llmScoreWeights.vacancy`** и **`llmScoreWeights.cvMatch`** (сумма нормализуется к 1).

Промпт сформулирован от лица **соискателя** (советы «вам», отклик).

Резюме в `CV/` поддерживаются **`.md`**, `.txt` и `.pdf`.

## Свой LLM (Ollama, LM Studio, vLLM…)

Оценка вакансий использует **тот же** формат, что и OpenRouter: `POST …/v1/chat/completions` (ответ OpenAI Chat).

Если заданы **и OpenRouter, и внутренний LLM**, по умолчанию вызывается **только внутренний LLM** (`HH_OPENROUTER_MAX_CALLS_PER_RUN` пусто → **0**). Чтобы сначала идти в OpenRouter, задайте, например, **`HH_OPENROUTER_MAX_CALLS_PER_RUN=30`**: тогда до N успешных вызовов — OpenRouter, при ошибке квоты (429 и т.п.) — запасной канал.

Сопроводительные в дашборде используют ту же схему (`HH_CUSTOM_LLM_*` и лимит вызовов OpenRouter).

Пример **Ollama**:

```env
HH_CUSTOM_LLM_BASE_URL=http://127.0.0.1:11434/v1
HH_CUSTOM_LLM_MODEL=llama3.2
# при необходимости:
# HH_CUSTOM_LLM_API_KEY=
```

Пример **LM Studio** (локальный сервер на порту по умолчанию):

```env
HH_CUSTOM_LLM_BASE_URL=http://127.0.0.1:1234/v1
HH_CUSTOM_LLM_MODEL=…
HH_CUSTOM_LLM_API_KEY=…
```

Допустимые алиасы: **`OLLAMA_BASE_URL`**, **`OLLAMA_MODEL`** вместо первых двух переменных.

Переменные для OpenRouter (`OPENROUTER_MODEL`, `:free` и т.д.) задают модель **пока** запросы идут через OpenRouter; после переключения на внутренний LLM используется **`HH_CUSTOM_LLM_MODEL`**.

- **`HH_OPENROUTER_MAX_CALLS_PER_RUN`** — сколько раз за прогон сначала вызывать OpenRouter при настроенном и ключе, и внутреннем LLM. Пустое значение + внутренний LLM = **0** по умолчанию (только локальный канал). **`30`** — гибрид «сначала OpenRouter». Без внутреннего LLM — без верхней границы по OpenRouter.

## Команды

- `npm run harvest` — сбор и оценка вакансий.
- `npm run dashboard` — очередь на http://127.0.0.1:3849
