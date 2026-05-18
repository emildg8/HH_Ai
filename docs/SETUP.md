# Установка и профили

## 1. Требования

- Windows 10/11, macOS или Linux
- Node.js **18+**
- ~500 МБ под Chromium (Playwright)

Docker **не обязателен** — только опция в README.

## 2. Установка

```bash
git clone <url> hh-ru-apply
cd hh-ru-apply
npm install
npx playwright install chromium
cp .env.example .env
```

Секреты (по желанию): `config/secrets.local.env` или переменные в `.env` — см. `.env.example`.

## 3. Профиль поиска (не только DevOps)

| Способ | Описание |
|--------|----------|
| `config/devops.env` | Ваш текущий DevOps-профиль (legacy) |
| `config/profiles/<id>.env` | Универсальные профили |
| `HH_PROFILE=<id>` | Выбор профиля в командной строке |

Создать профиль под другую роль:

```bash
npm run profile:init -- --id=qa --title="QA Engineer" --keywords=./config/search-keywords-qa.txt
# отредактируйте config/profiles/qa.env
set HH_PROFILE=qa          # Windows CMD
$env:HH_PROFILE="qa"       # PowerShell
export HH_PROFILE=qa       # bash
npm run login
npm run harvest
npm run dashboard
```

Команды `npm run devops:*` по-прежнему загружают DevOps-профиль.

## 4. Первый вход

```bash
npm run login
npm run dashboard
```

Дашборд: http://127.0.0.1:3849 (или `DASHBOARD_PORT`).

## 5. Резервные копии и релиз

```bash
npm run backup                    # zip в backups/
npm run release:pack              # HH_DevOps_Emil_v1.0.zip в releases/
npm run export:public             # чистая копия для git в dist/hh-ai-public
```
