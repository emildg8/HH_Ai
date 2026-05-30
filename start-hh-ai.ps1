# Быстрый старт HH Ai (Windows)
#   powershell -ExecutionPolicy Bypass -File start-hh-ai.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Установите Node.js 18+ LTS: https://nodejs.org/" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "==> npm install…" -ForegroundColor Cyan
  npm install
}

$desktopExe = Get-ChildItem -Path "desktop\hh-ai-desktop\src-tauri\target\release\bundle\nsis" -Filter "*-setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($desktopExe) {
  Write-Host "==> Запуск HH Ai Desktop…" -ForegroundColor Cyan
  Start-Process $desktopExe.FullName
  exit 0
}

$builtExe = Get-ChildItem -Path "desktop\hh-ai-desktop\src-tauri\target\release" -Filter "hh-ai-desktop.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($builtExe) {
  $env:HH_AI_ROOT = $Root
  Start-Process $builtExe.FullName
  exit 0
}

Write-Host "==> Дашборд (браузер)…" -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File "$Root\scripts\desktop-launcher.ps1"
