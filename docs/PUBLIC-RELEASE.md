# Публичный релиз HH Ai

Инструкция для **получателя** архива (zip или GitHub Release) — без доступа к исходному компьютеру отправителя.

## Что внутри архива

| Есть | Нет (намеренно) |
|------|-----------------|
| Код, дашборд, скрипты | Сессия hh.ru отправителя |
| Примеры конфигов (`*.example`) | API-ключи и `secrets.local.env` |
| Демо-очередь (5 вакансий) | Реальные отклики и переписки |
| Документация на русском | Папка `CV/` с резюме |

**Ваши данные остаются на вашем ПК.**

## Требования

- **Windows 10+** (основной путь; macOS/Linux — `install.sh`)
- **Node.js 20 LTS** или новее
- ~2 ГБ места (Chromium Playwright)
- Свой аккаунт **hh.ru** — только если будете реальные отклики

## Установка (Windows, zip)

1. Распакуйте архив в папку **без кириллицы** в пути, например `C:\Tools\hh-ai`.
2. PowerShell:

```powershell
cd C:\Tools\hh-ai
powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1
```

3. Запуск:

```powershell
start-dashboard.bat
```

→ http://127.0.0.1:3849

## Первые 15 минут (без hh.ru)

1. Откройте дашборд — в очереди **5 демо-вакансий**.
2. Кликните вакансию → посмотрите карточку и оценку.
3. Откройте **Настройки** (шестерёнка) — обзор разделов.
4. Вкладка «Чаты» / inbox — демо-переписки (приглашение, вопрос, отказ).

Реальный hh.ru **не нужен** для этого шага.

## Подключение своего hh.ru (опционально)

1. `config/profiles/devops.env` — укажите `HH_PROFILE_RESUME_TITLE`.
2. `npm run login` — войдите **своим** аккаунтом.
3. Осторожно с батч-откликами — начните с одной вакансии.

## Режим без нейросети

После install по умолчанию включён preset **no-llm** — платные API не требуются.

Подключить LLM: [CONFIG-GUIDE.md](CONFIG-GUIDE.md)

## Desktop-приложение

Альтернатива zip: установщик `HH-Ai_*-setup.exe` с [Releases](https://github.com/emildg8/HH_Ai/releases/latest) — дашборд без ручного `npm run dashboard`.

## Безопасность

- Не публикуйте `config/secrets.local.env` и `data/session/`.
- Автоотклики могут противоречить правилам hh.ru — используйте умеренно.
- См. [SECURITY.md](../SECURITY.md)

## Обратная связь

- Ошибки и идеи: [GitHub Issues](https://github.com/emildg8/HH_Ai/issues)
- Сценарии для тестеров: [BETA-TESTER-GUIDE.md](BETA-TESTER-GUIDE.md)

## Лицензия

MIT — см. `LICENSE` в корне архива.
