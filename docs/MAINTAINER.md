# Чеклист мейнтейнера HH Ai

Канонический репозиторий: [emildg8/HH_Ai](https://github.com/emildg8/HH_Ai).  
**Не пушить** в [Steev193/hh-ru-apply](https://github.com/Steev193/hh-ru-apply) — только идея-основа.

---

## После каждого бага в сессии

1. Воспроизвести локально (лог `data/hh-apply-chat.log`, скрин `data/hh-apply-chat-error-*.png`).
2. Если баг повторяемый — **один GitHub Issue** (шаблон Bug или Selectors).
3. В Issue: версия `VERSION`, профиль, шаги **без** секретов и PII.
4. Ссылку на Issue добавить в [docs/issues/BACKLOG.md](issues/BACKLOG.md) при закрытии/открытии.

---

## Перед каждым релизом (тег `vX.Y.Z`)

```powershell
cd <корень-проекта>
npm run verify:release
npm run quickstart:gate
npm run quality:check
npm run release:public
```

| Шаг | Команда |
|-----|---------|
| Версия | Обновить `VERSION`, `CHANGELOG.md` |
| Тег | `git tag v2.0.1` && `git push hh_ai v2.0.1` (текущий срез) |
| CI | Workflow [release.yml](../.github/workflows/release.yml) прикрепит zip к Release |
| Вручную (если CI не сработал) | `gh release upload vX.Y.Z releases/hh-ai-public-vX.Y.Z.zip` |

**Не коммитить:** `data/vacancies-devops.json`, `config/secrets.local.env`, `config/profiles/*.env`, `CV/`, `data/session/`.

**Демо для скринов и QA:** `docs/demo/vacancies-demo.json` — не смешивать с личной очередью.

### Дашборд (UI в `dashboard/public/`)

| Действие | Команда / файл |
|----------|----------------|
| Статика + контракт настроек | `npm run check:dashboard` |
| E2E модалки «Настройки» | `npm run test:dashboard-settings` (дашборд на :3849) |
| Сброс кэша у пользователей | `lib/dashboard-asset-version.mjs` — `DASHBOARD_APP_JS_VERSION`, `DASHBOARD_V4_CSS_VERSION` → те же `?v=` в `index.html` |

После правок `app.js` / `settings-modal.mjs` — bump **APP** version; после правок `dashboard-v4.css` (настройки) — bump **V4 CSS** version. `check:dashboard` сверяет оба.

---

## Первый внешний пользователь

1. Отправить [QUICKSTART.md](QUICKSTART.md) + zip или clone.
2. Попросить пройти установку и записать **3 friction point** в [UX-FRICTION-LOG.md](UX-FRICTION-LOG.md).
3. Friction → задачи R1.6 / R1.7 в [ROADMAP.md](ROADMAP.md) или новые Issues.

---

## Git hooks (секреты)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-git-hooks.ps1
```

Перед push: `npm run secrets:check` — тот же скрипт, что в pre-push.

---

## Remote

```text
git push hh_ai main
git push hh_ai HH_Ai
```

`origin` может указывать на Steev193 — для публикации не использовать.
