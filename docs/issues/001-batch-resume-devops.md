## Контекст

В `devops:apply-batch` резюме с заголовком **DevOps** (`HH_PROFILE_RESUME_TITLE` / `HH_PROFILE_RESUME_HASH`) **не всегда** выбирается в форме отклика на hh.ru.

## Симптомы

- В логе: `[batch] Пропуск …: не выбрано резюме «DevOps»` (см. `lib/batch-skip-reason.mjs`)
- Скрины: `data/hh-apply-chat-error-*.png`
- Логика: `lib/hh-resume-upload.mjs`

## Что проверить

1. `npm run devops:list-resumes` — актуальный hash в `config/profiles/devops.env`
2. `HH_PROFILE_RESUME_HASH` и `HH_PROFILE_RESUME_TITLE` совпадают с hh.ru
3. Вёрстка списка резюме (селекторы)

## Roadmap

Техдолг 2.0 · приоритет для 2.0.1 / 2.1.0
