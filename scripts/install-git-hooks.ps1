# Установка pre-push hook (проверка секретов)
#   powershell -ExecutionPolicy Bypass -File scripts/install-git-hooks.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HookDir = Join-Path (Join-Path $Root ".git") "hooks"
$HookPath = Join-Path $HookDir "pre-push"
$SrcHook = Join-Path (Join-Path $Root "scripts") "pre-push-hook.sh"

if (-not (Test-Path (Join-Path $Root ".git"))) {
  Write-Error "Не git-репозиторий: $Root"
}

New-Item -ItemType Directory -Force -Path $HookDir | Out-Null
Copy-Item -Force $SrcHook $HookPath
Write-Host "[install-git-hooks] pre-push установлен (scripts/pre-push-hook.sh)"
Write-Host "  npm run secrets:check - run manually before push"
