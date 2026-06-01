# Autostart HH Ai Telegram bot at Windows logon.
#   powershell -ExecutionPolicy Bypass -File scripts/install-telegram-bot-task.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$TaskName = "HH-Ai-Telegram-Bot"
$Node = (Get-Command node -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path (Join-Path $Root "data\logs") | Out-Null

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
  -Description "HH Ai Telegram bot (long polling)" `
  -Force | Out-Null

Write-Host "[install-telegram-bot-task] OK: $TaskName (at logon)" -ForegroundColor Green
Write-Host "  remove: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"

Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Write-Host "[install-telegram-bot-task] started" -ForegroundColor Cyan
