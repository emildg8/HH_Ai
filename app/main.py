#!/usr/bin/env python3
"""
HH Ai — Telegram webhook на Vdsina (Python).
Принимает команды 24/7; статистика — из snapshot (npm run remote:push-stats) или с локального дашборда.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse

APP_DIR = Path(os.environ.get("HH_VDSINA_APP_DIR", Path(__file__).resolve().parent.parent))
DATA_DIR = Path(os.environ.get("HH_VDSINA_DATA_DIR", APP_DIR / "data"))
SNAPSHOT_FILE = DATA_DIR / "stats-snapshot.json"

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "").strip()
DASHBOARD_URL = os.environ.get("HH_DASHBOARD_URL", "").strip().rstrip("/")
DASHBOARD_TOKEN = os.environ.get("HH_REMOTE_API_TOKEN", "").strip()

ALLOWED_CHAT_IDS = {
    x.strip()
    for x in re.split(r"[,;\s]+", os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS", "") or os.environ.get("TELEGRAM_CHAT_ID", ""))
    if x.strip() and re.fullmatch(r"-?\d+", x.strip())
}

app = FastAPI(title="HH Ai Vdsina Webhook", version="1.0.0")


def load_snapshot() -> dict[str, Any]:
    try:
        if SNAPSHOT_FILE.is_file():
            return json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def dashboard_headers() -> dict[str, str]:
    h: dict[str, str] = {}
    if DASHBOARD_TOKEN:
        h["Authorization"] = f"Bearer {DASHBOARD_TOKEN}"
    return h


def dashboard_get(path: str, timeout: float = 10.0) -> dict[str, Any] | None:
    if not DASHBOARD_URL:
        return None
    try:
        r = requests.get(f"{DASHBOARD_URL}{path}", headers=dashboard_headers(), timeout=timeout)
        if r.ok:
            return r.json()
    except Exception:
        return None
    return None


def is_allowed(chat: dict | None, user: dict | None) -> bool:
    if not ALLOWED_CHAT_IDS:
        return False
    cid = str((chat or {}).get("id", ""))
    uid = str((user or {}).get("id", ""))
    return cid in ALLOWED_CHAT_IDS or uid in ALLOWED_CHAT_IDS


def parse_command(text: str) -> tuple[str, list[str]]:
    raw = (text or "").strip()
    if not raw.startswith("/"):
        return "", []
    first = raw.split()[0]
    cmd = first.lstrip("/").split("@")[0].lower()
    args = raw[len(first) :].strip().split()
    return cmd, args


HELP_TEXT = """🤖 HH Ai (VPS webhook)

/status — задачи (дашборд или snapshot)
/stats — сводка
/queue — очередь
/chats — inbox чатов
/dashboard — ссылка
/help — справка

