# Stop anything listening on the FaceAttend ports.
foreach ($port in 8000, 5173) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) { Write-Host "Nothing running on port $port"; continue }
  foreach ($c in $conns) {
    try { Stop-Process -Id $c.OwningProcess -Force; Write-Host "Stopped process $($c.OwningProcess) on port $port" -ForegroundColor Green }
    catch { Write-Host "Could not stop process on port $port" -ForegroundColor Yellow }
  }
}
