# Первый запуск на Windows (без Docker)
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "==> Node $(node -v)"
npm install
npx playwright install chromium

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Создан .env — заполните ключи при необходимости"
}

if (-not (Test-Path "config/profiles/devops.env")) {
  if (Test-Path "config/profiles/devops.env.example") {
    Copy-Item "config/profiles/devops.env.example" "config/profiles/devops.env"
    Write-Host "Создан config/profiles/devops.env — укажите HH_PROFILE_RESUME_*"
  }
}

Write-Host ""
Write-Host "Дальше:"
Write-Host "  npm run login"
Write-Host "  npm run devops:dashboard"
Write-Host "  http://127.0.0.1:3849"
