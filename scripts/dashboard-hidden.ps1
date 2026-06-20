# Запуск дашборда без видимого окна консоли (Windows).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Node = (Get-Command node -ErrorAction Stop).Source
$Port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { '3849' }

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
  Write-Host "[dashboard:hidden] Уже слушает порт $Port (PID $($existing.OwningProcess))" -ForegroundColor Yellow
  exit 0
}

Start-Process -FilePath $Node -ArgumentList 'scripts/dashboard-server.mjs' -WorkingDirectory $Root -WindowStyle Hidden
Write-Host "[dashboard:hidden] Дашборд запущен: http://127.0.0.1:$Port" -ForegroundColor Green
