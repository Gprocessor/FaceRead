# FaceAttend frontend: npm install when needed, then run Vite.
$ErrorActionPreference = "Stop"
$Root = $env:FACEATTEND_ROOT.TrimEnd("\")
Set-Location $Root
$Host.UI.RawUI.WindowTitle = "FaceAttend - FRONTEND (:5173)"

try {
  # npm.cmd avoids the PowerShell npm.ps1 execution-policy block.
  $npm = "npm.cmd"

  $stamp = Join-Path $Root "node_modules\.deps-installed"
  $pkgFiles = @("package.json", "package-lock.json") | Where-Object { Test-Path (Join-Path $Root $_) }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hashInput = ($pkgFiles | ForEach-Object { Get-Content (Join-Path $Root $_) -Raw }) -join ""
  $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($hashInput)))
  $installed = if (Test-Path $stamp) { Get-Content $stamp -Raw } else { "" }

  if (-not (Test-Path (Join-Path $Root "node_modules")) -or $installed.Trim() -ne $hash) {
    Write-Host "Installing frontend packages..." -ForegroundColor Cyan
    & $npm install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed. If you see 'esbuild EFTYPE', install Node 20 LTS, delete node_modules and try again."
    }
    $pkgFiles = @("package.json", "package-lock.json") | Where-Object { Test-Path (Join-Path $Root $_) }
    $hashInput = ($pkgFiles | ForEach-Object { Get-Content (Join-Path $Root $_) -Raw }) -join ""
    $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($hashInput)))
    Set-Content -Path $stamp -Value $hash
  } else {
    Write-Host "Frontend packages already installed." -ForegroundColor Green
  }

  if (-not (Test-Path (Join-Path $Root ".env"))) {
    if (Test-Path (Join-Path $Root ".env.example")) {
      Copy-Item ".env.example" ".env"
      Write-Host "Created .env from .env.example." -ForegroundColor Yellow
    } else { throw ".env is missing." }
  }

  $env:VITE_BASE = "/"
  Write-Host ""
  Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Green
  & $npm run dev
}
catch {
  Write-Host ""
  Write-Host "FRONTEND ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host "Press Enter to close"
}
