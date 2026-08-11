# 🚀 Friday PowerShell Module - Complete Guide

## Overview

The Friday PowerShell Module provides a comprehensive set of functions for:
- Network reconnaissance and scanning
- Security testing and vulnerability assessment
- Server administration and hardening
- Email automation
- Todo/task management
- System information gathering

## Installation

### Quick Setup (Recommended)

```powershell
# Run the setup script
powershell -ExecutionPolicy Bypass -File powershell-profile-setup.ps1

# Close and reopen PowerShell
# Done! All functions are now available
```

### Manual Setup

1. **Clone Friday Repository**
   ```powershell
   git clone https://github.com/ahumuzad077-design/friday.git $env:USERPROFILE\friday
   ```

2. **Add to PowerShell Profile**
   ```powershell
   # Edit your profile
   notepad $PROFILE
   
   # Add this line:
   . "$env:USERPROFILE\friday\Friday-Functions.ps1"
   ```

3. **Reload Profile**
   ```powershell
   . $PROFILE
   ```

## Core Commands

### Repository Navigation

```powershell
# Open Friday directory in PowerShell
friday

# Open in VS Code
friday code

# Open in File Explorer
friday explore

# Quick alias
fri

# Show help
Get-FridayHelp
friday-help
```

## Email Functions

### Configuration

```powershell
# Configure email settings
Set-EmailConfig -SmtpServer smtp.gmail.com -From user@gmail.com

# View current configuration
Get-EmailConfig
```

### Sending Emails

```powershell
# Simple email
Send-FridayEmail -To user@example.com -Subject "Test" -Body "Hello"

# Multiple recipients
Send-FridayEmail -To user1@example.com,user2@example.com `
    -Subject "Report" -Body "Here's the report"

# With attachment
Send-FridayEmail -To user@example.com -Subject "Report" `
    -Body "See attached" -Attachment C:\report.pdf

# HTML email
Send-FridayEmail -To user@example.com -Subject "Newsletter" `
    -Body "<h1>Hello</h1><p>Welcome!</p>" -IsHtml

# Multiple attachments
Send-FridayEmail -To user@example.com -Subject "Files" `
    -Body "Here are the files" `
    -Attachment @("file1.pdf", "file2.xlsx")
```

## Network Functions

### Port Scanning

```powershell
# Basic Nmap scan
Nmap-Scan -Target 192.168.1.1

# With service detection
Nmap-Scan -Target example.com -ServiceDetection

# With OS detection
Nmap-Scan -Target 192.168.1.1 -OSDetection

# Specific ports
Nmap-Scan -Target 192.168.1.1 -Ports "80,443,22"
```

### Network Information

```powershell
# Get network configuration
Get-NetworkInfo

# Show open ports
Get-OpenPorts

# DNS resolution
Test-DNS -Domain example.com

# Subdomain enumeration
Get-SubdomainEnum -Domain example.com
```

## Security Testing

### Vulnerability Assessment

```powershell
# Basic vulnerability check
Test-Vulnerability -Target example.com

# SSL/TLS check
Check-SSL -Domain example.com

# Web application scan
Scan-WebApp -URL http://example.com
```

## Server Functions

### Server Information

```powershell
# Get server details
Get-ServerInfo

# List running services
Check-Services

# Get machine information
Get-MachineInfo
```

## Todo/Task Management

### Add Tasks

```powershell
# Add simple task
Add-Todo "Buy groceries"

# Add task with priority
Add-Todo "Fix critical bug" -Priority High
Add-Todo "Update documentation" -Priority Medium
Add-Todo "Clean up code" -Priority Low
```

### View Tasks

```powershell
# Show all tasks
Get-Todo

# Show active tasks only
Get-Todo -Status Active

# Show completed tasks
Get-Todo -Status Completed

# View statistics
Get-TodoStats
```

### Manage Tasks

```powershell
# Mark task complete (use ID from Get-Todo)
Complete-Todo -Id "task-id"

# Delete task
Remove-Todo -Id "task-id"
```

## Hardening Functions

### Windows Hardening

```powershell
# Get Windows hardening recommendations
Harden-Windows
```

### Linux Hardening

```powershell
# Get Linux hardening recommendations
Harden-Linux
```

## Documentation Functions

### Security Guides

```powershell
# View Friday documentation
Get-FridayDocs

# Security best practices
Get-SecurityGuide

