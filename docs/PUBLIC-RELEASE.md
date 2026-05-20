# HH Ai 2.0 — релиз для нового пользователя

**Репозиторий:** [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai) · [Вся документация](README.md)

Этот документ для тех, кто получил **публичный архив** ([релиз zip](https://github.com/emildg8/HH_Ai/releases/latest)) или клонировал репозиторий **без** личных данных предыдущего владельца.

## Что внутри архива

- Исходный код (`lib/`, `scripts/`, `dashboard/`)
- Примеры конфигов (`*.example.env`, `config/preferences.json`, `data/vacancies-queue.example.json`)
- Документация (`docs/`, `README.md`, `SECURITY.md`)
- **Нет:** сессии hh.ru, очередей вакансий, CV, API-ключей, hash резюме, логов и скриншотов

## Требования

| Компонент | Версия |
|-----------|--------|
| Node.js | 18+ (LTS) |
| ОС | Windows 10/11, macOS или Linux |
| Диск | ~500 МБ под Chromium |

## Установка за 15–30 минут

### 1. Распаковка

Распакуйте zip в каталог без кириллицы в пути (например `C:\Tools\hh-ai`).

### 2. Зависимости

```powershell
cd C:\Tools\hh-ai
npm install
npx playwright install chromium
```

### 3. Секреты (локально, не в git)

```powershell
copy .env.example .env
copy config\secrets.example.env config\secrets.local.env
copy config\profiles\devops.env.example config\profiles\devops.env
```

Отредактируйте:

| Файл | Что указать |
|------|-------------|
| `config/secrets.local.env` | `OPENROUTER_API_KEY` (или свой LLM — см. `.env.example`) |
| `config/profiles/devops.env` | `HH_PROFILE_RESUME_TITLE`, при необходимости `HH_PROFILE_RESUME_HASH` |
| `config/cover-letter.example.txt` → `config/cover-letter.txt` | Шаблон сопроводительного (по желанию) |

Ключи и hash **никому не отправляйте** вместе с zip.

### 4. Резюме на hh.ru

```bash
npm run login
npm run devops:list-resumes
```

Скопируйте hash нужного резюме в `HH_PROFILE_RESUME_HASH` в профиле.

### 5. CV (опционально)

Положите PDF или текст резюме в папку `CV/` — для LLM-оценки и писем.

### 6. Дашборд

В **отдельном** терминале:

```bash
npm run dashboard
```

Браузер: http://127.0.0.1:3849

## Основные сценарии 2.0

### Сбор вакансий

```bash
npm run harvest
# или для профиля DevOps:
npm run devops:harvest
```

В `config/preferences.json` — фильтры ролей; в профиле — `HH_SEARCH_EXCLUDE_TOKENS`, `HH_LOCAL_SCORE_MIN`.

### Массовый отклик

В дашборде выберите область **«Без анкет»** для батча без остановки на анкетах.

```bash
npm run devops:apply-batch
```

Журнал: `data/hh-apply-chat.log` — строки `[batch] Пропуск …: не выбрано резюме «DevOps»` или `анкета: N вопр.`

### Анкета работодателя

Вакансии с анкетой попадают в раздел **«Анкета»**. Заполните ответы в дашборде → **Сохранить** → отклик вручную или через кнопку отклика на карточке.

### Капча

Если hh.ru показывает проверку — решите её в том же окне Chromium. Скрипт ждёт до `HH_CAPTCHA_WAIT_MS` (по умолчанию 10 минут).

## Проверка установки

```bash
npm run verify:local
```

С дашбордом: `npm run verify:local -- --start-dashboard`

## Обновление с 1.x

1. Сохраните локально: `data/`, `config/profiles/*.env`, `CV/`, `.env` (не кладите в git).
2. Распакуйте новый zip поверх или в новую папку и перенесите эти каталоги.
3. Сравните `config/preferences.json` с примером из релиза — добавьте новые поля вручную.
4. `npm install` и `npm run dashboard`.

## Что нельзя публиковать

См. [SECURITY.md](../SECURITY.md): сессия браузера, ключи API, личные очереди, полные zip из `npm run release:pack`.

## Сборка публичного архива (для maintainer)

```bash
npm run release:public
```

Результат: `dist/hh-ai-public/` и `releases/hh-ai-public-v2.0.0.zip`.

## Лицензия

MIT. Основной проект: [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai). Идея-основа — [ATTRIBUTION.md](ATTRIBUTION.md).
