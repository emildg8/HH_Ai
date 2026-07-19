# Документация HH Ai

> **Начните здесь (партнёр):** [**GUIDE-PARTNER.md**](GUIDE-PARTNER.md) — как читать всё без путаницы.  
> **Статус проекта:** [**MASTER-ROADMAP.md**](MASTER-ROADMAP.md) → «Где мы».  
> Реестр файлов: [`docs-manifest.json`](docs-manifest.json) · проверка: `npm run test:hygiene`.

---

## Быстрые ссылки

| Нужно | Документ |
|-------|----------|
| Где мы и что дальше | [MASTER-ROADMAP.md](MASTER-ROADMAP.md) |
| План после C2 (L4 / письма / minus) | [WORK-PLAN-C2-FOLLOWUP.md](WORK-PLAN-C2-FOLLOWUP.md) |
| Все фичи | [FEATURE-MAP.md](FEATURE-MAP.md) |
| Воронка (читать в браузере) | [MEGA-PLAN-NORTH-STAR.html](MEGA-PLAN-NORTH-STAR.html) |
| Архитектура кода | [PRODUCT-ANATOMY.md](PRODUCT-ANATOMY.md) |
| Как читать docs целиком | [GUIDE-PARTNER.md](GUIDE-PARTNER.md) |
| Позиционирование кандидата, ЗП, HR | [CANDIDATE-POSITIONING-2026.md](CANDIDATE-POSITIONING-2026.md) |
| Кабинет hh.ru + умный автоотклик (HT.6/7) | [H-PROFILE-ROADMAP.md](H-PROFILE-ROADMAP.md) |
| Цепочка harvest → отклик (DoD корзины) | [APPLY-CHAIN-STABLE.md](APPLY-CHAIN-STABLE.md) |
| Сквозной сценарий корзина→анкета→робот | [APPLY-END-TO-END-PLAYBOOK.md](APPLY-END-TO-END-PLAYBOOK.md) |
| День охоты (оркестратор status/plan) | [HUNT-DAY-ORCHESTRATOR.md](HUNT-DAY-ORCHESTRATOR.md) |
| Робот-рекрутер (chatik после отклика) | [ROBOT-RECRUITER.md](ROBOT-RECRUITER.md) |

---

## 1. Старт (установка и первый запуск)

| Документ | Для кого |
|----------|----------|
| [QUICKSTART.md](QUICKSTART.md) | 5 шагов с нуля |
| [FIRST-RUN.md](FIRST-RUN.md) | минимум настроек (2 мин) |
| [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md) | получатель zip / exe |
| [BETA-TESTER-GUIDE.md](BETA-TESTER-GUIDE.md) | сценарии 15/30/60 мин |
| [CONFIG-GUIDE.md](CONFIG-GUIDE.md) | LLM, профиль, ключи |

---

## 2. Дорожная карта и фичи (канон продукта)

| Документ | Тема |
|----------|------|
| [MASTER-ROADMAP.md](MASTER-ROADMAP.md) | фаза, срезы S0–S12, столпы H/I/P, календарь |
| [FEATURE-MAP.md](FEATURE-MAP.md) | реестр фич × тесты × LLM × M0 |
| [MEGA-PLAN-NORTH-STAR.md](MEGA-PLAN-NORTH-STAR.md) | треки A/B/C в коде, north star |
| [MEGA-PLAN-NORTH-STAR.html](MEGA-PLAN-NORTH-STAR.html) | то же — удобная версия для чтения |
| [SCENARIOS-PLAYBOOK.md](SCENARIOS-PLAYBOOK.md) | «если сломалось» №12–86 |
| [TG-CAPTCHA-HR-PUSH.md](TG-CAPTCHA-HR-PUSH.md) | HR→Telegram push · капча TG (бэклог) · откат |

### Поперечные треки (детали, не дублировать MASTER)

| Документ | Тема |
|----------|------|
| [LLM-ROADMAP.md](LLM-ROADMAP.md) | провайдеры, письма, бюджет, STT |
| [MULTIMODAL-ROADMAP.md](MULTIMODAL-ROADMAP.md) | inventory, evidence, pack |
| [MULTIMODAL-SKILLS-PLAYBOOK.md](MULTIMODAL-SKILLS-PLAYBOOK.md) | протокол SK/M0 для агента |
| [TARGETING-ROADMAP.md](TARGETING-ROADMAP.md) | minus-слова, HT.0–HT.4, UI таргетинга |
| [HYBRID-SOFTNESS.md](HYBRID-SOFTNESS.md) | тиры мягкости гибрида (сортировка, не eligibility) |
| [HH-INGEST-ROADMAP.md](HH-INGEST-ROADMAP.md) | API harvest hh.ru, quota, HI.UI |

