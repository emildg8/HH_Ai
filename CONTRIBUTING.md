# Участие в разработке HH Ai

**Репозиторий:** [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)  
**Ветка разработки:** `HH_Ai`

## Окружение

```bash
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
git checkout HH_Ai
npm install
npx playwright install chromium
cp .env.example .env
npm run verify:local
```

Документация: [docs/README.md](docs/README.md).

## Ветки и релизы

| Ветка / тег | Назначение |
|-------------|------------|
| `HH_Ai` | Основная разработка |
| `v*.*.*` | Релизы на GitHub Releases |
| `main` | При необходимости — стабильная линия |

Пуш только в **emildg8/HH_Ai** (`git remote` `hh_ai`). См. [docs/GITHUB.md](docs/GITHUB.md).

## Коммиты

- Префиксы: `feat:`, `fix:`, `docs:`, `chore:`, `release:`
- Язык: русский или английский
- **Не коммитить:** `.env`, `data/session`, `data/vacancies-*.json`, ключи, CV, личные `*.env`

## Pull request

1. Опишите **зачем** изменение.
2. Чеклист из шаблона PR.
3. Проверки:

```bash
npm run quality:check
npm run verify:local
npm run export:public
# dist/hh-ai-public — без sk-or-v1, очередей, session
```

При изменении писем, таргетинга или `lib/cover-letter-*`: `npm run test:letters` и `npm run test:targeting`.

4. При изменении UI дашборда:

```bash
npm run quality:dashboard        # check:dashboard + unit static
npm run test:dashboard-settings  # Playwright: модалка настроек
npm run devops:test-dashboard-ui # общий smoke UI
```

## Новый профиль вакансий

```bash
npm run profile:init -- --id=my-role --title="My Role"
```

Примеры: `config/profiles/*.example.env`.

## Релиз для пользователей

```bash
# 1. Поднять VERSION, package.json, desktop, CHANGELOG [X.Y.Z]
npm run verify:release           # gate-b, screenshots, a11y, chat, smoke:release
npm run release:public
git tag vX.Y.Z
gh release create vX.Y.Z --repo emildg8/HH_Ai ...
```

Быстрая проверка без smoke export: `npm run verify:release -- --skip-smoke`.

См. [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md).

## Безопасность

[SECURITY.md](SECURITY.md) — уязвимости в приватный issue, не в публичный чат с ключами.
