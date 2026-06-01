# Автозапуск Telegram-бота HH Ai при входе в Windows.
#   powershell -ExecutionPolicy Bypass -File scripts/install-telegram-bot-task.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$TaskName = "HH-Ai-Telegram-Bot"
$Node = (Get-Command node -ErrorAction Stop).Source
$LogDir = Join-Path $Root "data\logs"
$LogFile = Join-Path $LogDir "telegram-bot.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Action = New-ScheduledTaskAction `
  -Execute $Node `
  -Argument "scripts\telegram-bot.mjs" `
  -WorkingDirectory $Root

$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 2) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "HH Ai — локальный Telegram-бот (long polling)" `
  -Force | Out-Null

Write-Host "[install-telegram-bot-task] OK: $TaskName (at logon)" -ForegroundColor Green
Write-Host "  логи: перенаправьте вывод или смотрите консоль при ручном запуске"
Write-Host "  снять: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"

# Стартуем сейчас, если бот ещё не запущен
$existing = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
  try {
    $_.CommandLine -like "*telegram-bot.mjs*"
  } catch { $false }
}
if (-not $existing) {
  Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Write-Host "[install-telegram-bot-task] задача запущена" -ForegroundColor Cyan
}
