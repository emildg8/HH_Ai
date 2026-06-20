# Быстрый старт — 5 шагов

От нуля до первого осмысленного действия в дашборде.

## 1. Установка

**Windows (git):**

```powershell
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

**Windows (zip с Releases):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1
start-dashboard.bat
```

**macOS / Linux:**

```bash
bash scripts/install.sh
```

## 2. Профиль резюме

Откройте `config/profiles/devops.env` и задайте:

```env
HH_PROFILE_RESUME_TITLE=Точное название резюме на hh.ru
```

## 3. Вход на hh.ru

```powershell
npm run login
```

В открывшемся Chromium войдите в свой аккаунт. Сессия сохраняется в `data/session/` (не передавайте эту папку другим).

## 4. Дашборд

```powershell
npm run dashboard
```

Откройте http://127.0.0.1:3849

**Демо:** если не готовы к login — используйте 5 демо-вакансий (подгружаются при install).

## 5. Первое действие

| Цель | Действие |
|------|----------|
| Посмотреть воронку | откройте вакансию из очереди → drawer |
| Собрать вакансии | `npm run harvest` или кнопка в дашборде |
| Откликнуться | подготовьте письмо → батч (см. настройки «Отклики») |

## Нейросеть (опционально)

По умолчанию после install — **режим без LLM** (локальная оценка).

Подключение OpenRouter или Ollama: [CONFIG-GUIDE.md](CONFIG-GUIDE.md)

## Проблемы

```powershell
npm run setup:check
```

Подробнее: [SECURITY.md](../SECURITY.md) в корне репозитория.

## Документация

- [FIRST-RUN.md](FIRST-RUN.md) — минимум настроек
- [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md) — передача zip другому человеку
- [README.md](README.md) — оглавление
