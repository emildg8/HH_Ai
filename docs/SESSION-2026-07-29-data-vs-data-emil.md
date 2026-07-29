# Сессия 29.07.2026 — `data/` vs `data-emil` + ночной harvest

## Две разные «не туда»

| Слой | Где должно быть (Эмиль) | Что случилось в ночи 29.07 |
|------|-------------------------|----------------------------|
| Прогресс / pid / `harvest-status` | `data-emil/` (`HH_DATA_DIR`) | Silent watchdog **без** `run-with-instance` → писал в `data/` |
| Живая очередь карточек | `data/vacancies-devops.json` (`HH_VACANCIES_QUEUE_FILE` в `config/profiles/devops.env`) | Карточки **туда и попали** — это канон очереди Emil пока без миграции |

Итог: партнёрский скрин «упали в data вместо data-emil» про **прогресс**; очередь дашборда `:3849` читает тот же `data/vacancies-devops.json`. Путать нельзя.

## Фикс уже в коде

- `scripts/run-harvest-watchdog-bg.mjs` → всегда `run-with-instance --instance=emil` (или anastasia)
- `scripts/nightly-harvest.ps1` → лог в `data-emil/logs`
- `scripts/install-nightly-harvest-task.ps1` → путь лога `data-emil`

## Ночной мусор (+1354 / 530 «ночных» в очереди)

В `data/harvest-progress.json`: `skippedTitle: 0` при 3301 URL — отсев по заголовку не сработал / не применялся в том прогоне. Выборка ночи: ~1 target-like, ~130 явный junk, остальное «инженеры» не IT (механики, прорабы, зерно, ДВС…).

**Не слать** из ночной порции вслепую. Охота сегодня — из assess go, не из «+1354».

## Что ещё сделать (бэклог, не блокер откликов)

1. Тест/гард: silent entry без instance → fail.
2. Алерт: `skippedTitle===0` при `urlsTotal>500` → warning в TG.
3. Долго: перенести `HH_VACANCIES_QUEUE_FILE` под `data-emil/` одной миграцией (сейчас сознательный dual-path — см. `HUNT-APPLY-AUTOMATION-PLAN.md`).
4. Пометить/отложить junk ночи в очереди (не merge в «чистый» data-emil).

## Сегодня отклики

Канон: `s1-preflight` ✅ → `hunt-day assess` → prep → ship `--go --only=`.

Go (письма уже есть): MERLION TECH · Код Безопасности · Плати по миру · МИР ВЕНДИНГА.  
Не слать без GO: СПб-гибрид (МиАТел-класс), K8s-hard, «эксплуатация недвижимости», алготрейдинг.
