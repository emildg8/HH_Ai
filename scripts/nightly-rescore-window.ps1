Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$lockPath = Join-Path $repoRoot 'data\.nightly-rescore.lock'
$logDir = Join-Path $repoRoot 'logs'
$logPath = Join-Path $logDir 'nightly-rescore.log'

function Write-Log {
  param([string]$Message)
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$ts] $Message"
  Write-Host $line
  Add-Content -Path $logPath -Value $line -Encoding UTF8
}

function Get-MskNow {
  $tz = [System.TimeZoneInfo]::FindSystemTimeZoneById('Russian Standard Time')
  return [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), $tz.Id)
}

function In-MskWindow {
  $mskNow = Get-MskNow
  return ($mskNow.Hour -ge 2 -and $mskNow.Hour -lt 10)
}

if (-not (Test-Path $logDir)) {
  New-Item -Path $logDir -ItemType Directory | Out-Null
}

if (Test-Path $lockPath) {
  Write-Log 'Найден lock-файл, предыдущий запуск еще активен. Выход.'
  exit 0
}

if (-not (In-MskWindow)) {
  $mskNow = Get-MskNow
  Write-Log ("Вне окна 02:00-10:00 МСК. Сейчас МСК: {0:yyyy-MM-dd HH:mm:ss}. Выход." -f $mskNow)
  exit 0
}

Set-Content -Path $lockPath -Value $PID -Encoding ASCII
try {
  if (-not $env:HH_RESCORE_DELAY_MS) {
    $env:HH_RESCORE_DELAY_MS = '5000'
  }
  $env:FORCE_COLOR = '0'

  Write-Log "Старт ночного пересчета в окне 02:00-10:00 МСК. HH_RESCORE_DELAY_MS=$($env:HH_RESCORE_DELAY_MS)."
  while (In-MskWindow) {
    Push-Location $repoRoot
    try {
      Write-Log 'Запуск: node scripts/rescore-queue.mjs'
      & node scripts/rescore-queue.mjs 2>&1 | Tee-Object -FilePath $logPath -Append
      Write-Log "Завершение прохода, code=$LASTEXITCODE"
    } finally {
      Pop-Location
    }
    if (-not (In-MskWindow)) {
      break
    }
    Start-Sleep -Seconds 120
  }
  Write-Log 'Окно 02:00-10:00 МСК завершилось. Скрипт остановлен.'
} finally {
  if (Test-Path $lockPath) {
    Remove-Item $lockPath -Force
  }
}