---

## 3. Архитектура и стандарты

| Документ | Тема |
|----------|------|
| [PRODUCT-ANATOMY.md](PRODUCT-ANATOMY.md) | слои lib / dashboard / scripts / data |
| [PRODUCT-STANDARDS.md](PRODUCT-STANDARDS.md) | конституция продукта, реестры |
| [APPLY-GATE.md](APPLY-GATE.md) | gate перед откликом |
| [SETTINGS-MODULE.md](SETTINGS-MODULE.md) | модалка «Настройки» |
| [DASHBOARD-DESIGN-TOKENS.md](DASHBOARD-DESIGN-TOKENS.md) | токены UI |
| [INFRA-KNOWLEDGE.md](INFRA-KNOWLEDGE.md) | SQLite knowledge store |
| [OBSERVABILITY.md](OBSERVABILITY.md) | события, метрики |
| [CONVERSION-GLUE.md](CONVERSION-GLUE.md) | glue-события воронки |

---

## 4. Охота и ingest

| Документ | Тема |
|----------|------|
| [SOURCE-EXPERTISE.md](SOURCE-EXPERTISE.md) | источники, ToS, дедуп |
| [INGEST-IMPROVEMENTS.md](INGEST-IMPROVEMENTS.md) | multi-source ingest, бэклог |
| [S1-HUNT-CHECKLIST.md](S1-HUNT-CHECKLIST.md) | чеклист перед точечным ship / hunt-day (не mass apply) |
| [HIRING-OPERATIONS.md](HIRING-OPERATIONS.md) | daily routine, digest |
| [OPS-RHYTHM.md](OPS-RHYTHM.md) | ops-цикл |

---

## 5. HR, рынок, собес

| Документ | Тема |
|----------|------|
| [MARKET-RU-HR-QA.md](MARKET-RU-HR-QA.md) | рынок РФ, конспект HR Q&A |
| [HIRING-HR-PLAYBOOK.md](HIRING-HR-PLAYBOOK.md) | HR-сценарии |
| [HIRING-JOURNEY-UX.md](HIRING-JOURNEY-UX.md) | journey drawer, путь кандидата |
| [COPILOT-FLASH-FULL-PARTNER-CANON.md](COPILOT-FLASH-FULL-PARTNER-CANON.md) | flash/full, аудио RIG, примеры |
| [DEMO-COPILOT-5MIN.md](DEMO-COPILOT-5MIN.md) | демо суфлёра |

---

## 6. Сессии и уроки (не «где мы»)

| Документ | Тема |
|----------|------|
| [LEARNING-LOG.md](LEARNING-LOG.md) | уроки агента |
| [SESSION-INDEX-2026-06.md](SESSION-INDEX-2026-06.md) | хронология июня |
| [HANDOFF-2026-06-20.md](HANDOFF-2026-06-20.md) | последний handoff |
| [HANDOFF-TEMPLATE.md](HANDOFF-TEMPLATE.md) | шаблон handoff |
| [HANDOFF-RESUME-CRUD.md](HANDOFF-RESUME-CRUD.md) | резюме CRUD handoff |

---

## 7. Архив (не открывать без нужды)

| Документ | Статус |
|----------|--------|
| [HANDOFF-2026-06-18.md](HANDOFF-2026-06-18.md) | archive |
| [HANDOFF-2026-06-19.md](HANDOFF-2026-06-19.md) | archive (см. HANDOFF-20) |
| [DASHBOARD-UX-PLAN.md](DASHBOARD-UX-PLAN.md) | archive → ui v8 |

Полный список статусов: [`docs-manifest.json`](docs-manifest.json).

---

## ops/checklists

| Файл | Тема |
|------|------|
| [ops/checklists/interview-before.md](ops/checklists/interview-before.md) | перед собесом |
| [ops/checklists/offer-review.md](ops/checklists/offer-review.md) | оффер |
| [ops/checklists/weekly-patterns.md](ops/checklists/weekly-patterns.md) | еженедельные паттерны |

---

Корень репозитория: [README.md](../README.md) · [CHANGELOG.md](../CHANGELOG.md) · [AGENTS.md](../AGENTS.md) · [SECURITY.md](../SECURITY.md)
