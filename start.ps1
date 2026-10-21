# FaceAttend - checks prerequisites, then opens two PowerShell windows:
#   1) backend  (Python venv + InsightFace + uvicorn on :8000)
#   2) frontend (npm install + Vite on :5173)
$ErrorActionPreference = "Stop"
$Root = $env:FACEATTEND_ROOT.TrimEnd("\")
Set-Location $Root

function Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red }

Write-Host ""
Write-Host "=== FaceAttend local launcher ===" -ForegroundColor Cyan
Write-Host "Project: $Root"
Write-Host ""
Write-Host "Checking prerequisites..." -ForegroundColor Cyan
$problems = 0

$pyVer = $null
try { $pyVer = (& py -3.11 --version) 2>&1 } catch { }
if ($pyVer -match "Python 3\.11") { Ok "$pyVer" }
else {
  Fail "Python 3.11 not found. Install from https://www.python.org/downloads/release/python-3119/ (tick 'Add to PATH')."
  $problems++
}

$nodeVer = $null
try { $nodeVer = (& node -v) 2>&1 } catch { }
if ($nodeVer -match "^v(\d+)") {
  $major = [int]$Matches[1]
  if ($major -eq 20) { Ok "Node $nodeVer" }
  else { Warn "Node $nodeVer detected - Node 20 LTS is recommended (24 can break the bundler)." }
} else {
  Fail "Node.js not found. Install Node 20 LTS from https://nodejs.org"
  $problems++
}

if (Test-Path (Join-Path $Root "backend\app\main.py")) { Ok "backend folder found" }
else { Fail "backend\app\main.py not found - run this from the FaceRead project root."; $problems++ }
if (Test-Path (Join-Path $Root "package.json")) { Ok "frontend package.json found" }
else { Fail "package.json not found - run this from the FaceRead project root."; $problems++ }

if ($problems -gt 0) {
  Write-Host ""
  Fail "Fix the issue(s) above, then run start.bat again."
  Read-Host "Press Enter to exit"
  exit 1
}

foreach ($port in 8000, 5173) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop; Warn "Stopped old process on port $port" } catch { }
  }
}

Write-Host ""
Write-Host "Opening backend window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @("-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command","iex ([IO.File]::ReadAllText(`$env:FACEATTEND_ROOT + 'scripts\run-backend.ps1'))") -WorkingDirectory $Root

Write-Host "Opening frontend window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @("-NoExit","-NoProfile","-ExecutionPolicy","Bypass","-Command","iex ([IO.File]::ReadAllText(`$env:FACEATTEND_ROOT + 'scripts\run-frontend.ps1'))") -WorkingDirectory $Root

Write-Host ""
Write-Host "Waiting for the backend (first run installs packages + downloads the model)..." -ForegroundColor Cyan
$healthy = $false
$r = $null
$deadline = (Get-Date).AddMinutes(30)
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -TimeoutSec 3
    if ($r.status -eq "ok") { $healthy = $true; break }
  } catch { }
  Start-Sleep -Seconds 5
  Write-Host "." -NoNewline
}
Write-Host ""

if ($healthy) {
  Ok "Backend is up - face engine: $($r.face_model)"
  Write-Host "Waiting for the frontend..." -ForegroundColor Cyan
  $fe = $false
  for ($i = 0; $i -lt 120; $i++) {
    try { Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 3 | Out-Null; $fe = $true; break } catch { }
    Start-Sleep -Seconds 3
  }
  if ($fe) { Ok "Frontend is up" } else { Warn "Frontend not responding yet - check its window." }
  Start-Process "http://localhost:5173/#/login"
  Write-Host ""
  Write-Host "FaceAttend is running:" -ForegroundColor Green
  Write-Host "  Kiosk : http://localhost:5173/"
  Write-Host "  Admin : http://localhost:5173/#/login"
  Write-Host "  API   : http://localhost:8000/api/health"
  Write-Host ""
  Write-Host "Close the two server windows (or run stop.bat) to stop."
} else {
  Warn "Backend did not report healthy in time. Check the backend window for errors."
}
Read-Host "Press Enter to close this launcher (servers keep running)"
