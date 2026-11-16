$ErrorActionPreference = 'Stop'
# Run from the repository root. Windows may request administrator/UAC approval.
$dashboardService = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
if ($dashboardService) {
    if ($dashboardService.Status -ne 'Running') { Start-Service postgresql-x64-17 }
    Write-Host 'PostgreSQL 17 service already installed. Existing administrator password was preserved.'
    return
}
# Check prerequisites before creating a credential file or installing anything.
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'WinGet is unavailable. Install App Installer or use the official PostgreSQL Windows installer.'
}
$dashboardListener = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
if ($dashboardListener) {
    throw 'Port 5432 is already occupied. Inspect existing PostgreSQL services; use that installation or choose another port in the graphical installer.'
}
if (Test-Path -LiteralPath .postgres-admin.env) {
    # An interrupted attempt must reuse its credential rather than block retries
    # or silently generate a password different from the partially installed server.
    $dashboardCredentialText = Get-Content -LiteralPath .postgres-admin.env -Raw
    $dashboardMatch = [regex]::Match($dashboardCredentialText, '(?m)^POSTGRES_ADMIN_PASSWORD=([a-fA-F0-9]{64})\s*$')
    if (-not $dashboardMatch.Success) { throw 'Existing administrator credential file has an unexpected format; inspect it before retrying.' }
    $dashboardAdminPassword = $dashboardMatch.Groups[1].Value
} else {
    $dashboardAdminPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    Set-Content -LiteralPath .postgres-admin.env -Value "POSTGRES_ADMIN_PASSWORD=$dashboardAdminPassword"
}
winget install --id PostgreSQL.PostgreSQL.17 --exact --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity --override "--mode unattended --unattendedmodeui none --superpassword $dashboardAdminPassword --serverport 5432 --servicename postgresql-x64-17 --enable-components server,commandlinetools --disable-components stackbuilder,pgAdmin"
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL installation failed. Check WinGet logs, then retry; the saved administrator password will be reused.' }
$dashboardService = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
if (-not $dashboardService) { throw 'Installer returned success but the expected service was not found. Inspect the installation before retrying.' }
if ($dashboardService.Status -ne 'Running') { Start-Service postgresql-x64-17 }
Get-Service postgresql-x64-17
