# Чекпоинт для продолжения работы

**Обновлено:** 2026-05-26 · **Версия:** 2.0.1 · ветка `HH_Ai`

**Релиз:** [v2.0.1](https://github.com/emildg8/HH_Ai/releases/tag/v2.0.1) · zip [hh-ai-public-v2.0.1.zip](https://github.com/emildg8/HH_Ai/releases/download/v2.0.1/hh-ai-public-v2.0.1.zip)

> Память сессии. Документация: [docs/README.md](README.md). Новый чат: «продолжи по docs/CONTINUATION.md».

---

## Сделано в сессии (22–26.05)

| Тема | Статус |
|------|--------|
| CRM-дашборд, воронка union, поиск в списке | ✓ в 2.0.1 |
| `hh-search` url-safe, `config/devops.env` HH_SEARCH_SALARY=0 | ✓ локально |
| `HH_PLAYWRIGHT_CHANNEL` закомментирован → bundled Chromium | ✓ `.env` |
| Утренний цикл, sync/import откликов, чаты, 5 резюме | ✓ |
| Публичный релиз: FIRST-RUN, install, скрины, CI zip | ✓ GitHub |
| Настройки: модалка (отклики / список / интерфейс) | ✓ |
| Сайдбар **Полный / Кратко** | ✓ crm15 |

---

## Локально (ваши файлы, не в git)

| Файл | Назначение |
|------|------------|
| `config/devops.env` | профиль, поиск |
| `config/secrets.local.env` | LLM |
| `config/resume-routing.json`, `resume-variants.json` | hash резюме |
| `data/vacancies-devops.json` | очередь |
| `data/hh-negotiations-cache.json` | кэш откликов hh |

```powershell
cd D:\Dev\HH\hh-ru-apply
npm run setup:check
npm run dashboard   # Ctrl+F5 после обновления
```

**После sync откликов:** `npm run devops:apply-negotiations-cache` или кнопка в «Сервис».

---

## Открытое (2.1.0)

- [#3](https://github.com/emildg8/HH_Ai/issues/3) — резюме в батче (проверить с routing)
- [#5](https://github.com/emildg8/HH_Ai/issues/5) — feedback invited/declined
- Транскрибация интервью → `npm run devops:analyze-interviews`
- QA на чистой VM — [QA-CLEAN-INSTALL.md](QA-CLEAN-INSTALL.md)

См. [ROADMAP.md](ROADMAP.md) · [IMPROVEMENTS-TODAY.md](IMPROVEMENTS-TODAY.md)
