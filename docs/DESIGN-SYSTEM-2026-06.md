# Дизайн-система HH Ai (дашборд)

**Статус:** DS-A внедрена (`--hh-*`, lint hex, `DASHBOARD_STYLE_VERSION` 3.0.0)  
**План v3.0 (6 дорожек, весь продукт):** [DESIGN-SYSTEM-PLAN-2026-06.md](DESIGN-SYSTEM-PLAN-2026-06.md) · [DESIGN-ECOSYSTEM-INDEX.md](DESIGN-ECOSYSTEM-INDEX.md)  
**Связано:** [USER-UX-PLAN-2026-06.md](USER-UX-PLAN-2026-06.md) · [CARD-DESIGN-SYSTEM.md](CARD-DESIGN-SYSTEM.md) · [DASHBOARD-QA-SCORECARD.md](DASHBOARD-QA-SCORECARD.md)

## Цель

Один визуальный язык: те же поверхности, отступы, радиусы, кнопки и типографика в шапке, доках, списке, настройках и модалках.

## Слои CSS (порядок в `index.html`)

| # | Файл | Роль |
|---|------|------|
| 1 | `style.css` | База, карточки очереди, legacy-переменные |
| 2 | `design-tokens.css` | **Источник истины:** `--space-*`, `--ds-*`, `--ui-*`, `--hh-*` |
| 3 | `design-components.css` | Палитра команд, kbd, shortcuts |
| 4 | `dashboard-shell.css` | Доки, menubar (legacy grid) |
| 5 | `dashboard-cards*.css` | Карточки вакансий |
| 6 | `dashboard-v4.css` | Workflow, v4 chrome, настройки |
| 7 | `dashboard-unify.css` | **Выравнивание + общий стиль** (последний) |

## Токены (кратко)

| Группа | Переменные | Назначение |
|--------|------------|------------|
| Отступы | `--space-1` … `--space-6`, `--ui-gap-*` | Сетка 4px |
| Радиусы | `--radius-sm/md/lg` | 6 / 10 / 14 px |
| Типографика | `--text-xs/sm/base/lg` | Подписи / тело / заголовки |
| Цвета | `--ds-accent/good/warn/bad` | Семантика |
| Поверхности | `--ui-canvas`, `--ui-surface`, `--ui-tile` | Фон / блок / плитка |
| Панели | `--hh-panel-*` | Единый «карточный» блок |

В scope `.workspace-shell--v4` legacy `--accent`, `--bg-*`, `--border` **переопределяются** из `--ds-*` / `--ui-*`.

## Компоненты (единый вид)

| Компонент | Правило |
|-----------|---------|
| Блок дока / настройки | `surface elevated`: border + `--radius-md` + padding `--hh-panel-pad` |
| Плитка / кнопка шага / метрика | `surface tile`: `--ui-tile`, `--radius-sm` |
| Кнопка primary | `--ds-accent`, без лишних границ |
| Кнопка secondary | `--ui-tile` + border |
| Кнопка ghost | прозрачный фон, hover → tile |
| Seg / пресеты | общий «капсульный» трек, active = `--ds-accent-muted` |
| Поля ввода | высота `--ui-control-h`, фон tile, focus accent |
| Модалка | `--ui-surface`, `--radius-lg`, `--shadow-overlay` |

## Типографика (4 уровня)

1. **Caption** (`--text-xs`, muted) — подписи секций, hints  
2. **Body** (`--text-sm`) — статус, описания, списки  
3. **Title** (`--text-sm`, weight 650) — заголовки карточек и модалок  
4. **Display** (`--text-lg`) — редко, заголовок модалки

## Проверка

```bash
npm run check:dashboard
```

После правок CSS: **Ctrl+F5** (`dashboard-v4.css` + `dashboard-unify.css` + `design-tokens.css` с одним `?v=`).

## Backlog (кратко)

| Фаза | Спринт | Статус |
|------|--------|--------|
| A — целостность (карточки, light, lint) | S1–S2 | [ ] |
| B — паттерны (empty, status strip) | S2–S3 | [ ] |
| C — продукт (workflow, превью, hub) | S3–S5 | [ ] |
| D — CI (скрины, a11y, STYLE_VERSION) | S6+ | [ ] |

Детали: [DESIGN-SYSTEM-PLAN-2026-06.md](DESIGN-SYSTEM-PLAN-2026-06.md) · ID **DS-01…10** в [DEVELOPMENT-IDEAS.md](DEVELOPMENT-IDEAS.md) §8.
