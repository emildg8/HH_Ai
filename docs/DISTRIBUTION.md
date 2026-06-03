# Как запускать без Docker (и альтернативы)

**Версия:** 3.2.0

Цель: любой соискатель может начать за **15–45 минут** без контейнеров.

## Публичный релиз (рекомендуется для передачи)

| Артефакт | Команда / источник | Содержимое |
|----------|-------------------|------------|
| Каталог | `npm run export:public` | `dist/hh-ai-public/` |
| Zip | `npm run release:public` | `releases/hh-ai-public-v3.2.0.zip` |
| GitHub Releases | тег `v3.2.0` | CI [release.yml](../.github/workflows/release.yml) прикрепляет zip + `.exe` |

Инструкция получателю: [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md). В архиве **нет** сессий, ключей, личных очередей, CV.

Перед публикацией:

```bash
npm run verify:release
npm run quickstart:gate
npm run release:public
```

Распакуйте zip локально — без `sk-or-v1`, hash резюме, `data/session`.

## Рекомендуемый путь: Node + Playwright

| Шаг | Действие |
|-----|----------|
| 1 | [Node.js LTS](https://nodejs.org/) или **HH-Ai_*-setup.exe** (Windows) |
| 2 | Releases zip → `install-portable.ps1` **или** git clone → `install.ps1` |
| 3 | `npm run login` (один раз) |
| 4 | `npm run dashboard` → демо-очередь или «Загрузить демо» |

**Плюсы:** полный контроль, сессия локально.  
**Минусы:** Chromium, ручной login при сбросе сессии.

---

## Варианты

### A. Desktop installer (Windows) — **готово в 3.0+**

Tauri-оболочка, bundled Node, кнопка «Установить Chromium». См. [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md).

### B. Portable ZIP — **готово (R1.2 / R1.4)**

- `release:public` → `releases/hh-ai-public-v*.zip`
- `install-portable.ps1` + `start-dashboard.bat`
- CI при теге `v*` загружает zip на GitHub Releases
- **Node.js 18+** всё ещё нужен для zip (не для desktop `.exe`)

### C–E. SaaS, Codespaces, extension

Backlog — см. [ROADMAP.md](ROADMAP.md).

---

## Рекомендация по приоритету

1. **Сейчас (3.2):** desktop `.exe` или portable zip с Releases + [QUICKSTART.md](QUICKSTART.md).
2. **Следующее:** внешний friction-прогон (DS-18), bundled Node в zip (опционально).

Docker остаётся **опциональным**.