# Hacking tips and tricks
Get-HackingTips
```

## Utility Functions

### Hash Identification

```powershell
# Identify hash type
Convert-HashType -Hash "5d41402abc4b2a76b9719d911017c592"
# Output: MD5 (32 chars)

Convert-HashType -Hash "40bd001563085fc35165329ea1ff5c40ecb2b8cd"
# Output: SHA1 (40 chars)
```

## Examples & Workflows

### Workflow 1: Network Reconnaissance

```powershell
# Start in Friday directory
friday

# Get network info
Get-NetworkInfo

# Scan for open ports
Get-OpenPorts

# DNS resolution
Test-DNS -Domain example.com

# Find subdomains
Get-SubdomainEnum -Domain example.com
```

### Workflow 2: Security Testing

```powershell
# Navigate to Friday
friday

# Run vulnerability check
Test-Vulnerability -Target example.com

# Check SSL/TLS
Check-SSL -Domain example.com

# Web app scanning
Scan-WebApp -URL http://example.com
```

### Workflow 3: Task Management

```powershell
# Add tasks
Add-Todo "Complete security audit" -Priority High
Add-Todo "Update documentation" -Priority Medium
Add-Todo "Code review" -Priority Medium

# View tasks
Get-Todo -Status Active

# Mark complete
Complete-Todo -Id "task-id-here"

# View stats
Get-TodoStats
```

### Workflow 4: Email Automation

```powershell
# Configure email
Set-EmailConfig -SmtpServer smtp.gmail.com -From myemail@gmail.com

# Send report
Send-FridayEmail -To admin@example.com `
    -Subject "Security Report" `
    -Body "Attached is the security audit report" `
    -Attachment C:\reports\security-audit.pdf

# Send to team
Send-FridayEmail `
    -To @("team1@example.com", "team2@example.com") `
    -Subject "Weekly Update" `
    -Body "<h2>Weekly Status</h2><p>All systems operational</p>" `
    -IsHtml
```

## Troubleshooting

### Module Not Loading

```powershell
# Check execution policy
Get-ExecutionPolicy

# If Restricted, set to RemoteSigned
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Manually load module
. "$env:USERPROFILE\friday\Friday-Functions.ps1"
```

### Functions Not Found

```powershell
# Reload profile
. $PROFILE

# Or restart PowerShell
```

### Email Not Sending

```powershell
# Verify configuration
Get-EmailConfig

# Check SMTP server and credentials
# For Gmail: Use app-specific password
# Enable "Less secure app access" or use 2FA
```

### Nmap Not Found

```powershell
# Download from https://nmap.org/download.html
# Add to PATH or use full path:
C:\Program Files\Nmap\nmap.exe -sV 192.168.1.1
```

## Advanced Usage

### Custom Aliases

```powershell
# Add to profile
Set-Alias -Name fh -Value Get-FridayHelp
Set-Alias -Name ft -Value Get-Todo
Set-Alias -Name nt -Value Add-Todo
```

### Functions Piping

```powershell
# Pipe commands
Get-ChildItem | ForEach-Object { Write-Host $_.Name }

# Format output
Get-Todo | Format-Table -AutoSize
```

### Scheduled Tasks

```powershell
# Run Friday commands on schedule
# Example: Daily email report

$action = New-ScheduledTaskAction -Execute powershell.exe `
    -Argument "-NoProfile -Command 'Send-FridayEmail -To admin@example.com -Subject Daily Report -Body Daily scan complete'"

$trigger = New-ScheduledTaskTrigger -Daily -At 9am

Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Friday-DailyReport"
```

## Security Best Practices

### Email Credentials

```powershell
# Use environment variables
$env:FRIDAY_EMAIL_FROM = "user@gmail.com"
$env:FRIDAY_EMAIL_PASSWORD = "app-specific-password"

# Or use secure credential storage
$cred = Get-Credential
Set-EmailConfig -Credential $cred
```

### Testing Authorization

```powershell
# Always verify you have permission before testing
# Keep detailed logs of all testing
# Use isolated test environments when possible
# Document scope and limitations
```

## Resources

- [Friday Repository](https://github.com/ahumuzad077-design/friday)
- [PowerShell Documentation](https://docs.microsoft.com/en-us/powershell/)
- [Nmap Guide](https://nmap.org/book/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review command help: `Get-Help CommandName -Full`
3. Visit the Friday repository
4. Check PowerShell documentation

---

**Remember**: All functions are for authorized testing only. Always obtain written permission before testing any system you don't own.
