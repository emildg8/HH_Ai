# Чекпоинт для продолжения работы

**Обновлено:** 2026-05-22 · **Версия проекта:** 2.0.1 (срез, тег `v2.0.1` — после коммита и push)

**Новое в 2.0.1:** CRM-дашборд, воронка по union-очереди, поиск в списке, `resume-routing.json`, pipeline анкет, `hh-search` url-safe. См. [CHANGELOG.md](../CHANGELOG.md).

> Этот файл — сжатая память сессии. Документация: [docs/README.md](README.md). В новом чате: «продолжи по docs/CONTINUATION.md».

---

## Опубликовано

| Что | Где |
|-----|-----|
| Релиз **2.0.0** | [releases/tag/v2.0.0](https://github.com/emildg8/HH_Ai/releases/tag/v2.0.0) |
| Релиз **2.0.1** | после `git tag v2.0.1 && git push hh_ai v2.0.1` → CI прикрепит zip |
| Публичный zip | `npm run release:public` → `releases/hh-ai-public-v2.0.1.zip` |
| Репозиторий | `https://github.com/emildg8/HH_Ai` · ветка **`HH_Ai`** |
| Notes | `releases/RELEASE-v2.0.1-notes.md` |

**Канонический git:** только [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai). В Steev193/hh-ru-apply **не публикуем**.

---

## Ключевое в 2.0.1

1. **Дашборд CRM** — Рутина / Работа / Отчёты / Настройки; аналитика и воронка (`lib/queue-aggregate.mjs`, `lib/funnel-analytics.mjs`).
2. **Роутинг резюме** — `config/resume-routing.json`, `lib/hh-resume-picker.mjs`, `resumeId` в URL формы отклика.
3. **Поиск hh.ru** — `HH_SEARCH_SALARY=0`, exclude только senior/lead/1с в URL (`lib/hh-search.mjs`).
4. **Анкета** — pipeline, prep/reprobe batch; [QUESTIONNAIRE-AUTOMATION.md](QUESTIONNAIRE-AUTOMATION.md).
5. **Мейнтейнер** — `npm run setup`, CI release workflow, [MAINTAINER.md](MAINTAINER.md).

Контекст **2.0.0** (батч+анкета код `5`, batch-scope, капча) — без изменений, см. CHANGELOG 2.0.0.

---

## Локальная среда

```powershell
cd D:\Dev\HH\hh-ru-apply
git pull hh_ai HH_Ai
npm run dashboard   # http://127.0.0.1:3849 · Ctrl+F5 после обновления UI
npm run setup:check
```

**Не коммитить:** `data/batch-state.json`, `data/cover-letter-regen-state.json`, `config/resume-routing.json` (если личный), `releases/RELEASE-public-v*.json`, `releases/hh-ai-public-*.zip`.

---

## Перед тегом v2.0.1

```powershell
npm run smoke:release
npm run verify:local
npm run release:public
git add -A   # без секретов и data/
git commit -m "Release v2.0.1: CRM dashboard, funnel union, resume routing"
git tag v2.0.1
git push hh_ai HH_Ai
git push hh_ai v2.0.1
```

При необходимости вручную: `gh release create v2.0.1 --repo emildg8/HH_Ai --notes-file releases/RELEASE-v2.0.1-notes.md releases/hh-ai-public-v2.0.1.zip`

---

## Открытое / 2.1.0

| Тема | Действие |
|------|----------|
| [#3](https://github.com/emildg8/HH_Ai/issues/3) резюме в батче | проверить с `resume-routing` |
| [#5](https://github.com/emildg8/HH_Ai/issues/5) invited/declined → feedback | старт 2.1.0 |
| QA на чистой VM | [QA-CLEAN-INSTALL.md](QA-CLEAN-INSTALL.md) |
| Полная синхронизация откликов hh → очередь | `devops:sync-responses` |

См. [ROADMAP.md](ROADMAP.md).

---

## Первое сообщение в следующей сессии (пример)

> Продолжаем HH Ai 2.0.1 по `docs/CONTINUATION.md`. [задача]
