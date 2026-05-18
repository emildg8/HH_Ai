# HH Ai — публичный экспорт

Собрано: 2026-05-18T22:58:41.327Z
Версия: 1.0.0

## Быстрый старт

```bash
npm install
npx playwright install chromium
cp .env.example .env
cp config/profiles/custom.env.example config/profiles/my-role.env
# отредактируйте my-role.env, задайте HH_PROFILE=my-role
npm run login
npm run dashboard
```

См. docs/SETUP.md и docs/SECURITY.md.
