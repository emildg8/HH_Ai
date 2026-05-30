# Чекпоинт для продолжения работы

**Обновлено:** 2026-05-30 · **Версия:** 2.2.0 (локально)

**Следующий тег:** `v2.2.0` · на GitHub пока [v2.0.1](https://github.com/emildg8/HH_Ai/releases/tag/v2.0.1)

---

## Срез 2.2.0

| Функция | Статус |
|---------|--------|
| Portable zip + install-portable + start-dashboard.bat | ✓ |
| deferUntil: вкладка «Отлож.», Shift+7 дней | ✓ (fix переключения вкладки) |
| Дайджест дня (модалка + Telegram) | ✓ |
| rescore pending | ✓ `devops:rescore-pending` |
| Harvest Telegram N≥50 | ✓ (было) |
| Батч пауза при капче | ✓ (было) |

```powershell
npm run verify:local
npm run qa:public
npm run release:public   # hh-ai-public-v2.2.0.zip + hh-ru-apply-win-x64-v2.2.0.zip
```

---

## Открытое

- QA на чистой VM — [QA-CLEAN-INSTALL.md](QA-CLEAN-INSTALL.md)
- **Git:** коммит → теги v2.1.0 и v2.2.0 (или один v2.2.0 если пропустили 2.1.0 на GitHub)

См. [ROADMAP.md](ROADMAP.md)
