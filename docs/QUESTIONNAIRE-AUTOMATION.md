# Автоматизация анкеты работодателя

Цель — меньше ручного ввода и ответы, которые повышают шанс приглашения на собеседование.

## Цепочка (рекомендуемый порядок)

1. **Сбор вопросов** — батч по «Без анкет» или отклик: при анкете на hh.ru вопросы пишутся в `hhApply.questionnaire.questions` (карточка во вкладке **Анкета**).
2. **Уточнение текста** — анкета на hh.ru часто **на нескольких шагах** (текст + radio про LLM и т.д.). Если в дашборде меньше вопросов, чем в браузере: **«Загрузить с hh.ru»** / `devops:questionnaire-reprobe-batch` (проходит все шаги мастера).
3. **Черновики ответов** — **«Сгенерировать ответы (все анкеты)»** / `devops:questionnaire-prep-batch` (CV; при `HH_QUESTIONNAIRE_LLM=1` — LLM + ваши примеры из `data/questionnaire-user-edits.jsonl`).
4. **Проверка** — правки в дашборде → **«Сохранить»** (`savedAnswers`; отличия от черновика попадают в few-shot).
5. **Отклик** — **«Отклик + анкета»** или батч по вкладке **Анкета** с подстановкой ответов.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `HH_BATCH_QUESTIONNAIRE_AUTO` | `1` | Батч передаёт `--questionnaire-auto`: генерация + подстановка + повторная отправка |
| `HH_QUESTIONNAIRE_AUTO` | выкл. | То же для одиночного отклика / кнопки «Авто-отклик» |
| `HH_QUESTIONNAIRE_LLM` | выкл. | LLM для ответов (иначе эвристика по CV) |
| `HH_QUESTIONNAIRE_WAIT` | выкл. | Пауза в браузере до Enter после анкеты |
| `HH_QUESTIONNAIRE_HIGH_SCORE_MIN` | `72` | Балл вакансии: более развёрнутые ответы LLM |

## Команды

```bash
npm run devops:questionnaire-reprobe-batch
npm run devops:questionnaire-reprobe-batch -- --limit=10
npm run devops:questionnaire-prep-batch
npm run devops:questionnaire-prep-batch -- --force
npm run devops:probe-questionnaire -- --id=<uuid>
```

В дашборде на вкладке **Анкета**: **«Обновить вопросы с hh.ru»**, затем **«Сгенерировать ответы (все анкеты)»**.

## Как это работает в батче

При обнаружении анкеты скрипт сохраняет вопросы, вызывает `generateAndPersistSuggestedAnswers`, затем при наличии ответов — `tryAutoFillEmployerQuestionnaire` и повторный `completeVacancyResponseForm`. Если DOM не совпал или ответы пустые — exit `5`, карточка остаётся в **Анкете** для ручной доработки.

## Качество ответов

- System prompt ориентирован на **конверсию в приглашение**: факты из резюме, уверенный тон, без «воды».
- **Контекст вакансии:** ответы учитывают роль (ML / DevOps / QA) — не подставляют Docker вместо Python.
- **Few-shot:** после **«Сохранить»** в модалке пары вопрос–ответ (если отличались от черновика) пишутся в `data/questionnaire-user-edits.jsonl` и подмешиваются в следующие генерации.
- **LLM для prose:** при ключе OpenRouter и `HH_QUESTIONNAIRE_LLM_PROSE=1` (по умолчанию) развёрнутые вопросы идут в LLM даже без `HH_QUESTIONNAIRE_LLM=1`.
- **Приоритет:** вакансии с `scoreOverall` ≥ `HH_QUESTIONNAIRE_HIGH_SCORE_MIN` получают чуть более развёрнутые ответы.
- Перед батчем: `reprobe-batch` → `prep-batch`, чтобы не ждать LLM в Playwright на каждой карточке.
- Ложные анкеты (капча «Текст с картинки»): **«Это капча, не анкета»** или `npm run devops:fix-captcha-questionnaires -- --apply`.

См. также [CONFIG.md](CONFIG.md), [DASHBOARD.md](DASHBOARD.md).
