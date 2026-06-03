# Документация HH Ai

**Версия:** 2.0.1 · **Репозиторий:** [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai)

HH Ai — локальная автоматизация откликов на [hh.ru](https://hh.ru): сбор вакансий, LLM-оценка, сопроводительные письма, дашборд, батч-отклики, анкеты работодателя (Playwright + Node.js).

> Идея-основа: [Steev193/hh-ru-apply](https://github.com/Steev193/hh-ru-apply) (MIT). Проект переработан и развивается отдельно — см. [ATTRIBUTION.md](ATTRIBUTION.md).

---

## С чего начать

| Вы | Документ |
|----|----------|
| **Новый пользователь** | **[QUICKSTART.md](QUICKSTART.md)** · минимум настроек: **[FIRST-RUN.md](FIRST-RUN.md)** |
| **Настройка LLM и профиля** | **[CONFIG-GUIDE.md](CONFIG-GUIDE.md)** |
| **Мастер первого запуска** | `npm run setup` |
| Zip без git | [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md) |
| QA чистой установки | [QA-CLEAN-INSTALL.md](QA-CLEAN-INSTALL.md) |
| Мейнтейнер (релиз, Issues) | [MAINTAINER.md](MAINTAINER.md) |
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
| [DASHBOARD.md](DASHBOARD.md) | CRM-вкладки, воронка, поиск, настройки, батч из UI |
| [BATCH.md](BATCH.md) | Массовый отклик, области, пропуски, лимиты |
| [COVER-LETTER-PLAN.md](COVER-LETTER-PLAN.md) | Качество писем, precheck, golden set, CI-тесты |
| [SETTINGS-MODAL-PLAN.md](SETTINGS-MODAL-PLAN.md) | Модалка настроек: 5 вкладок, пресеты, раскладка окна, E2E |
| [HANDOFF-SETTINGS-MODAL.md](HANDOFF-SETTINGS-MODAL.md) | **Снимок для агента** — контекст после перезапуска чата |
| [DEVELOPMENT-PLAN-2026-06.md](DEVELOPMENT-PLAN-2026-06.md) | План QA дашборда / настройки (выполнен) |
| [DEVELOPMENT-PLAN-2026-06-PHASE2.md](DEVELOPMENT-PLAN-2026-06-PHASE2.md) | **План доработок** P0–P8, Tracks 7–10 |
| [PRODUCT-STRATEGY-2026.md](PRODUCT-STRATEGY-2026.md) | **Стратегия** 2026–2027, персоны, release train |
| [DEVELOPMENT-IDEAS.md](DEVELOPMENT-IDEAS.md) | **Идеи развития** — приоритеты, бэклог, порядок работ |
| [DESIGN-ECOSYSTEM-INDEX.md](DESIGN-ECOSYSTEM-INDEX.md) | **UX и дизайн** — индекс планов, карточек, Telegram, desktop |
| [DESIGN-SYSTEM-PLAN-2026-06.md](DESIGN-SYSTEM-PLAN-2026-06.md) | План опыта продукта v3 (6 дорожек, S1–S12) |
| [DASHBOARD-QA-SCORECARD.md](DASHBOARD-QA-SCORECARD.md) | **QA 10/10** — чеклист готовности дашборда |
| [QUEUE-AND-APPLY.md](QUEUE-AND-APPLY.md) | Очередь, статусы отклика, prune, sync |
| [QUESTIONNAIRE-AUTOMATION.md](QUESTIONNAIRE-AUTOMATION.md) | Probe, prep, автозаполнение анкеты |
| [CONFIG.md](CONFIG.md) | `.env`, профили, `preferences.json`, `resume-routing.json` |
| [USAGE.md](USAGE.md) | Сбор → оценка → письма → отклик (полный цикл) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Капча, резюме, URL поиска, селекторы, логи |
| [HIRING-ROADMAP.md](HIRING-ROADMAP.md) | Конверсия, статусы hh, чат, интервью |

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
