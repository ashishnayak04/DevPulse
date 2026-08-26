$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Test-Port($port) {
    return Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
}

if (-not (Test-Port 6379)) {
    Write-Host "[1/3] Starting Redis (Docker)..." -ForegroundColor Yellow
    $existing = docker ps -a --filter name=devpulse-redis --format "{{.Names}}" 2>$null
    if ($existing) {
        docker start devpulse-redis 2>$null | Out-Null
    } else {
        docker run -d --name devpulse-redis -p 127.0.0.1:6379:6379 --restart unless-stopped redis:7-alpine 2>$null | Out-Null
    }
    Start-Sleep -Seconds 2
}

if (-not (Test-Port 6379)) {
    Write-Host "ERROR: Redis failed to start on localhost:6379" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[1/3] Redis is up (localhost:6379)" -ForegroundColor Green

if (-not (Test-Port 5432)) {
    Write-Host "WARNING: PostgreSQL does not appear to be running on localhost:5432" -ForegroundColor Red
    Read-Host "Press Enter to exit anyway"
} else {
    Write-Host "[2/3] PostgreSQL is up (localhost:5432)" -ForegroundColor Green
}

Write-Host "[3/3] Launching backend and frontend windows..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev"
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "DevPulse is starting:" -ForegroundColor White
Write-Host "  Frontend : http://localhost:5173"
Write-Host "  Backend  : http://localhost:4000"
Write-Host "This window can be closed."
Start-Sleep -Seconds 3
