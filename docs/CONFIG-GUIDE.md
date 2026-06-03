# Настройка HH Ai — простым языком

**Версия:** 2.0.1 · Сначала: [QUICKSTART.md](QUICKSTART.md)

Здесь — **какие файлы править**, **три режима LLM** и **как «научить» модель** вашему стилю и резюме.

---

## Карта файлов (что где лежит)

| Файл | Зачем | Обязательно? |
|------|-------|--------------|
| `config/secrets.local.env` | API-ключи (OpenRouter) или адрес Ollama | Нет* |
| `config/profiles/<роль>.env` | Поиск, резюме на hh.ru, лимиты LLM | Да |
| `config/preferences.json` | ЗП, удалёнка, фильтры «не DevOps» | Да (можно не трогать) |
| `config/cover-letter.txt` | Шаблоны сопроводительных | Для писем LLM |
| `config/cover-letter-style-examples.txt` | Ваш тон письма (эталоны) | Опционально |
| `CV/` | Резюме для оценки и писем | Для LLM — желательно |
| `config/search-keywords*.txt` | Запросы на hh.ru | Да |

\* Без LLM harvest работает в режиме **локальной оценки** по ключевым словам.

Проверка «что ещё не настроено»:

```bash
npm run setup:check
```

---

## Шаг 1. Выберите режим LLM

Скопируйте **один** блок в `config/secrets.local.env` (файл создаётся при `install.ps1`).

Готовые фрагменты лежат в [`config/presets/`](../config/presets/README.md).

### A. Без LLM — только локальная оценка (бесплатно)

Ничего не добавляйте в `secrets.local.env`. В профиле:

```env
HH_SCORE_MODE=local-first
HH_LLM_MAX_PER_RUN=0
```

Harvest соберёт вакансии и поставит **примерный** балл по словам DevOps + вашему CV (если есть в `CV/`).

### B. OpenRouter — бесплатные модели (рекомендуется для старта)

1. Ключ на [openrouter.ai](https://openrouter.ai) → `config/secrets.local.env`:

```env
OpenRouter_API_KEY=sk-or-v1-ВАШ_КЛЮЧ
OPENROUTER_MODEL=openrouter/free
```

2. В профиле (`config/profiles/devops.env`):

```env
HH_LLM_MAX_PER_RUN=30
HH_OPENROUTER_MAX_CALLS_PER_RUN=30
```

Подробнее: [config/OPENROUTER.md](../config/OPENROUTER.md).

### C. Свой LLM — Ollama / LM Studio (полностью локально)

```env
HH_CUSTOM_LLM_BASE_URL=http://127.0.0.1:11434/v1
HH_CUSTOM_LLM_MODEL=llama3.2
HH_OPENROUTER_MAX_CALLS_PER_RUN=0
```

Установите Ollama, затем: `ollama pull llama3.2`

---

## Шаг 2. Профиль вакансий (не только DevOps)

По умолчанию — **DevOps**. Свой профиль:

```bash
npm run profile:init -- --id=backend --title="Backend Developer"
```

Создастся `config/profiles/backend.env` и файл ключевых слов.

Запуск с профилем:

```powershell
# Windows — на сессию терминала
$env:HH_PROFILE="backend"
npm run harvest
npm run dashboard
```

Или пропишите в `.env`:

```env
HH_PROFILE=backend
```

| Поле в профиле | Что указать |
|----------------|-------------|
| `HH_PROFILE_RESUME_TITLE` | **Точное** название резюме на hh.ru |
| `HH_PROFILE_RESUME_HASH` | Из `npm run devops:list-resumes` (надёжнее) |
| `HH_KEYWORDS_FILE` | Файл запросов поиска |
| `HH_SEARCH_PERIOD` | `1` сутки, `7` неделя, `0` всё время |
| `HH_SEARCH_EXCLUDE_TOKENS` | Минус-слова в URL hh.ru |
| `HH_LLM_MAX_PER_RUN` | Сколько LLM-оценок за один harvest |

Фильтры зарплаты и «не разработчик» — в **`config/preferences.json`** (редактируется и из дашборда).

### Батч и качество писем (дашборд → Настройки)

| Ключ | По умолчанию | Смысл |
|------|--------------|--------|
| `batchAutoPrepareLetters` | вкл. | Перед батчем: «Подготовить» fixable без LLM |
| `batchFalsePositiveMax` | 20 | Предупреждение, если много «Неподходит» при eligible таргетинге |
| `learningAutoApplyPatterns` | выкл. | Авто-правила из повторяющихся FP (count ≥ 3) |

Подробнее: [COVER-LETTER-PLAN.md](COVER-LETTER-PLAN.md), [BATCH.md](BATCH.md).

---

## Шаг 3. Резюме на hh.ru

```bash
npm run login
npm run devops:list-resumes
```

Скопируйте **hash** нужного резюме в профиль:

```env
HH_PROFILE_RESUME_TITLE=DevOps
HH_PROFILE_RESUME_HASH=806e0f3a...
```

Без hash скрипт ищет резюме по подстроке в названии — иногда промахивается.

---

## Шаг 4. «Научить» LLM — оценка и письма

Модель не знает вас «из коробки». Контекст берётся из **ваших файлов**:

### Оценка вакансий (harvest)

| Источник | Где |
|----------|-----|
| Текст резюме | `CV/*.md`, `*.txt`, `*.pdf` |
| Вес «вакансия vs CV» | `preferences.json` → `llmScoreWeights` |

Положите **одно** основное резюме в `CV/` — см. [CV.md](CV.md).

### Сопроводительные письма

| Способ | Как |
|--------|-----|
| **Шаблоны** | `config/cover-letter.txt` (из `cover-letter.example.txt`) |
| **Эталоны стиля** | `config/cover-letter-style-examples.txt` — блоки через `---` на отдельной строке |
| **Авто-обучение** | В дашборде **Утвердить** письмо → оно попадает в контекст следующих генераций |
| **Правки** | Редактируете письмо в UI → сохраняется в `data/cover-letter-user-edits.jsonl` |

Создать файл эталонов:

```powershell
copy config\cover-letter-style-examples.example.txt config\cover-letter-style-examples.txt
```

Напишите 2–3 **своих** коротких письма (без контактов в git — файл в `.gitignore`).

### Анкета работодателя

По умолчанию ответы из **CV/** (без LLM). Для генерации через LLM в `.env`:

```env
HH_QUESTIONNAIRE_LLM=1
```

---

## Шаг 5. Частые настройки

| Задача | Где |
|--------|-----|
| Мин. зарплата 200k, только удалёнка | `preferences.json` → `minMonthlyRub`, `requireRemote` |
| Убрать Senior / Python / QA из выдачи | `preferences.json` + `HH_SEARCH_EXCLUDE_TOKENS` |
| Меньше LLM-запросов за прогон | `HH_LLM_MAX_PER_RUN=10` в профиле |
| Порт дашборда | `.env` → `DASHBOARD_PORT=3849` |
| Платные модели OpenRouter | `OPENROUTER_ALLOW_PAID=1` + модель без `:free` |

---

## Чеклист перед первым harvest

```bash
npm run setup:check
npm run login
npm run dashboard
```

В дашборде: **Сбор вакансий** → дождаться записей → утвердить письма для топ-скора → батч **«Без анкет»**.

---

## Справка

| Документ | Содержание |
|----------|------------|
| [CONFIG.md](CONFIG.md) | Все переменные окружения |
| [OPENROUTER.md](../config/OPENROUTER.md) | Модели, лимиты, Ollama |
| [BATCH.md](BATCH.md) | Массовый отклик |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Ошибки |
