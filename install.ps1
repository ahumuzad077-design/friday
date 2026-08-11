$ScriptContent = @'
[CmdletBinding()]
param()

$RepoOwner = "ahumuzad077-design"
$RepoName = "friday"
$InstallDir = "$HOME\.friday"
$BinDir = "$HOME\bin"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Installing F.R.I.D.A.Y. Assistant...   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (!(Test-Path $InstallDir)) { New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null }
if (!(Test-Path $BinDir)) { New-Item -ItemType Directory -Force -Path $BinDir | Out-Null }

Write-Host "[1/3] Setting up workspace..." -ForegroundColor Yellow
# Copy current local repo files to global installation path
Copy-Item -Path "$PSScriptRoot\*" -Destination $InstallDir -Recurse -Force

Write-Host "[2/3] Installing dependencies..." -ForegroundColor Yellow
Set-Location $InstallDir
if (Get-Command "npm" -ErrorAction SilentlyContinue) {
    npm install
}

Write-Host "[3/3] Configuring PowerShell environment..." -ForegroundColor Yellow
$WrapperContent = @'
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)
$InstallDir = "$HOME\.friday"
node "$InstallDir\cli.js" @Args
'@

Set-Content -Path "$BinDir\friday.ps1" -Value $WrapperContent

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$BinDir", "User")
}

Write-Host "`nInstallation complete! Restart your terminal and type: friday" -ForegroundColor Green
'@

Set-Content -Path "install.ps1" -Value $ScriptContent
Write-Host "install.ps1 created successfully!" -ForegroundColor Green
