# Установка pre-push hook (проверка секретов)
#   powershell -ExecutionPolicy Bypass -File scripts/install-git-hooks.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HookDir = Join-Path (Join-Path $Root ".git") "hooks"
$HookPath = Join-Path $HookDir "pre-push"

if (-not (Test-Path (Join-Path $Root ".git"))) {
  Write-Error "Не git-репозиторий: $Root"
}

New-Item -ItemType Directory -Force -Path $HookDir | Out-Null

$hook = @"
#!/bin/sh
# HH Ai — pre-push secrets check
cd "`$(git rev-parse --show-toplevel)" || exit 1
node scripts/pre-push-secrets-check.mjs || exit 1
"@

Set-Content -Path $HookPath -Value $hook -Encoding UTF8
# Git on Windows runs hooks via sh from Git for Windows
Write-Host "[install-git-hooks] pre-push -> scripts/pre-push-secrets-check.mjs" -ForegroundColor Green
Write-Host "  npm run secrets:check - run manually before push"
