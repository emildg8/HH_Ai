# План дизайн-кода HH Ai (UX/UI v3)

**Цель:** любой пользователь за 5 минут понимает «что делать дальше», видит статус системы и не теряется в функциях.

**Принципы:** простота · информативность · предсказуемость · доступность (WCAG 2.1 AA где возможно).

---

## 1. Дизайн-система (Design Tokens)

| Слой | Файл | Содержание |
|------|------|------------|
| Токены | `dashboard/public/design-tokens.css` | цвета, типографика, spacing, radius, shadow, z-index |
| Компоненты | `dashboard/public/design-components.css` | kbd, palette, sparkline, empty-state, toast v2 |
| Оболочка | `dashboard-shell.css` | доки, menubar, sidebar |
| Карточки | `dashboard-cards.css`, `dashboard-card-tiles.css` | vacancy cards |

**Правила:**
- Один источник правды для `--accent`, `--good`, `--warn`, `--bad`
- Шкала отступов: 4 / 8 / 12 / 16 / 24 px (`--space-*`)
- Минимальный touch-target: 36×36 px
- Конtrast ratio текста ≥ 4.5:1

---

## 2. Информационная архитектура

```
Menubar (глобальные действия)
├── Левая панель — «Управление»
│   ├── Онбординг (первые шаги)
│   ├── Статус + лимиты hh
│   ├── Действия (утро / поиск / серия)
│   ├── Разделы очереди
│   ├── Синхронизация
│   └── Фильтры
├── Центр — список вакансий (плитки / карточки)
└── Правая панель — «Сводка»
    ├── Мини-воронка + sparkline 7 дн.
    ├── KPI-сетка
    └── Прогресс задачи
```

**Режимы UI:** `simple` (скрывает expert-панели) · `expert` (полный CRM).

---

## 3. Компоненты (библиотека)

| Компонент | Модуль | Статус |
|-----------|--------|--------|
| Command palette (Ctrl+K) | `command-palette.mjs` | v1 |
| Горячие клавиши | `keyboard-shortcuts.mjs` | v1 |
| Справка по клавишам | modal `#shortcuts-modal` | v1 |
| Экспорт карточки MD | `vacancy-export.mjs` | v1 |
| Daily sparkline | `funnel-timeline.mjs` + KPI | v1 |
| Status chips | `card-status.mjs` | готово |
| Empty states + CTA | `app.js` | готово |
| Toast | `app.js` | готово |
| Модалки | `modals.mjs` | готово |

---

## 4. Фазы реализации

### P0 — «Разобрался за 5 минут» (текущий спринт)

- [x] Design tokens v3
- [x] Command palette + shortcuts help
- [x] Горячие клавиши в модалке письма (approve / decline / save)
- [x] Sparkline откликов за 7 дней в правой панели
- [x] Кнопка «Экспорт MD» на карточке
- [x] План документирован

### P1 — Полировка CRM (2–3 дня)

- [x] Единый `COPY` для всех подписей (RU, без жаргона)
- [x] Контекстные empty states по каждому разделу
- [x] Bulk probe анкет по текущему фильтру (R4.2)
- [x] Breadcrumbs: раздел › фильтр › N карточек
- [x] Focus trap и roving tabindex в списке (j/k, Arrow)

### P2 — Визуальный рефакторинг (1 неделя)

- [x] Разбить `style.css` на модули (иконки → `dashboard-icons.css`, light → `dashboard-light-polish.css`)
- [x] Light theme audit (контраст, borders)
- [x] Анимации: только `transform`/`opacity`, ≤ 200 ms
- [x] Иконки SVG sprite вместо emoji в dock-mini
- [x] Карточка: visual hierarchy (score → title → chips → actions)

### P3 — Продвинутый UX

- [x] A/B выбор письма до approve (R2.5)
- [x] Keyboard nav j/k по списку
- [x] Onboarding wizard (4 шага с прогрессом)
- [ ] Storybook / canvas для компонентов (опционально)

---

## 5. Метрики UX

| Метрика | Как мерить |
|---------|------------|
| Time to first batch | онбординг → первая серия |
| % approve без правок | `coverLetter.metrics.editRatioPct` |
| Использование palette | localStorage counter |
| Ошибки «не понял UI» | субъективно / issues |

---

## 6. Связь с ROADMAP

| ROADMAP | DESIGN-PLAN |
|---------|-------------|
| R4.3 статистика/день | P0 sparkline + funnel modal |
| R4.4 экспорт MD | P0 vacancy-export |
| R4.5 hotkeys | P0 keyboard-shortcuts |
| R4.2 bulk probe | P1 |

---

*Обновлено: 2026-05-29 · версия UI: v3.0.0-alpha*
