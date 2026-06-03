# Handoff: модалка «Настройки» дашборда

**Дата снимка:** 2026-06-02 · **Версия плана:** 4.1.0 (финализировано + polish)  
**Для нового агента:** прочитай этот файл + [SETTINGS-MODAL-PLAN.md](SETTINGS-MODAL-PLAN.md) + skill `.cursor/skills/hh-ru-apply-workflow/SKILL.md`

---

## Что это

Единый центр настроек HH Ai (дашборд `:3849`): **5 вкладок**, автосохранение в `config/preferences.json`, раскладка окна в `localStorage`, deep link, быстрые сценарии, связь с precheck и карточками («Почему?» → таргетинг).

**Не коммитить** без явной просьбы пользователя; в репо много локального `data/`, `config/` — не трогать.

**Браузер:** не убивать все `chrome.exe`; только процесс на порту дашборда (3849). Профиль Playwright: `data/session/chromium-profile/`.

---

## Архитектура (файлы)

| Файл | Назначение |
|------|------------|
| `dashboard/public/index.html` | Разметка `#settings-modal`, toolbar, вкладки, панели |
| `dashboard/public/settings-modal.mjs` | Вкладки, пресеты писем/таргетинга, dirty-state, URL, сводка, API save |
| `dashboard/public/settings-modal-layout.mjs` | Размер окна, полноэкран, пресеты compact/standard/wide/fullscreen |
| `dashboard/public/settings-targeting-nav.mjs` | Reject-категория → `hh-open-settings` (+ layout wide) |
| `dashboard/public/app.js` | `openDashboardSettings()`, save debounce, палитра Ctrl+K |
| `dashboard/public/dashboard-v4.css` | Стили v4 модалки (cache-bust: `?v=20260602settings-polish`) |
| `lib/dashboard-preferences.mjs` | `DASHBOARD_PREF_KEYS`, export/import sanitize |
| `scripts/dashboard-server.mjs` | API: preferences, system-status, reject-stats, apply-preview |
| `docs/SETTINGS-MODAL-PLAN.md` | Полный план фаз S0–S19 |
| `lib/dashboard-static-check.mjs` | JSDoc, DOM-контракт, проверка app.js |
| `scripts/check-dashboard-modules.mjs` | `npm run check:dashboard` |

**Регресс 2026-06:** JSDoc перед `initSettingsModal` без `*/` — модуль не грузился, кнопка «Настройки» молчала. Ловится `check:dashboard` + unit.

---

## Вкладки (Alt+1 … Alt+5)

| Alt | ID | Содержание |
|-----|-----|------------|
| 1 | `system` | Профиль, готовность, Playwright, экспорт/импорт prefs |
| 2 | `targeting` | Пресеты, reject-stats, удалёнка, зарплата, исключения |
| 3 | `apply` | Порог, серия, лимиты hh, превью порога |
| 4 | `letters` | Пресеты писем, FP, обучение, hub-снимок |
| 5 | `appearance` | Фильтры, панели, тема; карточка «Окно» (чекбокс + «К пресетам») |

По умолчанию при открытии: `system` (или `sessionStorage` `hh-settings-tab`).

---

## Раскладка окна (S19 + polish)

**Панель `settings-toolbar`:** слева «Быстро», справа «Окно» (пресеты). На `<640px` пресеты скрыты — только в карточке «Интерфейс».

| Пресет | ~размер | Когда |
|--------|---------|--------|
| compact | 448×560 | Quick path «Лимиты» |
| standard | CSS default | Сброс ↺ |
| wide | 960×720 | Батч, таргетинг, «Почему?» |
| fullscreen | viewport | Alt+F, dblclick по заголовку |

**localStorage ключи:**
- `hh-settings-modal-size` — `{ w, h }`
- `hh-settings-modal-layout-preset` — `compact|standard|wide|fullscreen|custom`
- `hh-settings-modal-fullscreen` — `0|1`
- `hh-settings-modal-open-fullscreen` — открывать всегда на весь экран

**Экспорты из `settings-modal-layout.mjs`:**  
`applySettingsLayoutPreset`, `applySettingsOpenLayout`, `toggleSettingsModalFullscreen`, `resetSettingsDialogSize`, `resetSettingsModalLayout`, `focusSettingsLayoutBar`, `syncSettingsDialogLayoutOnOpen`.

**Сброс UI:** кнопка «Всё: фильтры + панели + тема» → `resetSettingsModalLayout()` при `includeLocalVisual`.

---

## Быстрые сценарии (`SETTINGS_QUICK_PATHS`)

```js
batch:        { tab: 'letters',   focus: 'settings-letters-presets', layout: 'wide' }
off-target:   { tab: 'targeting', focus: 'settings-targeting-insights', layout: 'wide' }
limits:       { tab: 'apply',     focus: 'settings-limits-hh', layout: 'compact' }
profile:      { tab: 'system',    focus: 'settings-profile-card' }
```

---

## Deep link

```
?settings=letters&focus=fp
?settings=targeting&settingsLayout=wide
```

Парсинг: `parseSettingsFromLocation()` в `settings-modal.mjs`.  
Алиасы focus: `SETTINGS_FOCUS_ALIASES` (в т.ч. `layout` → `#settings-layout-bar`).

Событие: `hh-open-settings` с `{ tab, focus, layout }` — слушатель в `app.js`.

---

## Dirty-state и сохранение

- Debounce 500 ms → `POST /api/preferences/save`
- «Сохранить сейчас» — flush
- `tryCloseSettingsModal()` — confirm при dirty
- Классы: `settings-dialog--dirty`, `settings-dialog--saving`

---

## Тесты

```bash
npm run dashboard   # :3849
# Ctrl+F5

npm run check:dashboard
npm run quality:dashboard
npm run test:dashboard-settings   # Playwright: пресеты, save, deep link, layout, 5 вкладок
node scripts/test-settings-apply-preview.mjs
node scripts/test-dashboard-preferences.mjs
```

E2E требует загруженный список вакансий (`gotoDashboardReady`, таймаут 45s).

---

## Backlog (не сделано)

- Индикатор dirty на вкладках
- Общий `modal-layout.mjs` для воронки / журнала откликов
- Импорт JSON писем из textarea (экспорт prefs уже есть)
- Онбординг скрывать после первого успешного батча

---

## Промпт для нового чата (скопировать)

```
Продолжай работу над модалкой «Настройки» HH Ai (дашборд).

Прочитай:
- docs/HANDOFF-SETTINGS-MODAL.md
- docs/SETTINGS-MODAL-PLAN.md
- .cursor/skills/hh-ru-apply-workflow/SKILL.md

Ключевые файлы: settings-modal.mjs, settings-modal-layout.mjs, index.html (#settings-modal), dashboard-v4.css, app.js (openDashboardSettings).

Сделано: 5 вкладок, dirty-state, deep link, пресеты писем/таргетинга, раскладка окна (compact/standard/wide/fullscreen), toolbar «Быстро|Окно», polish UI.

Не коммить без запроса. Не убивать все процессы Chrome.
```

---

## История сессии (кратко)

1. Расширение модалки до 5 вкладок (system, targeting, apply, letters, appearance).
2. Resize + fullscreen окна настроек.
3. S19: пресеты раскладки, `settings-modal-layout.mjs`, контекстное открытие.
4. Финализация: docs 4.1.0, E2E расширен, `resetSettingsModalLayout`.
5. Polish: единый `settings-toolbar`, убран дубль пресетов в appearance, стили, футер Alt+1–5 / Alt+F.
