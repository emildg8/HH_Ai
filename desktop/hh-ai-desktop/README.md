# HH Ai Desktop (Tauri 3.0 alpha)

Оболочка «как программа» над локальным дашбордом `http://127.0.0.1:3849`.

## Требования

- Node.js 18+
- [Rust](https://rustup.rs) (для сборки Tauri)
- HH Ai установлен и настроен в корне репозитория (`npm run login` один раз)

## Фаза 3 (3.0.0-alpha)

Экран подготовки (`public/index.html`): статус Chromium и кнопка **Установить Chromium** (Playwright, ~200 МБ).

```powershell
npm run desktop:install-chromium   # из терминала
npm run desktop:smoke              # sidecar + chromium без Tauri
```

## Фаза 2 (3.0.0-alpha)

При запуске Tauri, если `:3849` не отвечает, автоматически стартует `node scripts/dashboard-server.mjs` из корня репозитория. При закрытии приложения sidecar завершается.

Переопределить корень: переменная окружения `HH_AI_ROOT`.

## Фаза 1 (3.0.0-alpha)

При запуске Tauri проверяет, отвечает ли дашборд на `:3849`. Если нет — показывается экран с инструкцией (`public/index.html`). Дашборд по-прежнему нужно запустить отдельно (`npm run dashboard` или `desktop:launcher`); автозапуск sidecar — фаза 2.

## Быстрый старт (разработка)

```powershell
# Терминал 1 — дашборд
cd D:\Dev\HH\hh-ru-apply
npm run dashboard

# Терминал 2 — Tauri (webview на :3849)
cd desktop\hh-ai-desktop
npm install
npm run tauri:dev
```

## Interim без Rust

Пока Tauri не собран:

```powershell
npm run desktop:launcher
```

Откроет дашборд и браузер по умолчанию.

## Сборка installer

```powershell
cd desktop\hh-ai-desktop
npm run tauri:build
```

Артефакты: `src-tauri/target/release/bundle/`

Подробный план: [docs/TAURI-PLAN.md](../../docs/TAURI-PLAN.md)
