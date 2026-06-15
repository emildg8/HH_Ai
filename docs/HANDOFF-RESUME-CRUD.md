# Handoff: CRUD резюме на hh.ru

**Дата:** 2026-06-02  
**Транскрипт:** [477472e8-5d31-4270-af07-86028473f96f](agent-transcripts/477472e8-5d31-4270-af07-86028473f96f/477472e8-5d31-4270-af07-86028473f96f.jsonl)  
**Запрос пользователя:** научить автоматизацию **создавать, редактировать и удалять любое резюме прямо на сайте hh.ru**.

---

## Статус

| Задача | Статус |
|--------|--------|
| Список резюме | ✅ `listApplicantResumes` + CLI `list` |
| Создание / дублирование | ✅ `createResumeFromTemplate`, CLI `create` / `duplicate` |
| Редактирование (название, О себе, опыт) | ✅ `editResumeOnHh`, CLI `edit` |
| Чтение (scrape) | ✅ `readResumeOnHh`, CLI `scrape` |
| Удаление | ✅ `deleteResumeOnHh` (только `--yes`) |
| Единый модуль CRUD | ✅ `lib/hh-resume-crud.mjs` |
| CLI | ✅ `scripts/hh-resume-manage.mjs` |
| API дашборда | ✅ `POST /api/launch-hh-resume-manage`, `GET /api/hh-resumes-cache` |
| Юнит-тест CLI args | ✅ `npm run test:hh-resume-crud` |
| UI в service drawer дашборда | ⏳ не делали (предложено пользователю) |
| Прогон на живом hh.ru (list/delete) | ⏳ не делали — нужна сессия `npm run login` |
| Git commit | ⏳ пользователь не просил |

---

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `lib/hh-resume-crud.mjs` | Фасад: list, create, duplicate, edit, read, remove |
| `lib/hh-resume-delete.mjs` | Удаление + `probeResumeDeleteUi` |
| `lib/hh-resume-title.mjs` | Редактирование названия резюме |
| `lib/hh-resume-editor.mjs` | Список, открытие, «О себе» + опыт |
| `lib/hh-resume-create.mjs` | Мастер создания / копия |
| `lib/hh-resume-selectors.mjs` | Селекторы (в т.ч. delete, menu, title) |
| `lib/hh-resume-manage-args.mjs` | Парсер argv CLI |
| `scripts/hh-resume-manage.mjs` | CLI entrypoint |
| `scripts/test-hh-resume-crud.mjs` | Юнит-тесты без браузера |
| `scripts/probe-hh-resume-ui.mjs` | + `deleteUiProbe` в отчёт |
| `scripts/list-profile-resumes.mjs` | Переведён на `listApplicantResumes` |
| `scripts/dashboard-server.mjs` | API launch + cache |

---

## Команды

```bash
npm run login                                    # сессия hh.ru (обязательно)
npm run devops:hh-resume-manage -- list
npm run devops:hh-resume-manage -- create --title="DevOps" --copy-from=HASH
npm run devops:hh-resume-manage -- duplicate --title="Копия" --copy-from=HASH
npm run devops:hh-resume-manage -- edit --hash=HASH --title="Новое имя"
npm run devops:hh-resume-manage -- edit --hash=HASH --about-file=path.txt
npm run devops:hh-resume-manage -- scrape --hash=HASH
npm run devops:hh-resume-manage -- delete --hash=HASH --yes   # необратимо
npm run devops:hh-resume-manage -- probe-delete --hash=HASH
npm run devops:probe-resume-ui
npm run test:hh-resume-crud
```

**Дашборд** (порт 3849):

- `POST /api/launch-hh-resume-manage` — `{ "action": "list|create|duplicate|edit|delete|scrape|probe-delete", "hash": "…", "title": "…", "copyFrom": "…", "confirm": true }` (для delete)
- `GET /api/hh-resumes-cache` — после `list` → `data/hh-resumes-cache.json`

---

## Контекст сессии (до CRUD)

- Релиз **v3.2.0** выпущен (тег, push).
- Локальные изменения **3.3** (onboarding, chat-save-draft, UX) могут быть **не закоммичены**.
- Дашборд: `http://127.0.0.1:3849`, demo-очередь `docs/demo/vacancies-demo.json`.
- **Не убивать** глобально Chrome — только PID на порту дашборда (правило `.cursor/rules/browser-safety.mdc`).

---

## Следующие шаги (для продолжающего агента)

1. **Проверка на живом hh:** `npm run devops:hh-resume-manage -- list` — убедиться, что hash и названия совпадают.
2. **Если delete не кликается:** `probe-delete` → обновить `lib/hh-resume-selectors.mjs` по `data/hh-resume-delete-probe.json`.
3. **UI дашборда:** кнопки в service drawer — list / sync variants / delete с confirm.
4. **Коммит** — только по явной просьбе пользователя; не коммитить `config/preferences.json`, `data/`, `.env`.

---

## Промпт для перезапуска

Скопируй в новый чат:

```
Продолжи задачу CRUD резюме на hh.ru в HH Ai (d:\Dev\HH\hh-ru-apply).
Читай docs/HANDOFF-RESUME-CRUD.md и транскрипт 477472e8-5d31-4270-af07-86028473f96f.
Сделано: lib/hh-resume-crud.mjs, hh-resume-manage CLI, API дашборда, удаление с --yes.
Осталось: прогон list на живом профиле, при поломке UI — probe-delete и селекторы,
опционально кнопки в service drawer. Коммит не делать без просьбы.
```
