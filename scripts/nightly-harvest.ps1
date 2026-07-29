# Ночной harvest Эмиль: тихо поднимает watchdog (без окна).
# Если уже крутится — exit 0 (идемпотентно).
#   powershell -ExecutionPolicy Bypass -File scripts/nightly-harvest.ps1
#
# Важно: пишет в data-emil (через run-with-instance), НЕ в legacy data/.

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $Root "data-emil\logs"
$LogFile = Join-Path $LogDir "nightly-harvest.log"
$Vbs = Join-Path $Root "scripts\run-harvest-watchdog-silent.vbs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Set-Location $Root
Write-Log "nightly-harvest start (cwd=$Root) target=data-emil"

if (-not (Test-Path $Vbs)) {
  Write-Log "ERROR: missing $Vbs"
  exit 1
}

# Silent VBS → run-harvest-watchdog-bg.mjs → run-with-instance --instance=emil
$wscript = Join-Path $env:SystemRoot "System32\wscript.exe"
& $wscript //B $Vbs
$code = $LASTEXITCODE
Write-Log "wscript silent watchdog exit=$code"
exit 0
