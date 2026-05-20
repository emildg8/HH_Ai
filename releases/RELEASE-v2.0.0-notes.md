## HH Ai 2.0.0

Локальная автоматизация откликов на hh.ru — **готово к использованию из коробки**.

### Установка (3 команды)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
npm run login
npm run dashboard
```

Подробно: [docs/QUICKSTART.md](https://github.com/emildg8/HH_Ai/blob/main/docs/QUICKSTART.md)

### Главное

- **Дашборд** — очередь, LLM-письма, анкета, батч
- **Батч «Без анкет»** — анкета откладывается (код `5`), батч не останавливается
- **Публичный zip** — без сессий, ключей, CV и личных данных

### Скриншоты

См. [README](https://github.com/emildg8/HH_Ai#hh-ai--локальный-помощник-откликов-на-hhru) — демо-интерфейс без реальных вакансий.

### Скачать

**[hh-ai-public-v2.0.0.zip](https://github.com/emildg8/HH_Ai/releases/download/v2.0.0/hh-ai-public-v2.0.0.zip)**

Полный changelog: [CHANGELOG.md](https://github.com/emildg8/HH_Ai/blob/main/CHANGELOG.md).
