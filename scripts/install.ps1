# Первый запуск на Windows
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Host "==> HH Ai — установка" -ForegroundColor Cyan
Write-Host "==> Node $(node -v)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js не найден. Установите LTS с https://nodejs.org"
}

npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx playwright install chromium
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

function Ensure-Copy($src, $dest, $label) {
  if (-not (Test-Path $dest)) {
    if (-not (Test-Path $src)) { Write-Warning "Нет $src"; return }
    Copy-Item $src $dest
    Write-Host "  + $label"
  }
}

Ensure-Copy ".env.example" ".env" ".env"
if (-not (Test-Path "config/secrets.local.env")) {
  if (Test-Path "config/presets/no-llm.env") {
    Copy-Item "config/presets/no-llm.env" "config/secrets.local.env"
    Write-Host "  + config/secrets.local.env (режим без LLM — см. npm run setup)"
  } else {
    Ensure-Copy "config/secrets.example.env" "config/secrets.local.env" "config/secrets.local.env"
  }
}
Ensure-Copy "config/profiles/devops.env.example" "config/profiles/devops.env" "config/profiles/devops.env"
Ensure-Copy "config/cover-letter.example.txt" "config/cover-letter.txt" "config/cover-letter.txt"
Ensure-Copy "config/cover-letter-style-examples.example.txt" "config/cover-letter-style-examples.txt" "config/cover-letter-style-examples.txt (опционально)"
Ensure-Copy "config/resume-routing.example.json" "config/resume-routing.json" "config/resume-routing.json"
Ensure-Copy "config/resume-raise-schedule.example.json" "config/resume-raise-schedule.json" "config/resume-raise-schedule.json"
Ensure-Copy "dashboard/public/local-dashboard-defaults.example.mjs" "dashboard/public/local-dashboard-defaults.mjs" "local-dashboard-defaults.mjs (опционально)"

New-Item -ItemType Directory -Force -Path "data", "CV" | Out-Null

node --input-type=module -e "import { copyDemoToQueueIfMissing } from './lib/demo-queue.mjs'; const r = copyDemoToQueueIfMissing(); if (r.ok) { console.log('  + demo queue: ' + r.count + ' vacancies'); }"

Write-Host ""
Write-Host "Проверка настройки:" -ForegroundColor Cyan
node scripts/setup-check.mjs
$checkExit = $LASTEXITCODE

Write-Host ""
Write-Host "Дальше:" -ForegroundColor Green
Write-Host "  1. config/profiles/devops.env — HH_PROFILE_RESUME_TITLE (как на hh.ru)"
Write-Host "  2. npm run login"
Write-Host "  3. npm run dashboard  ->  http://127.0.0.1:3849"
Write-Host ""
Write-Host "Опционально: npm run setup (LLM), CV/resume.pdf"
Write-Host "Чеклист: docs/FIRST-RUN.md · docs/QUICKSTART.md"
Write-Host ""
Write-Host "Перезапуск UI после git pull: npm run dashboard и Ctrl+F5"

if ($checkExit -ne 0) { exit $checkExit }
