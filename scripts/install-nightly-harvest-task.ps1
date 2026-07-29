# Ежедневный ночной harvest Эмиль (02:00 локальное / МСК).
# Снимает устаревший rescore-таск hh-ru-apply, если есть.
#   powershell -ExecutionPolicy Bypass -File scripts/install-nightly-harvest-task.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$TaskName = "HH-Ai-Nightly-Harvest"
$LegacyRescore = "hh-ru-apply-night-rescore-msk"
$Ps1 = Join-Path $Root "scripts\nightly-harvest.ps1"
$LogFile = Join-Path $Root "data-emil\logs\nightly-harvest.log"

if (-not (Test-Path $Ps1)) {
  throw "Нет скрипта: $Ps1"
}

# Убрать сломанный ночной rescore со старого пути hh-ru-apply
Unregister-ScheduledTask -TaskName $LegacyRescore -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "[install-nightly-harvest] removed legacy: $LegacyRescore (if existed)" -ForegroundColor Yellow

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Ps1`"" `
  -WorkingDirectory $Root

# 02:00 каждый день (локальное время ПК = МСК)
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 12)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "HH Ai: ночной harvest Эмиль (watchdog silent, 02:00). Лог: data-emil/logs/nightly-harvest.log" `
  -Force | Out-Null

Write-Host "[install-nightly-harvest] OK: $TaskName daily 02:00" -ForegroundColor Green
Write-Host "  script: $Ps1"
Write-Host "  log:    $LogFile"
Write-Host "  remove: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
