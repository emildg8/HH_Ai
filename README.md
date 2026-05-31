# HH Ai — Telegram bot (Wispbyte)

Только webhook. Исходник: `deploy/vdsina/` в основном репо.

Startup:
```bash
pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
```

Документация: docs/DEPLOY-WISPBYTE.md в репозитории HH_Ai.
