# Настройка LLM и профиля

Краткий гид по конфигурации после [FIRST-RUN.md](FIRST-RUN.md).

## Файлы конфигурации

| Файл | Назначение |
|------|------------|
| `.env` | порты, пути, общие флаги |
| `config/secrets.local.env` | API-ключи (не в git) |
| `config/profiles/*.env` | профиль кандидата (резюме, роль) |
| `config/preferences.json` | настройки дашборда (через UI Settings) |

## Режим без LLM (по умолчанию)

После `install.ps1` / `install-portable.ps1` копируется `config/presets/no-llm.env`:

- локальная эвристическая оценка вакансий;
- без запросов к OpenRouter.

Подходит для знакомства с дашбордом и demo.

## OpenRouter

1. Ключ на [openrouter.ai](https://openrouter.ai/)
2. В `config/secrets.local.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

3. В `.env` или secrets:

```env
HH_SCORE_MODE=openrouter-first
```

## Ollama (локально, бесплатно)

1. Установите [Ollama](https://ollama.com/)
2. `ollama pull llama3.2` (или другая модель)
3. В `config/secrets.local.env`:

```env
HH_CUSTOM_LLM_BASE_URL=http://127.0.0.1:11434/v1
HH_CUSTOM_LLM_MODEL=llama3.2
```

## Профиль резюме

`config/profiles/devops.env`:

```env
HH_PROFILE_RESUME_TITLE=DevOps инженер
HH_PROFILE_ROLE=devops
```

Название должно **совпадать** с резюме на hh.ru.

## Пресеты

Каталог `config/presets/` — готовые снимки настроек. См. [presets/README.md](../config/presets/README.md).

## Настройки в дашборде

Все пользовательские параметры — модалка **Настройки** (не разбросаны по экранам). См. [SETTINGS-MODULE.md](SETTINGS-MODULE.md).

## Лимиты и бюджет

- `HH_OPENROUTER_MAX_CALLS_PER_RUN` — лимит вызовов за прогон
- `HH_LLM_MAX_PER_RUN=0` — отключить LLM полностью

Проверка: `npm run setup:check`
