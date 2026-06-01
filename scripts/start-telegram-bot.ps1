# Локальный Telegram-бот HH Ai (long polling, без VPS).
#   powershell -ExecutionPolicy Bypass -File scripts/start-telegram-bot.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js не найден: https://nodejs.org/" -ForegroundColor Red
  exit 1
}

$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "Создайте .env с TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID (см. docs/TELEGRAM-BOT.md)" -ForegroundColor Yellow
}

Write-Host "==> HH Ai Telegram bot (polling). Остановка: Ctrl+C" -ForegroundColor Cyan
node scripts/telegram-bot.mjs
