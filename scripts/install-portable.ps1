# Portable-установка (внутри распакованного релиза)
#   powershell -ExecutionPolicy Bypass -File scripts/install-portable.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Host "==> HH Ai — portable install" -ForegroundColor Cyan
Write-Host "==> $Root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Установите Node.js 18+ с https://nodejs.org/ и повторите."
  exit 1
}

function Ensure-Copy($src, $dest, $label) {
  if (-not (Test-Path $dest)) {
    if (-not (Test-Path $src)) { Write-Warning "Нет $src"; return }
    $dir = Split-Path -Parent $dest
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Copy-Item $src $dest
    Write-Host "  + $label"
  }
}

& npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& npx playwright install chromium
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Ensure-Copy ".env.example" ".env" ".env"
if (-not (Test-Path "config/secrets.local.env")) {
  if (Test-Path "config/presets/no-llm.env") {
    Copy-Item "config/presets/no-llm.env" "config/secrets.local.env"
    Write-Host "  + config/secrets.local.env (режим без LLM)"
  } else {
    Ensure-Copy "config/secrets.example.env" "config/secrets.local.env" "config/secrets.local.env"
  }
}
Ensure-Copy "config/profiles/devops.env.example" "config/profiles/devops.env" "config/profiles/devops.env"
Ensure-Copy "config/cover-letter.example.txt" "config/cover-letter.txt" "config/cover-letter.txt"
Ensure-Copy "config/resume-routing.example.json" "config/resume-routing.json" "config/resume-routing.json"
Ensure-Copy "config/resume-raise-schedule.example.json" "config/resume-raise-schedule.json" "config/resume-raise-schedule.json"
Ensure-Copy "dashboard/public/local-dashboard-defaults.example.mjs" "dashboard/public/local-dashboard-defaults.mjs" "local-dashboard-defaults.mjs"

New-Item -ItemType Directory -Force -Path "data", "CV" | Out-Null

node --input-type=module -e "import { copyDemoToQueueIfMissing } from './lib/demo-queue.mjs'; const r = copyDemoToQueueIfMissing(); if (r.ok) { console.log('  + demo queue: ' + r.count + ' vacancies'); }"

$bat = Join-Path $Root "start-dashboard.bat"
@"
@echo off
cd /d "%~dp0"
echo HH Ai dashboard — http://127.0.0.1:3849
npm run dashboard
pause
"@ | Set-Content -Encoding ASCII $bat

Write-Host ""
Write-Host "Проверка:" -ForegroundColor Cyan
node scripts/setup-check.mjs
$checkExit = $LASTEXITCODE

Write-Host ""
Write-Host "Дальше:" -ForegroundColor Green
Write-Host "  1. config/profiles/devops.env — HH_PROFILE_RESUME_TITLE"
Write-Host "  2. npm run login"
Write-Host "  3. start-dashboard.bat  или  npm run dashboard"
Write-Host ""
Write-Host "docs/FIRST-RUN.md · docs/QUICKSTART.md"

if ($checkExit -ne 0) { exit $checkExit }
