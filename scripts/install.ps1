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

New-Item -ItemType Directory -Force -Path "data", "CV" | Out-Null

Write-Host ""
Write-Host "Готово. Дальше:" -ForegroundColor Green
Write-Host "  1. Отредактируйте config/secrets.local.env (OPENROUTER_API_KEY — опционально)"
Write-Host "  2. config/profiles/devops.env — HH_PROFILE_RESUME_TITLE"
Write-Host "  3. npm run login"
Write-Host "  4. npm run dashboard  ->  http://127.0.0.1:3849"
Write-Host ""
Write-Host "Инструкция: docs/QUICKSTART.md"
