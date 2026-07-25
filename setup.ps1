# Project F.R.I.D.A.Y. - Windows PowerShell Setup Script
# This script sets up the local Python virtual environment and installs Node.js dependencies.

Write-Host "Starting F.R.I.D.A.Y. environment setup..." -ForegroundColor Cyan

# 1. Ensure virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
} else {
    Write-Host "Python virtual environment already exists." -ForegroundColor Green
}

# 2. Activate virtual environment and install requirements
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"
python -m pip install --upgrade pip
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt
    Write-Host "Python dependencies installed successfully." -ForegroundColor Green
} else {
    Write-Host "No requirements.txt found, skipping Python package installation." -ForegroundColor DarkYellow
}

# 3. Install Node.js dependencies
if (Test-Path "package.json") {
    Write-Host "Installing Node.js dependencies (TypeScript/MCP services)..." -ForegroundColor Yellow
    npm install
    Write-Host "Node.js dependencies installed successfully." -ForegroundColor Green
} else {
    Write-Host "No package.json found, skipping npm install." -ForegroundColor DarkYellow
}

Write-Host "Setup complete! Activate your Python environment using: .\venv\Scripts\Activate.ps1" -ForegroundColor Cyan
