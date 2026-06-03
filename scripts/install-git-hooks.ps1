# Установка pre-push hook (проверка секретов)
#   powershell -ExecutionPolicy Bypass -File scripts/install-git-hooks.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HookDir = Join-Path (Join-Path $Root ".git") "hooks"
$PrePush = Join-Path $HookDir "pre-push"
$PreCommit = Join-Path $HookDir "pre-commit"
$Scripts = Join-Path $Root "scripts"

if (-not (Test-Path (Join-Path $Root ".git"))) {
  Write-Error "Не git-репозиторий: $Root"
}

New-Item -ItemType Directory -Force -Path $HookDir | Out-Null
Copy-Item -Force (Join-Path $Scripts "pre-push-hook.sh") $PrePush
Copy-Item -Force (Join-Path $Scripts "pre-commit-hook.sh") $PreCommit
Write-Host "[install-git-hooks] pre-push + pre-commit установлены"
Write-Host "  pre-commit: check:dashboard при dashboard/public/"
Write-Host "  npm run secrets:check - run manually before push"
