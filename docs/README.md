# Документация HH Ai

**Версия:** 2.0.0 · **Репозиторий:** [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)

HH Ai — локальная автоматизация откликов на [hh.ru](https://hh.ru): сбор вакансий, LLM-оценка, сопроводительные письма, дашборд, батч-отклики, анкеты работодателя (Playwright + Node.js).

> Идея-основа: [Steev193/hh-ru-apply](https://github.com/Steev193/hh-ru-apply) (MIT). Проект переработан и развивается отдельно — см. [ATTRIBUTION.md](ATTRIBUTION.md).

---

## С чего начать

| Вы | Документ |
|----|----------|
| **Новый пользователь** | **[QUICKSTART.md](QUICKSTART.md)** ← начните здесь |
| **Настройка LLM и профиля** | **[CONFIG-GUIDE.md](CONFIG-GUIDE.md)** |
| Zip без git | [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md) |
| Установка | [SETUP.md](SETUP.md) |
| Полный цикл | [USAGE.md](USAGE.md) |

```bash
git clone https://github.com/emildg8/HH_Ai.git
cd HH_Ai
git checkout HH_Ai   # основная ветка разработки
npm install
npx playwright install chromium
```

Или [релиз zip](https://github.com/emildg8/HH_Ai/releases/latest) без git.

---

## Руководства по функциям

| Документ | Содержание |
|----------|------------|
| [DASHBOARD.md](DASHBOARD.md) | Вкладки, анкета, письма, UI, батч из UI |
| [BATCH.md](BATCH.md) | Массовый отклик, области, пропуски, лимиты |
| [CONFIG.md](CONFIG.md) | `.env`, профили, `preferences.json`, секреты |
| [USAGE.md](USAGE.md) | Сбор → оценка → письма → отклик (полный цикл) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Капча, резюме, селекторы, логи |

---

## Разработка и релизы

| Документ | Содержание |
|----------|------------|
| [GITHUB.md](GITHUB.md) | Ветки, push, Releases (только emildg8/HH_Ai) |
| [ROADMAP.md](ROADMAP.md) | План версий и фич |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | PR, проверки, стиль коммитов |
| [../SECURITY.md](../SECURITY.md) | Секреты, что не коммитить |
| [../CHANGELOG.md](../CHANGELOG.md) | История версий |

---

## Конфигурация LLM

| Документ | Содержание |
|----------|------------|
| [../config/OPENROUTER.md](../config/OPENROUTER.md) | OpenRouter, модели, лимиты |
| [../.env.example](../.env.example) | Все переменные окружения (шаблон) |

---

## Прочее

| Документ | Содержание |
|----------|------------|
| [ATTRIBUTION.md](ATTRIBUTION.md) | Идея-основа и лицензия |
| [TRANSFER-RU.md](TRANSFER-RU.md) | Кратко: передача другому человеку |
| [CONTINUATION.md](CONTINUATION.md) | Чекпоинт сессии разработки (локально) |
| [demo/vacancies-demo.json](demo/vacancies-demo.json) | Демо-очередь для скриншотов |
| [screenshots/](screenshots/) | Скриншоты интерфейса |

---

## Структура репозитория

```
HH_Ai/
├── dashboard/public/   # UI дашборда
├── lib/                # Playwright, LLM, фильтры, анкета
├── scripts/            # CLI и сервер дашборда
├── config/             # preferences, профили (*.example.env)
├── docs/               # эта папка
├── data/               # очередь, сессия (не в git)
└── CV/                 # резюме (не в git)
```
