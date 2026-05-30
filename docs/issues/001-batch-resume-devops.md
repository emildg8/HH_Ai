## Контекст

В `devops:apply-batch` резюме с заголовком **DevOps** (`HH_PROFILE_RESUME_TITLE` / `HH_PROFILE_RESUME_HASH`) **не всегда** выбирается в форме отклика на hh.ru.

## Симптомы

- В логе: `[batch] Пропуск …: не выбрано резюме «DevOps»` (см. `lib/batch-skip-reason.mjs`)
- Скрины: `data/hh-apply-chat-error-*.png`
- Логика: `lib/hh-resume-upload.mjs`, `lib/hh-resume-picker.mjs`

## Исправления (2.0.1+)

1. **`pickAndApplyEmployerResume`** — ожидание списка резюме, reload формы по `resumeId`, fallback через `selectProfileResumeInResponseModal`, match по hash даже при расхождении title.
2. **`hh-response-modal`** — до 4 попыток выбора резюме (было 2).
3. **`titleMatchesPreferred`** — DevOps/SRE/MLOps/Observability без ложного match с Data Engineer.

## Что проверить

1. `npm run devops:list-resumes` — актуальный hash в `config/resume-routing.json`
2. `npm run devops:preview-resume-routing` — роль для вакансии
3. `node scripts/test-hh-resume-match.mjs`

## Roadmap

Техдолг 2.0 · приоритет для 2.0.1 / 2.1.0 · **частично закрыто в 2.0.1**
