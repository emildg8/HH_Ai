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
Ensure-Copy "config/secrets.example.env" "config/secrets.local.env" "config/secrets.local.env"
Ensure-Copy "config/profiles/devops.env.example" "config/profiles/devops.env" "config/profiles/devops.env"
Ensure-Copy "config/cover-letter.example.txt" "config/cover-letter.txt" "config/cover-letter.txt"
Ensure-Copy "config/cover-letter-style-examples.example.txt" "config/cover-letter-style-examples.txt" "config/cover-letter-style-examples.txt (опционально)"

New-Item -ItemType Directory -Force -Path "data", "CV" | Out-Null

Write-Host ""
Write-Host "Проверка настройки:" -ForegroundColor Cyan
node scripts/setup-check.mjs
$checkExit = $LASTEXITCODE

Write-Host ""
Write-Host "Дальше:" -ForegroundColor Green
Write-Host "  1. npm run setup  (или docs/CONFIG-GUIDE.md — LLM, профиль)"
Write-Host "  2. config/secrets.local.env — ключ OpenRouter или Ollama (или без LLM)"
Write-Host "  3. config/profiles/devops.env — HH_PROFILE_RESUME_TITLE"
Write-Host "  4. CV/ — положите resume.pdf или .md"
Write-Host "  5. npm run login"
Write-Host "  6. npm run dashboard  ->  http://127.0.0.1:3849"
Write-Host ""
Write-Host "Кратко: docs/QUICKSTART.md"

if ($checkExit -ne 0) { exit $checkExit }
