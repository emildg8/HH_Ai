# Чекпоинт для продолжения работы

**Обновлено:** 2026-05-20 (перед перезагрузкой ПК)  
**Версия проекта:** 2.0.0 · ветка `HH_Ai` · тег `v2.0.0`

> Этот файл — сжатая память сессии. Документация проекта: [docs/README.md](README.md). В новом чате: «продолжи по docs/CONTINUATION.md».

---

## Опубликовано (сделано)

| Что | Где |
|-----|-----|
| Релиз **2.0.0** | [github.com/emildg8/HH_Ai/releases/tag/v2.0.0](https://github.com/emildg8/HH_Ai/releases/tag/v2.0.0) |
| Публичный zip | [hh-ai-public-v2.0.0.zip](https://github.com/emildg8/HH_Ai/releases/download/v2.0.0/hh-ai-public-v2.0.0.zip) |
| Репозиторий | `https://github.com/emildg8/HH_Ai` · ветка **`HH_Ai`** |
| Коммиты | `0e72219` (Release 2.0.0), `f7dffd0` (fix zip Windows в `lib/archive.mjs`) |
| Документация | `CHANGELOG.md`, `README.md`, `docs/PUBLIC-RELEASE.md`, `npm run release:public` |

**Канонический git:** только [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai). В `Steev193/hh-ru-apply` **не публикуем** — это лишь идея-основа (см. `docs/ATTRIBUTION.md`).

---

## Ключевые фичи 2.0 (контекст диалога)

1. **Батч + анкета** — при анкете отклик не отправляется, код выхода `5` (`lib/hh-apply-exit-codes.mjs`), лимиты дня/часа не тратятся; карточка в разделе «Анкета».
2. **Журнал батча** — понятные пропуски: `не выбрано резюме «DevOps»`, `анкета: N вопр.` (`lib/batch-skip-reason.mjs`, маркер `[hh-apply-batch-skip]`).
3. **Области батча** — `queue` / `noQuestionnaire` / `questionnaire` / `hidden` (`lib/batch-scope.mjs`, вкладки дашборда).
4. **Harvest** — hint анкеты по тексту (`lib/harvest-questionnaire-hint.mjs`), фильтры заголовка, `HH_SEARCH_EXCLUDE_TOKENS`, `HH_LOCAL_SCORE_MIN`.
5. **Капча** — ожидание в Chromium (`lib/hh-captcha-wait.mjs`, `HH_CAPTCHA_WAIT_MS`).
6. **Резюме в форме** — `HH_PROFILE_RESUME_TITLE` / `HASH`, `npm run devops:list-resumes`, правки `lib/hh-resume-upload.mjs`.
7. **UI** — плотность карточек, `ui-card-tuning`, `local-dashboard-defaults.example.mjs`, `questionnaire-choice.mjs`.

---

## Локальная среда (после перезагрузки)

```powershell
cd D:\Dev\HH\hh-ru-apply

# Дашборд (отдельный терминал, не закрывается сам)
npm run dashboard
# → http://127.0.0.1:3849  · Ctrl+F5 после обновления кода

# Сессия hh.ru (если сбросилась)
npm run login

# Публичный срез / zip
npm run release:public
# → dist/hh-ai-public + releases/hh-ai-public-v2.0.0.zip
```

| Путь | Назначение |
|------|------------|
| `data/hh-apply-chat.log` | Лог батча и откликов |
| `data/vacancies-devops.json` | Очередь DevOps (в git не входит) |
| `config/profiles/devops.env` | Профиль + резюме (секреты, в git не входит) |
| `config/secrets.local.env` | OpenRouter и др. |
| `data/session/` | Cookies Chromium |

**Remote git:** пушить в **`hh_ai`** → emildg8/HH_Ai. `origin` может указывать на Steev193 (исторически) — для работы не использовать.

---

## Известные проблемы / открытое

| Тема | Статус | Действие при продолжении |
|------|--------|---------------------------|
| Резюме DevOps не всегда выбирается в батче | частично | Проверить `HH_PROFILE_RESUME_HASH`, лог `[batch] Пропуск … резюме`, скрины `data/hh-apply-chat-error-*.png` |
| Батч из «Очередь» ловит анкеты | ожидаемо | Для массового отклика — вкладка **«Без анкет»** |
| `npm run release:public` на Windows | исправлено в `f7dffd0` | Был баг `Compress-Archive -LiteralPath` → `-Path` |
| Steev193/hh-ru-apply | не наш репо | Только упоминание в ATTRIBUTION, без push |
| Roadmap R1.2–R1.4 | [ ] | Portable zip в CI, GitHub Releases автоматом |

---

## Планы (roadmap, кратко)

См. `docs/ROADMAP.md`:

- **Фаза 1:** portable zip из CI, `install-portable.ps1`, QA на чистой VM.
- **Фаза 2:** feedback invited/declined → few-shot письма.
- **Фаза 3:** pre-push hook секретов, Telegram после harvest.
- **Фаза 4:** выбор `HH_PROFILE` в UI дашборда.

---

## Команды npm (шпаргалка)

| Команда | Назначение |
|---------|------------|
| `npm run devops:harvest` | Сбор DevOps |
| `npm run devops:apply-batch` | Батч откликов |
| `npm run devops:list-resumes` | Hash резюме на hh.ru |
| `npm run devops:probe-questionnaire` | Probe анкеты |
| `npm run verify:local` | Проверка |
| `npm run export:public` | Каталог без секретов |
| `npm run release:public` | Zip для передачи |

---

## История чата (темы сессии)

1. Перезапуск дашборда, harvest, отделение анкет.
2. Зависание при kill процесса на порту 3849 (долгоживущий сервер + фоновые задачи).
3. Причины пропусков в батче → человекочитаемый журнал.
4. Релиз **2.0.0**, доки, `release:public`, публикация на **emildg8/HH_Ai**.

Транскрипт Cursor (если нужны детали): agent-transcripts, id `29b3ec05-c7ce-496f-9f7d-0ad44c1ca91b`.

---

## Первое сообщение в следующей сессии (пример)

> Продолжаем HH Ai 2.0 по `docs/CONTINUATION.md`. [ваша задача, например: донастроить выбор резюме DevOps в батче / …]
