# Interim launcher: дашборд + браузер (до сборки Tauri)
#   npm run desktop:launcher

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { "3849" }
$url = "http://127.0.0.1:$port"

function Test-DashboardUp {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-DashboardUp)) {
  Write-Host "[desktop:launcher] Старт дашборда…"
  Start-Process -FilePath "node" -ArgumentList "scripts/dashboard-server.mjs" -WorkingDirectory $Root -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(25)
  while ((Get-Date) -lt $deadline) {
    if (Test-DashboardUp) { break }
    Start-Sleep -Milliseconds 500
  }
}

if (-not (Test-DashboardUp)) {
  Write-Error "Дашборд не ответил на $url. Запустите: npm run dashboard"
}

Write-Host "[desktop:launcher] $url"
Start-Process $url
