# Friday PowerShell Module - Loaded Successfully!

function Open-Friday {
    param(
        [ValidateSet('ps', 'code', 'explore', '')]
        [string]$Action = 'ps'
    )
    
    $fridayPath = "$env:USERPROFILE\friday"
    
    switch ($Action) {
        'code' {
            Write-Host "💻 Opening in VS Code..." -ForegroundColor Cyan
            code $fridayPath
        }
        'explore' {
            Write-Host "📂 Opening in Explorer..." -ForegroundColor Cyan
            explorer $fridayPath
        }
        default {
            Write-Host "🚀 Navigating to Friday..." -ForegroundColor Cyan
            Set-Location $fridayPath
        }
    }
}

Set-Alias -Name friday -Value Open-Friday -Force
Set-Alias -Name fri -Value Open-Friday -Force

function Get-FridayHelp {
    Write-Host "✅ Friday Module Loaded!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available Commands:" -ForegroundColor Cyan
    Write-Host "  friday              - Navigate to Friday directory"
    Write-Host "  friday code         - Open in VS Code"
    Write-Host "  friday explore      - Open in Explorer"
    Write-Host "  Get-FridayHelp      - Show this help"
    Write-Host ""
}

Write-Host "✅ Friday PowerShell Module loaded!" -ForegroundColor Green
