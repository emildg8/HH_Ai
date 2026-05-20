# Передача HH Ai другому человеку

**Версия:** 2.0.0

## Рекомендуемый способ — GitHub Release

1. Скачать **[hh-ai-public-v2.0.0.zip](https://github.com/emildg8/HH_Ai/releases/latest)** (или актуальный с [Releases](https://github.com/emildg8/HH_Ai/releases)).
2. Отдать получателю ссылку на **[docs/PUBLIC-RELEASE.md](PUBLIC-RELEASE.md)** (внутри архива).

Сборка у себя:

```bash
npm run release:public
```

## Что получатель настраивает сам

| Файл | Действие |
|------|----------|
| `.env` | из `.env.example` |
| `config/secrets.local.env` | OpenRouter / LLM |
| `config/profiles/*.env` | из `*.example.env`, резюме hh.ru |
| `config/cover-letter.txt` | шаблон письма |
| `CV/` | свои резюме |
| `config/search-keywords*.txt` | свои запросы |

## Чего нет в публичном архиве

- Сессия hh.ru (`data/session/`)
- Очереди вакансий, логи, скриншоты
- API-ключи, hash резюме
- `node_modules/`

## Альтернатива — git

```bash
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
git checkout HH_Ai
```

Не используйте старые ссылки на Steev193/hh-ru-apply — это только идея-основа, см. [ATTRIBUTION.md](ATTRIBUTION.md).

## Полная документация

[README.md](README.md) — оглавление всех руководств.
