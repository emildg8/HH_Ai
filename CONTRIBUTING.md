# Участие в разработке

## Окружение

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run devops:test-dashboard-ui
```

## Ветки

- `main` — стабильные релизы (теги `v*.*.*`)
- `HH_Ai` — интеграция функций AI/дашборда перед merge в main

## Коммиты

- Сообщения на русском или английском, по смыслу: `feat:`, `fix:`, `docs:`, `chore:`
- Не включайте секреты, скриншоты с токенами, дампы `data/session`

## Pull request

1. Опишите **зачем** изменение.
2. Укажите команды проверки (`npm run devops:test-dashboard-ui`, ручной сценарий).
3. Убедитесь, что `npm run export:public` / `npm run release:public` не тащит личные файлы.

## Профили вакансий

Новый профиль — `npm run profile:init -- --id=...`, примеры в `config/profiles/*.example.env`.
