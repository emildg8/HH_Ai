# Модуль «Настройки» дашборда

Единая модалка с боковой навигацией (9 зон), автосохранением и API `GET/PATCH /api/settings`.

## Зоны

| Вкладка | Содержимое |
|---------|------------|
| Система | Профиль, браузер Playwright, здоровье сервисов |
| Сбор | Лимиты ingest, веса LLM-скоринга |
| Таргетинг | Удалёнка, зарплаты, исключения ролей, инсайты |
| Отклики | Порог «Авто», размер серии, лимиты hh, **PreApplyGate** и пресеты конверсии |
| Письма | Автоподготовка, ложные отказы, пресеты качества |
| Суфлёр | Устройства, этап собеса, сценарии (HR / техничка / финал) |
| Интерфейс | Режим simple/expert, панели, тема |
| Сервисы | Статус Telegram, Ollama, сессии (только чтение) |
| Эксперт | Паттерны ролей, внутренние ключи |

## API

- `GET /api/settings` — снимок: `preferences`, `bounds`, `registry`, `ui`, `applyRates`, `systemStatus`.
- `PATCH /api/settings` — тело `{ "patch": { ... } }`, валидация через `lib/settings-registry.mjs`.
- `GET /api/preferences/export` / `POST /api/preferences/import` — полный экспорт/импорт с резервной копией.

## UI

- **Автосохранение:** debounce 500 ms, подсказка «Сохранено» в футере.
- **Отмена на вкладке:** снимок при входе на вкладку, кнопка «Отменить на вкладке».
- **Импорт:** панель вставки JSON (без `prompt`).
- **Поиск:** поле в шапке, ключевые слова из registry.
- **Mobile (≤640px):** режимы pick/drill, кнопка «← Разделы»; классы `settings-shell--sidebar` / `settings-shell--solo`.
- **Горячие клавиши:** Alt+1…9 — вкладки; Alt+F — полноэкранный режим окна.

## Известные ловушки layout

При `grid-template-columns: 12.5rem 1fr` и скрытом `.settings-nav` единственный видимый ребёнок попадал в **первую** ячейку (~200px). Исправление v9: layout в одном `dashboard-settings.css`, класс `settings-shell--wide` вне `@media viewport`, `grid-column: 2` для content, drill по **ширине диалога** (не viewport).

**Размер окна:** дефолт «Стандарт» 1120×860, «Широкое» 1152×800, CSS-потолок 72rem. Миграция `SETTINGS_SIZE_SCHEMA_VERSION = 3` сбрасывает устаревший размер из localStorage. Маркер сборки: `data-settings-build="settings9"` на футере модалки.

## Deep link

URL: `/?settings=letters&focus=fp` — открывает вкладку «Письма», фокус на порог ложных отказов.

Событие: `hh-open-settings` с `detail: { tab, focus, layout, focusToast }`.

## Файлы

| Слой | Путь |
|------|------|
| Реестр ключей | `lib/settings-registry.mjs` |
| Store + snapshot | `lib/settings-store.mjs` |
| Модалка | `dashboard/public/settings-modal.mjs` |
| Hub (data-setting) | `dashboard/public/settings-hub.mjs` |
| Стили | `dashboard-settings.css` (layout v9), `dashboard-settings-v5-layer.css`, `dashboard-settings-v6.css` |

## Проверки

```bash
npm run check:dashboard
npm run test:settings-registry
npm run test:conversion-presets
npm run test:apply-gate
npm run test:dashboard-settings   # дашборд на :3849
```
