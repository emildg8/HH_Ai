## HH Ai 2.0.1

Срез после **2.0.0**: дашборд CRM, воронка по всем очередям, роутинг резюме, анкеты, безопасный URL поиска hh.ru, инфраструктура мейнтейнера.

### Установка

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
npm run login
npm run dashboard
```

Подробно: [docs/QUICKSTART.md](https://github.com/emildg8/HH_Ai/blob/main/docs/QUICKSTART.md)

### Главное

- **Установка** — `install.ps1` создаёт конфиги и режим без LLM; обязательно: `HH_PROFILE_RESUME_TITLE` + `npm run login` ([FIRST-RUN.md](https://github.com/emildg8/HH_Ai/blob/main/docs/FIRST-RUN.md))
- **Дашборд** — CRM-сайдбар, модалка воронки и аналитики, поиск по списку
- **Резюме** — `config/resume-routing.json`, выбор резюме в форме отклика (`resumeId` в URL)
- **Поиск hh.ru** — режим `url-safe`, без лишних exclude-токенов и зарплаты 300k в URL
- **Анкета** — pipeline, probe/prep/reprobe, `docs/QUESTIONNAIRE-AUTOMATION.md`
- **Мейнтейнер** — `npm run setup`, CI `smoke:release`, release workflow при теге `v*`

### Скачать

**[hh-ai-public-v2.0.1.zip](https://github.com/emildg8/HH_Ai/releases/download/v2.0.1/hh-ai-public-v2.0.1.zip)** (после тега `v2.0.1`)

Полный changelog: [CHANGELOG.md](https://github.com/emildg8/HH_Ai/blob/main/CHANGELOG.md).
