# install.ps1
[CmdletBinding()]
param()

$RepoOwner = "ahumuzad077-design"
$RepoName = "friday"
$InstallDir = "$HOME\.friday"
$BinDir = "$HOME\bin"

Write-Host "Installing Friday Assistant..." -ForegroundColor Cyan

# Create directories
if (!(Test-Path $InstallDir)) { New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null }
if (!(Test-Path $BinDir)) { New-Item -ItemType Directory -Force -Path $BinDir | Out-Null }

# Clone or download release zip
$ZipUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/main.zip"
$ZipPath = "$InstallDir\friday.zip"

Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath
Expand-Archive -Path $ZipPath -DestinationPath "$InstallDir\temp" -Force
Move-Item -Path "$InstallDir\temp\$RepoName-main\*" -Destination $InstallDir -Force
Remove-Item -Path "$InstallDir\temp" -Recurse -Force
Remove-Item -Path $ZipPath -Force

# Create a wrapper script (friday.ps1) in a folder on the PATH
$WrapperContent = @"
@("& "$InstallDir\node_modules\.bin\ts-node" "$InstallDir\cli.ts" @args)
"@
Set-Content -Path "$BinDir\friday.ps1" -Value $WrapperContent

# Ensure $BinDir is in user PATH
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$BinDir", "User")
    Write-Host "Added $BinDir to your PATH." -ForegroundColor Green
}

Write-Host "Installation complete! Restart your terminal and run: friday" -ForegroundColor Green