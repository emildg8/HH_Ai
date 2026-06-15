# Дашборд — design tokens (source / tier / applyMode)

Токены в `dashboard/public/design-tokens.css`, компоненты в `design-components.css`.

## Источники (`--source-*`)

| Token | Цвет | Класс |
|-------|------|-------|
| `--source-hh` | #0a84ff | `.source-badge--hh` |
| `--source-habr` | #6c5ce7 | `.source-badge--habr` |
| `--source-telegram` | #2aabee | `.source-badge--telegram` |
| `--source-ats` | #30d158 | `.source-badge--ats` |
| `--source-jobboard` | #ff9f0a | `.source-badge--jobboard` |

## Tier (`--tier-*`)

| Tier | Token | Класс |
|------|-------|-------|
| A | `--tier-a` → `--ds-good` | `.tier-badge--A` |
| B | `--tier-b` → `--ds-accent` | `.tier-badge--B` |
| C | `--tier-c` → `--ds-warn` | `.tier-badge--C` |
| D | `--tier-d` | `.tier-badge--D` |

## Режим отклика

| Режим | Класс |
|-------|-------|
| hh авто | `.apply-mode--auto` |
| ручная ссылка | `.apply-mode--manual` |
| ATS форма | `.apply-mode--ats` |

## Слои CSS (порядок в index.html)

1. `style.css` — legacy layout, карточки, переменные темы
2. **`design-tokens.css`** — канон: цвета `--ds-*`, `--hh-*`, spacing, radius, **шрифты**
3. **`design-foundation.css`** — единый `font-family` на `html`, `body`, кнопках, модалках
4. `design-components.css` — бейджи, palette, kbd
5. `dashboard-unify.css` + `dashboard-controls-polish.css` — v4 shell

## Шрифты

- **Канон:** `--font-ui` (`Segoe UI` / system-ui) и `--font-mono` для кода.
- **Корень:** `--ds-root-size: 14px` на `html` (вся шкала `rem` согласована).
- **Веса:** `--font-weight-normal` (500), `--font-weight-semibold` (600), `--font-weight-bold` (650).
- **Размеры:** `--text-xs` … `--text-xl` — использовать вместо «магических» `0.72rem`.
- **Глобально:** `--font: var(--font-ui)`; модалки и тосты наследуют тот же шрифт через `design-foundation.css`.

## JS

`dashboard/public/source-badges.mjs` — единые бейджи для карточек, плиток и top-tier списка.

## Intelligence

`.funnel-mini--sources` — chips по источникам и мини-бары tier (KPI панель справа).