Playwright и отклики — на вашем ПК (дашборд). VPS: Telegram + уведомления."""


def format_status_from_api(data: dict[str, Any]) -> str:
    side = data.get("sideJobs") or {}
    harvest = data.get("harvestControl") or {}
    batch = data.get("batchControl") or {}
    lines = ["⚙️ Задачи HH Ai", ""]
    if harvest.get("harvestRunning"):
        lines.append(f"Поиск: идёт (pid {harvest.get('harvestPid')})")
    else:
        lines.append("Поиск: остановлен")
    if batch.get("batchRunning"):
        lines.append(f"Серия: идёт (pid {batch.get('batchPid')})")
    else:
        lines.append("Серия: остановлена")
    for key, label in (
        ("syncChats", "Sync чатов"),
        ("syncResponses", "Sync откликов"),
        ("dailyRoutine", "Утренний цикл"),
        ("chatReplySend", "Отправка в чат"),
    ):
        if side.get(key, {}).get("running"):
            lines.append(f"{label}: идёт")
    return "\n".join(lines)


def format_stats(snapshot: dict[str, Any]) -> str:
    if snapshot.get("digest_text"):
        return str(snapshot["digest_text"])
    st = snapshot.get("stats") or {}
    return "\n".join(
        [
            "📊 Сводка (snapshot)",
            "",
            f"Pending: {st.get('byStatus', {}).get('pending', '—')}",
            f"Responded: {st.get('byStatus', {}).get('responded', '—')}",
            f"Чаты ждут ответ: {st.get('chatNeedsReply', '—')}",
            "",
            f"Обновлено: {snapshot.get('at', '—')}",
            "",
            "На ПК: npm run remote:push-stats",
        ]
    )


def format_queue(snapshot: dict[str, Any]) -> str:
    st = snapshot.get("stats") or {}
    by = st.get("byStatus") or {}
    return "\n".join(
        [
            "📋 Очередь",
            "",
            f"Pending: {by.get('pending', 0)}",
            f"Approved: {by.get('approved', 0)}",
            f"Rejected: {by.get('rejected', 0)}",
            f"Responded: {by.get('responded', 0)}",
            f"Чаты: {st.get('chatNeedsReply', 0)}",
        ]
    )


def format_chats(snapshot: dict[str, Any]) -> str:
    c = snapshot.get("chatInbox") or {}
    return "\n".join(
        [
            "💬 Чаты hh.ru",
            "",
            f"Нужен ответ: {c.get('needs_reply', 0)}",
            f"Напомнить: {c.get('invite_nudge', 0)}",
            f"Отказы: {c.get('declined', 0)}",
            f"Всего: {c.get('all', 0)}",
        ]
    )


def build_reply(cmd: str, args: list[str]) -> str:
    if cmd in ("start", "help", ""):
        return HELP_TEXT

    if cmd == "dashboard":
        url = DASHBOARD_URL or os.environ.get("HH_DASHBOARD_PUBLIC_URL", "http://127.0.0.1:3849")
        return f"🖥 Дашборд: {url}"

    if cmd == "status":
        live = dashboard_get("/api/job-status")
        if live:
            return format_status_from_api(live)
        snap = load_snapshot()
        if snap.get("jobStatus"):
            return format_status_from_api(snap["jobStatus"])
        return "Дашборд недоступен. Запустите ПК + npm run dashboard или remote:push-stats."

    snap = load_snapshot()
    if cmd == "stats":
        return format_stats(snap)
    if cmd == "queue":
        return format_queue(snap)
    if cmd == "chats":
        return format_chats(snap)

    return "Неизвестная команда. /help"


def send_message(chat_id: int | str, text: str) -> None:
    if not BOT_TOKEN:
        return
    requests.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        json={"chat_id": chat_id, "text": text[:4000]},
        timeout=15,
    )


@app.post("/api/stats-ingest")
async def stats_ingest(
    request: Request,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    """Приём snapshot с ПК (Wispbyte — без SSH)."""
    token = DASHBOARD_TOKEN
    if token:
        if authorization != f"Bearer {token}":
            raise HTTPException(status_code=403, detail="invalid token")
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid json") from exc
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_FILE.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    return JSONResponse({"ok": True, "at": body.get("at")})


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "hh-ai-vdsina"}


@app.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> JSONResponse:
    if WEBHOOK_SECRET and x_telegram_bot_api_secret_token != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="invalid webhook secret")

    update = await request.json()
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return JSONResponse({"ok": True})

    chat = msg.get("chat") or {}
    user = msg.get("from") or {}
    if not is_allowed(chat, user):
        send_message(chat.get("id"), "Доступ запрещён. Добавьте chat_id в TELEGRAM_ALLOWED_CHAT_IDS на VPS.")
        return JSONResponse({"ok": True})

    text = msg.get("text") or ""
    cmd, args = parse_command(text)
    if not cmd and not text:
        return JSONResponse({"ok": True})

    reply = build_reply(cmd, args) if cmd else "Отправьте /help"
    send_message(chat.get("id"), reply)
    return JSONResponse({"ok": True})


@app.get("/")
def root() -> PlainTextResponse:
    return PlainTextResponse("HH Ai webhook OK\n")
