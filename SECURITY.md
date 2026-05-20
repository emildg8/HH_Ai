# Политика безопасности

## Поддерживаемые версии

| Версия | Поддержка        |
| ------ | ---------------- |
| 2.0.x  | Текущая          |
| 1.0.x  | Критические fix  |

## Сообщить об уязвимости

Не создавайте публичный issue с описанием уязвимости, если в нём могут быть секреты или обход защиты hh.ru.

1. Опишите проблему в **приватном** issue репозитория [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai) (Security advisory) или свяжитесь с maintainer напрямую.
2. Укажите шаги воспроизведения и влияние (утечка `.env`, сессии, API-ключей).

## Что нельзя коммитить

- `.env`, `config/secrets.local.env`, `config/devops.env`, `config/profiles/*.env` (кроме `*.example.env`)
- `data/session/` — cookies Chromium
- `CV/`, личные PDF, очереди `data/vacancies-*.json`
- Ключи OpenRouter, Telegram, hash резюме hh.ru

Проверка перед push:

```bash
npm run export:public
# или готовый zip для передачи:
npm run release:public
# просмотрите dist/hh-ai-public — не должно быть секретов
```

## Рекомендации

- Храните резервные копии (`npm run backup`) **только локально**, с шифрованием диска.
- Не публикуйте zip из `npm run release:pack` — в полном архиве могут быть сессии и ключи.
- Используйте умеренные лимиты откликов (`lib/hh-apply-rate.mjs`), соблюдайте правила hh.ru.
