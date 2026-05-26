# Установка HH Ai

**Версия:** 2.0.1 · [Вся документация](README.md) · Публичный zip: [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md)

**Репозиторий:** [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai) (ветка `HH_Ai`). Идея-основа — [ATTRIBUTION.md](ATTRIBUTION.md).

```bash
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
git checkout HH_Ai
```

## 1. Требования

- Windows 10/11 (или macOS/Linux)
- [Node.js 18+](https://nodejs.org/)
- ~500 МБ под Chromium

## 2. Установка

```bash
npm install
npx playwright install chromium
copy .env.example .env
```

Опционально на Windows: `powershell -ExecutionPolicy Bypass -File scripts/install.ps1`

## 3. Секреты и профиль

1. `.env` — общие переменные (см. `.env.example`).
2. `config/secrets.local.env` — OpenRouter, Telegram (опционально).
3. Профиль вакансии:
   - `copy config\profiles\devops.env.example config\profiles\devops.env` (или свой `*.example.env`)
   - либо legacy `config/devops.env` (в git не попадает)

Укажите `HH_PROFILE_RESUME_TITLE` и при необходимости `HH_PROFILE_RESUME_HASH` с hh.ru.

## 4. CV и письма

- PDF/текст резюме → папка `CV/`
- Сопроводительное: `config/cover-letter.txt` (из `cover-letter.example.txt`)
- Фильтры: `config/preferences.json`

## 5. Первый запуск

```bash
npm run login
npm run dashboard
```

В **отдельном** терминале держите `npm run dashboard` запущенным.  
Откройте http://127.0.0.1:3849 · при сбоях UI — **Ctrl+F5**.

## 6. Другая вакансия

```bash
npm run profile:init -- --id=analyst --title="Системный аналитик"
# edit config/profiles/analyst.env
set HH_PROFILE=analyst
npm run harvest
npm run dashboard
```

## 7. Проверки

```bash
npm run verify:local -- --start-dashboard
```

## 8. Бэкапы

```bash
npm run backup
npm run release:pack
```

Не публикуйте zip с `data/session` открыто.

## 9. Батч-отклики (2.0)

- В дашборде: область **«Без анкет»** — батч не останавливается на анкетах (код выхода `5`, лимиты дня/часа не тратятся).
- В `data/hh-apply-chat.log`: `Пропуск N/M: не выбрано резюме «…»` или `анкета: N вопр.`
- Резюме: `HH_PROFILE_RESUME_TITLE` / `HH_PROFILE_RESUME_HASH` в профиле; `npm run devops:list-resumes`.

## 10. Публичный срез для git / передачи

```bash
npm run release:public
```

См. [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md).
