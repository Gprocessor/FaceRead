# FaceAttend backend: create venv (Python 3.11), install deps when needed, run uvicorn.
$ErrorActionPreference = "Stop"
$Root = $env:FACEATTEND_ROOT.TrimEnd("\")
$Backend = Join-Path $Root "backend"
Set-Location $Backend
$Host.UI.RawUI.WindowTitle = "FaceAttend - BACKEND (:8000)"

$venvPy  = Join-Path $Backend ".venv\Scripts\python.exe"
$reqFile = Join-Path $Backend "requirements-insightface.txt"
$stamp   = Join-Path $Backend ".venv\.deps-installed"

try {
  if (-not (Test-Path $venvPy)) {
    Write-Host "Creating Python 3.11 virtual environment..." -ForegroundColor Cyan
    & py -3.11 -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "Could not create the venv. Is Python 3.11 installed?" }
  }

  # Reinstall only when the requirements files changed since the last install.
  $hashInput = (Get-Content $reqFile -Raw) + (Get-Content (Join-Path $Backend "requirements-base.txt") -Raw)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($hashInput)))
  $installed = if (Test-Path $stamp) { Get-Content $stamp -Raw } else { "" }

  if ($installed.Trim() -ne $hash) {
    Write-Host "Installing backend dependencies (first run takes a while)..." -ForegroundColor Cyan
    & $venvPy -m pip install --upgrade pip
    & $venvPy -m pip install -r $reqFile
    if ($LASTEXITCODE -ne 0) {
      throw "pip install failed. If you see 'Microsoft Visual C++ 14.0 or greater is required', install C++ Build Tools ('Desktop development with C++') and reboot."
    }
    Set-Content -Path $stamp -Value $hash
  } else {
    Write-Host "Backend dependencies already installed." -ForegroundColor Green
  }

  if (-not (Test-Path (Join-Path $Backend ".env"))) {
    if (Test-Path (Join-Path $Backend ".env.example")) {
      Copy-Item ".env.example" ".env"
      Write-Host "Created backend\.env from .env.example." -ForegroundColor Yellow
    } else { throw "backend\.env is missing." }
  }

  Write-Host ""
  Write-Host "Starting backend on http://localhost:8000 ..." -ForegroundColor Green
  & $venvPy -m uvicorn app.main:app --reload --port 8000 --env-file .env
}
catch {
  Write-Host ""
  Write-Host "BACKEND ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host "Press Enter to close"
}
