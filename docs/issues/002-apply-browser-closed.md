## Контекст

После `npm run login` команда `npm run apply` иногда падает с ошибкой вроде **browser closed** / контекст Chromium закрыт раньше времени (особенно после перезагрузки ПК).

## Симптомы

- `apply` не подтверждает живую сессию
- Профиль: `data/session/chromium-profile` (`HH_SESSION_DIR`)

## Что проверить

1. Повторить `npm run login` без параллельного батча/дашборда
2. Не запускать два Playwright-процесса на один профиль
3. Логи Playwright / скрины при падении

## Исправление (2.0.2)

`scripts/apply.mjs` переведён на общую инфраструктуру Chromium:

- `launchPersistentContextSafe` + `browser.lock` (как `login`, `open-hh`, harvest)
- `clearStaleBrowserLock` / `repairChromiumProfileCaches` при «browser closed»
- `assertHhLoggedIn` + ожидание капчи
- `closeContextSafe` — корректное освобождение профиля

Проверка без браузера: `node scripts/test-apply-session.mjs`

## Ожидание

Стабильная проверка сессии одной командой `npm run apply` после успешного login.
