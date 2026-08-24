# ============================================================================
# Friday PowerShell Profile Setup Script
# ============================================================================
# This script configures your PowerShell profile to load all Friday functions
# Run with: powershell -ExecutionPolicy Bypass -File powershell-profile-setup.ps1
# ============================================================================

Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║     Friday PowerShell Profile Setup                           ║
╚════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Get profile path
$profilePath = $PROFILE
$profileDir = Split-Path -Parent $profilePath
$fridayPath = "$env:USERPROFILE\friday"
$fridayModule = "$fridayPath\Friday-Functions.ps1"

# Create profile directory if needed
if (-not (Test-Path $profileDir)) {
    Write-Host "📁 Creating PowerShell profile directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Clone Friday repository if needed
if (-not (Test-Path $fridayPath)) {
    Write-Host "📥 Cloning Friday repository..." -ForegroundColor Cyan
    git clone https://github.com/ahumuzad077-design/friday.git $fridayPath
    Write-Host "✅ Friday repository cloned!" -ForegroundColor Green
}

# Create or update profile
$profileContent = @"
# ============================================================================
# Friday PowerShell Profile
# Loads all Friday functions and customizations
# ============================================================================

# Load Friday Module
\$fridayModule = \"$fridayModule\"
if (Test-Path \$fridayModule) {
    . \$fridayModule
} else {
    Write-Host \"⚠️  Friday module not found at \$fridayModule\" -ForegroundColor Yellow
}

# Friday Welcome Message
Write-Host \"
╔════════════════════════════════════════════════════════════════╗
║          🚀 Welcome to Friday PowerShell! 🚀                 ║
╚════════════════════════════════════════════════════════════════╝
\" -ForegroundColor Green

Write-Host \"Type 'Get-FridayHelp' for all available commands\" -ForegroundColor Cyan
Write-Host \"\"

# Custom prompt
function prompt {
    Write-Host \"PS \" -NoNewline -ForegroundColor Cyan
    Write-Host \"Friday\" -NoNewline -ForegroundColor Green
    Write-Host \" > \" -NoNewline
    return \" \"
}

# Useful aliases
Set-Alias -Name ll -Value Get-ChildItem -Force
Set-Alias -Name cls -Value Clear-Host -Force
Set-Alias -Name help -Value Get-Help -Force
"@

# Check if profile exists and has Friday content
if (Test-Path $profilePath) {
    $existingContent = Get-Content $profilePath -Raw
    if ($existingContent -like "*Friday*") {
        Write-Host "ℹ️  Friday already in profile" -ForegroundColor Yellow
    }
    else {
        Write-Host "📝 Updating existing profile..." -ForegroundColor Yellow
        Add-Content -Path $profilePath -Value "`n$profileContent" -Encoding UTF8
        Write-Host "✅ Profile updated!" -ForegroundColor Green
    }
}
else {
    Write-Host "📝 Creating new PowerShell profile..." -ForegroundColor Yellow
    $profileContent | Out-File $profilePath -Encoding UTF8 -Force
    Write-Host "✅ Profile created!" -ForegroundColor Green
}

# Display setup completion
Write-Host @"

╔════════════════════════════════════════════════════════════════╗
║                ✨ Setup Complete! ✨                         ║
╚════════════════════════════════════════════════════════════════╝

✅ Profile: $profilePath
✅ Friday Module: $fridayModule
✅ Friday Path: $fridayPath

📌 Next Steps:
   1. Close and reopen PowerShell
   2. Type: Get-FridayHelp
   3. Start using Friday commands!

🎯 Quick Start Commands:
   friday              - Navigate to Friday directory
   Get-FridayHelp      - Show all commands
   Add-Todo "task"     - Add todo item
   Nmap-Scan 192.168.1.1
   Send-FridayEmail

"@ -ForegroundColor Green

Read-Host "Press Enter to finish setup"
