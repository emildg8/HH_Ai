# Portable-установка (внутри распакованного релиза)
#   powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "HH Ai portable setup in $Root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Установите Node.js 18+ с https://nodejs.org/ и повторите."
  exit 1
}

& npm install
& npx playwright install chromium

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = Join-Path $desktop "HH Ai Dashboard.lnk"
# простой bat на рабочий стол
$bat = Join-Path $Root "start-dashboard.bat"
@"
@echo off
cd /d "$Root"
npm run devops:dashboard
pause
"@ | Set-Content -Encoding ASCII $bat

Write-Host "Готово. Запуск: двойной клик start-dashboard.bat или npm run devops:dashboard"
Write-Host "Перед первым откликом: npm run login"
