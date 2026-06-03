# Журнал friction (онбординг)

Заполняется после прогона [QUICKSTART.md](QUICKSTART.md) **внешним** или «свежим» тестером.  
Цель: 3+ конкретных боли → Issues / R1.6 / R1.7.

| Дата | Кто (роль) | Шаг QUICKSTART | Что мешало | Предложение | Issue |
|------|------------|----------------|------------|-------------|-------|
| 2026-05-30 | maintainer / `qa:clean-install` | B3 install-portable | Раньше не копировались secrets/profile/resume-routing — setup:check падал | Паритет с `install.ps1` (исправлено в 2.2.x+) | — |
| 2026-05-30 | maintainer / `qa:clean-install` | A3 setup:check | На чистой установке пугает `→ login`, `→ Chromium`, `→ CV/` | Режим `HH_QA_CLEAN=1` для автотеста; в UI/README — «ожидаемо до login» | — |
| 2026-05-30 | maintainer / `qa:clean-install` | A6 devops.env | `HH_PROFILE_RESUME_TITLE` пустой после portable — неочевидно до первого apply | Подсказка в install-portable + FIRST-RUN; wizard в setup (backlog) | — |
| 2026-05-30 | maintainer / Release zip | B1–B2 | Node.js обязателен даже для «portable» zip — не exe-installer | Tauri 3.0 desktop installer (фаза 4 TAURI-PLAN) | R6.1 |
| 2026-05-30 | maintainer / CI smoke | A9 dashboard UI | В headless клик `.card-tile__open` иногда «not visible» | fallback `evaluate(click)` в test-dashboard-ui | — |
| 2026-06-03 | maintainer / `quickstart:gate` | D0 portable | Автопрокси D0→D4 без login; human ≤45 мин — нужен внешний тестер | `npm run quickstart:gate`, issue template onboarding | DS-18 |
| 2026-06-02 | maintainer / plan v3 | D0 empty queue | Пустой список после install — «ничего не работает» | R-04b: demo CTA + install.ps1 + toast | IMPROVEMENT-PLAN |

---

## Шаблон строки

```markdown
| 2026-05-21 | тестер | шаг 4 login | непонятно где сессия | подсказка в install.ps1 | #N |
```

---

## Известные темы (уже в backlog)

См. [issues/BACKLOG.md](issues/BACKLOG.md) и [GitHub Issues](https://github.com/emildg8/HH_Ai/issues).

После заполнения таблицы: `gh issue create` или шаблон «Онбординг / friction» на GitHub.
