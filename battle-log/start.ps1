$ErrorActionPreference = 'Stop'
$battleUrl = 'http://127.0.0.1:4318'
try {
  Invoke-RestMethod "$battleUrl/api/records" -TimeoutSec 1 | Out-Null
} catch {
  Start-Process -FilePath 'node' -ArgumentList '--preserve-symlinks --preserve-symlinks-main server.js' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
  $battleReady = $false
  for ($battleAttempt = 0; $battleAttempt -lt 30; $battleAttempt++) {
    Start-Sleep -Milliseconds 200
    try { Invoke-RestMethod "$battleUrl/api/records" -TimeoutSec 1 | Out-Null; $battleReady = $true; break } catch {}
  }
  if (-not $battleReady) { throw 'Server did not start. Run node server.js for details.' }
}
Start-Process $battleUrl
