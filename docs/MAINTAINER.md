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
npm run smoke:release
npm run verify:local
npm run release:public
```

| Шаг | Команда |
|-----|---------|
| Версия | Обновить `VERSION`, `CHANGELOG.md` |
| Тег | `git tag v2.0.1` && `git push hh_ai v2.0.1` |
| CI | Workflow [release.yml](../.github/workflows/release.yml) прикрепит zip к Release |
| Вручную (если CI не сработал) | `gh release upload vX.Y.Z releases/hh-ai-public-vX.Y.Z.zip` |

**Не коммитить:** `data/vacancies-devops.json`, `config/secrets.local.env`, `config/profiles/*.env`, `CV/`, `data/session/`.

**Демо для скринов и QA:** `docs/demo/vacancies-demo.json` — не смешивать с личной очередью.

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
