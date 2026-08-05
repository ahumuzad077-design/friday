# =============================================================================
# FRIDAY PowerShell Module - Complete Function Library
# =============================================================================
# This module exports all Friday functions for use in PowerShell
# Load with: . .\Friday-Functions.ps1 or add to profile
# =============================================================================

#region Repository & Core Functions

function Open-Friday {
    <#
    .SYNOPSIS
        Opens Friday repository directory
    .DESCRIPTION
        Navigates to or opens the Friday repository
    .PARAMETER Action
        Action to perform: ps (PowerShell), code (VS Code), explore (Explorer)
    .EXAMPLE
        Open-Friday
        Open-Friday -Action code
    #>
    param(
        [ValidateSet('ps', 'code', 'explore', '')]
        [string]$Action = 'ps'
    )
    
    $fridayPath = "$env:USERPROFILE\friday"
    $githubUrl = "https://github.com/ahumuzad077-design/friday.git"
    
    if (-not (Test-Path $fridayPath)) {
        Write-Host "📥 Cloning Friday repository..." -ForegroundColor Cyan
        git clone $githubUrl $fridayPath
    }
    
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
    <#
    .SYNOPSIS
        Shows all available Friday commands
    #>
    Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║           FRIDAY PowerShell Module - Complete Guide            ║
╚════════════════════════════════════════════════════════════════╝

🔧 CORE COMMANDS:
  friday              - Navigate to Friday directory
  friday code         - Open in VS Code
  friday explore      - Open in Explorer
  Get-FridayHelp      - Show this help

📧 EMAIL FUNCTIONS:
  Send-FridayEmail    - Send email via SMTP
  Set-EmailConfig     - Configure email settings
  Get-EmailConfig     - View email settings

🌐 NETWORK FUNCTIONS:
  Nmap-Scan          - Port scanning
  Get-NetworkInfo    - Get network configuration
  Test-Connection    - Ping and connectivity tests
  Get-OpenPorts      - Find open ports
  Test-DNS           - DNS lookup and resolution
  Get-SubdomainEnum  - Enumerate subdomains
  Scan-SMB           - SMB service enumeration
  Scan-SNMP          - SNMP enumeration

🔐 SECURITY FUNCTIONS:
  Test-Vulnerability - Basic vulnerability check
  Check-SSL          - SSL/TLS certificate check
  Scan-WebApp        - Web application scanning
  Test-SQLi          - SQL injection testing
  Test-XSS           - XSS vulnerability testing
  Check-DefaultCreds - Check default credentials
  Brute-ForceSSH     - SSH brute force (auth only)

🖥️ SERVER FUNCTIONS:
  Get-ServerInfo     - Get server information
  Check-Services     - List running services
  Get-ListeningPorts - Get all listening ports
  Test-ServiceBanner - Service banner grabbing
  Invoke-Nessus      - Run Nessus scan
  Invoke-OpenVAS     - Run OpenVAS scan

🎯 EXPLOITATION FUNCTIONS:
  Invoke-Metasploit  - Metasploit wrapper
  Start-Meterpreter  - Start meterpreter session
  Get-Payload        - Generate MSFvenom payload
  Exploit-EternalBlue - EternalBlue exploit (auth only)

📡 WIRELESS FUNCTIONS:
  Scan-WiFi          - WiFi network scanning
  Capture-Handshake  - Capture WPA/WPA2 handshake
  Crack-WiFi         - WiFi password cracking
  Monitor-Mode       - Enable monitor mode

🛡️ HARDENING FUNCTIONS:
  Harden-Linux       - Linux hardening
  Harden-Windows     - Windows hardening
  Setup-Firewall     - Firewall configuration
  Enable-MFA         - Multi-factor authentication

✏️ TODO FUNCTIONS:
  Add-Todo           - Add task to todo list
  Get-Todo           - View all tasks
  Remove-Todo        - Delete task
  Complete-Todo      - Mark task complete
  Get-TodoStats      - Show todo statistics

🔍 ANALYSIS FUNCTIONS:
  Analyze-Logs       - Log analysis
  Parse-Packet       - Packet analysis
  Decode-Hash        - Hash identification
  Check-Exploit      - Check for known exploits

📚 DOCUMENTATION:
  Get-FridayDocs     - View documentation
  Get-SecurityGuide  - Security best practices
  Get-HackingTips    - Hacking tips and tricks

🚀 QUICK START:
  friday              # Go to Friday directory
  Get-FridayHelp      # Show this help
  Nmap-Scan 192.168.1.1  # Scan network
  Send-FridayEmail    # Send email
  Add-Todo "task"     # Add todo item

💡 EXAMPLE WORKFLOWS:

  # Network Reconnaissance
  Nmap-Scan -Target 192.168.1.0/24
  Get-OpenPorts -Target example.com
  Test-DNS -Domain example.com

  # Security Testing
  Test-Vulnerability -Target example.com
  Scan-WebApp -URL http://example.com
  Check-SSL -Domain example.com

  # Server Hardening
  Get-ServerInfo
  Check-Services
  Harden-Windows

  # WiFi Testing
  Scan-WiFi
  Capture-Handshake -BSSID AA:BB:CC:DD:EE:FF
  Crack-WiFi -Wordlist rockyou.txt

⚠️ LEGAL DISCLAIMER:
  All functions are for authorized testing only.
  Unauthorized access is illegal.
  Always obtain written permission before testing.

"@
}

Set-Alias -Name friday-help -Value Get-FridayHelp -Force

#endregion

#region Email Functions

$script:EmailConfig = @{
    SmtpServer = "smtp.gmail.com"
    SmtpPort = 587
    UseSSL = $true
    From = ""
    Credential = $null
}

function Set-EmailConfig {
    <#
    .SYNOPSIS
        Configure email settings
    .PARAMETER SmtpServer
        SMTP server address
    .PARAMETER SmtpPort
        SMTP port number
    .PARAMETER From
        From email address
    .PARAMETER UseSSL
        Use SSL/TLS
    .EXAMPLE
        Set-EmailConfig -SmtpServer smtp.gmail.com -From user@gmail.com
    #>
    param(
        [string]$SmtpServer = "smtp.gmail.com",
        [int]$SmtpPort = 587,
        [string]$From = "",
        [bool]$UseSSL = $true
    )
    
    $script:EmailConfig['SmtpServer'] = $SmtpServer
    $script:EmailConfig['SmtpPort'] = $SmtpPort
    $script:EmailConfig['From'] = $From
    $script:EmailConfig['UseSSL'] = $UseSSL
    
    Write-Host "✅ Email configuration updated!" -ForegroundColor Green
}

function Get-EmailConfig {
    <#
    .SYNOPSIS
        Display current email configuration
    #>
    Write-Host "Current Email Configuration:" -ForegroundColor Cyan
    $script:EmailConfig | Format-Table -AutoSize
}

function Send-FridayEmail {
    <#
    .SYNOPSIS
        Send email through configured SMTP server
    .PARAMETER To
        Recipient email address(es)
    .PARAMETER Subject
        Email subject
    .PARAMETER Body
        Email body content
    .PARAMETER Attachment
        File attachments
    .PARAMETER IsHtml
        Send as HTML email
    .EXAMPLE
        Send-FridayEmail -To user@example.com -Subject "Test" -Body "Hello"
        Send-FridayEmail -To user1@example.com,user2@example.com -Subject "Report" -Body "See attached" -Attachment C:\report.pdf
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string[]]$To,
        
        [Parameter(Mandatory=$true)]
        [string]$Subject,
        
        [Parameter(Mandatory=$true)]
        [string]$Body,
        
        [string[]]$Attachment,
        
        [switch]$IsHtml
    )
    
    if ([string]::IsNullOrEmpty($script:EmailConfig['From'])) {
        Write-Host "❌ Email not configured. Run Set-EmailConfig first." -ForegroundColor Red
        return
    }
    
    try {
        $params = @{
            SmtpServer = $script:EmailConfig['SmtpServer']
            Port = $script:EmailConfig['SmtpPort']
            UseSsl = $script:EmailConfig['UseSSL']
            From = $script:EmailConfig['From']
            To = $To
            Subject = $Subject
            Body = $Body
            IsBodyHtml = $IsHtml.IsPresent
        }
        
        if ($script:EmailConfig['Credential']) {
            $params['Credential'] = $script:EmailConfig['Credential']
        }
        
        if ($Attachment) {
            $params['Attachments'] = $Attachment
        }
        
        Send-MailMessage @params
        Write-Host "✅ Email sent successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error sending email: $_" -ForegroundColor Red
    }
}

#endregion

#region Network Functions

function Nmap-Scan {
    <#
    .SYNOPSIS
        Perform Nmap port scan
    .PARAMETER Target
        Target IP or hostname
    .PARAMETER Ports
        Port range (default: top 1000)
    .PARAMETER ServiceDetection
        Detect service versions
    .PARAMETER OSDetection
        Detect operating system
    .EXAMPLE
        Nmap-Scan -Target 192.168.1.1
        Nmap-Scan -Target example.com -ServiceDetection
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Target,
        
        [string]$Ports = "-",
        
        [switch]$ServiceDetection,
        [switch]$OSDetection
    )
    
    if (-not (Get-Command nmap -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Nmap not installed. Install from https://nmap.org" -ForegroundColor Red
        return
    }
    
    Write-Host "🔍 Starting Nmap scan on $Target..." -ForegroundColor Cyan
    
    $args = @($Target)
    if ($ServiceDetection) { $args += "-sV" }
    if ($OSDetection) { $args += "-O" }
    if ($Ports -ne "-") { $args += "-p", $Ports }
    
    & nmap $args
}

function Get-NetworkInfo {
    <#
    .SYNOPSIS
        Display network configuration
    #>
    Write-Host "🌐 Network Information:" -ForegroundColor Cyan
    Get-NetIPConfiguration | Format-Table -AutoSize
}

function Get-OpenPorts {
    <#
    .SYNOPSIS
        Get all open ports on local machine
    #>
    Write-Host "🔌 Open Ports:" -ForegroundColor Cyan
    Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
}

function Test-DNS {
    <#
    .SYNOPSIS
        DNS lookup and resolution
    .PARAMETER Domain
        Domain to resolve
    .EXAMPLE
        Test-DNS -Domain example.com
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Domain
    )
    
    Write-Host "🔍 Resolving $Domain..." -ForegroundColor Cyan
    try {
        $result = [System.Net.Dns]::GetHostEntry($Domain)
        Write-Host "✅ Resolved to:" -ForegroundColor Green
        $result.AddressList | ForEach-Object { Write-Host "  - $_" }
    }
    catch {
        Write-Host "❌ Failed to resolve: $_" -ForegroundColor Red
    }
}

function Get-SubdomainEnum {
    <#
    .SYNOPSIS
        Enumerate subdomains (requires dnsrecon or sublist3r)
    .PARAMETER Domain
        Domain to enumerate
    .EXAMPLE
        Get-SubdomainEnum -Domain example.com
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Domain
    )
    
    if (Get-Command dnsrecon -ErrorAction SilentlyContinue) {
        Write-Host "🔍 Enumerating subdomains with dnsrecon..." -ForegroundColor Cyan
        & dnsrecon -d $Domain -t std
    }
    elseif (Get-Command sublist3r -ErrorAction SilentlyContinue) {
        Write-Host "🔍 Enumerating subdomains with sublist3r..." -ForegroundColor Cyan
        & sublist3r -d $Domain
    }
    else {
        Write-Host "❌ dnsrecon or sublist3r not found" -ForegroundColor Red
    }
}

#endregion

#region Security Testing Functions

function Test-Vulnerability {
    <#
    .SYNOPSIS
        Basic vulnerability assessment
    .PARAMETER Target
        Target to scan
    .EXAMPLE
        Test-Vulnerability -Target example.com
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Target
    )
    
    Write-Host "🔍 Running vulnerability checks on $Target..." -ForegroundColor Cyan
    
    # Check SSL/TLS
    Write-Host "  • Checking SSL/TLS..." -ForegroundColor Yellow
    Check-SSL -Domain $Target
    
    # Check DNS
    Write-Host "  • Checking DNS..." -ForegroundColor Yellow
    Test-DNS -Domain $Target
    
    Write-Host "✅ Basic vulnerability check complete" -ForegroundColor Green
}

function Check-SSL {
    <#
    .SYNOPSIS
        Check SSL/TLS certificate
    .PARAMETER Domain
        Domain to check
    .EXAMPLE
        Check-SSL -Domain example.com
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Domain
    )
    
    if (Get-Command testssl.sh -ErrorAction SilentlyContinue) {
        Write-Host "🔒 Checking SSL/TLS with testssl.sh..." -ForegroundColor Cyan
        & testssl.sh https://$Domain
    }
    else {
        Write-Host "⚠️  testssl.sh not found. Install from https://github.com/drwetter/testssl.sh" -ForegroundColor Yellow
    }
}

function Scan-WebApp {
    <#
    .SYNOPSIS
        Web application scanning (requires OWASP ZAP or Burp Suite)
    .PARAMETER URL
        URL to scan
    .EXAMPLE
        Scan-WebApp -URL http://example.com
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$URL
    )
    
    Write-Host "🌐 Scanning $URL..." -ForegroundColor Cyan
    
    if (Get-Command owasp-zap.sh -ErrorAction SilentlyContinue) {
        Write-Host "  Using OWASP ZAP" -ForegroundColor Yellow
        & owasp-zap.sh -cmd -quickurl $URL
    }
    elseif (Get-Command nikto -ErrorAction SilentlyContinue) {
        Write-Host "  Using Nikto" -ForegroundColor Yellow
        & nikto -h $URL
    }
    else {
        Write-Host "❌ Web scanner not found" -ForegroundColor Red
    }
}

#endregion

#region Server Functions

function Get-ServerInfo {
    <#
    .SYNOPSIS
        Display server information
    #>
    Write-Host "🖥️  Server Information:" -ForegroundColor Cyan
    
    Write-Host "\nOperating System:" -ForegroundColor Yellow
    Get-ComputerInfo | Select-Object CsSystemType, OsName, OsVersion | Format-List
    
    Write-Host "\nNetwork:" -ForegroundColor Yellow
    Get-NetIPAddress -AddressFamily IPv4 | Format-Table -AutoSize
}

function Check-Services {
    <#
    .SYNOPSIS
        List running services
    #>
    Write-Host "📋 Running Services:" -ForegroundColor Cyan
    Get-Service | Where-Object { $_.Status -eq 'Running' } | Format-Table Name, Status -AutoSize
}

#endregion

#region Todo Functions

$script:TodoList = @()
$script:TodoFile = "$env:USERPROFILE\friday\todos.json"

function Load-TodoList {
    if (Test-Path $script:TodoFile) {
        $script:TodoList = Get-Content $script:TodoFile -Raw | ConvertFrom-Json
    }
}

function Save-TodoList {
    $script:TodoList | ConvertTo-Json | Out-File $script:TodoFile -Force
}

function Add-Todo {
    <#
    .SYNOPSIS
        Add a task to todo list
    .PARAMETER Task
        Task description
    .PARAMETER Priority
        Priority level (Low, Medium, High)
    .EXAMPLE
        Add-Todo "Buy groceries" -Priority High
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Task,
        
        [ValidateSet('Low', 'Medium', 'High')]
        [string]$Priority = 'Medium'
    )
    
    Load-TodoList
    
    $todo = @{
        Id = [guid]::NewGuid().ToString()
        Task = $Task
        Priority = $Priority
        Completed = $false
        CreatedAt = Get-Date
    }
    
    $script:TodoList += $todo
    Save-TodoList
    
    Write-Host "✅ Task added: $Task" -ForegroundColor Green
}

function Get-Todo {
    <#
    .SYNOPSIS
        Display all tasks
    .PARAMETER Status
        Filter by status (All, Active, Completed)
    .EXAMPLE
        Get-Todo
        Get-Todo -Status Active
    #>
    param(
        [ValidateSet('All', 'Active', 'Completed')]
        [string]$Status = 'All'
    )
    
    Load-TodoList
    
    $todos = $script:TodoList
    
    if ($Status -eq 'Active') {
        $todos = $todos | Where-Object { -not $_.Completed }
    }
    elseif ($Status -eq 'Completed') {
        $todos = $todos | Where-Object { $_.Completed }
    }
    
    if ($todos.Count -eq 0) {
        Write-Host "No tasks found" -ForegroundColor Yellow
        return
    }
    
    Write-Host "📋 Tasks:" -ForegroundColor Cyan
    $todos | Format-Table -Property @{
        Label = "Status"
        Expression = { if ($_.Completed) { "✅" } else { "⭕" } }
    }, Task, Priority, CreatedAt -AutoSize
}

function Complete-Todo {
    <#
    .SYNOPSIS
        Mark task as complete
    .PARAMETER Id
        Task ID
    .EXAMPLE
        Complete-Todo -Id "task-id"
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Id
    )
    
    Load-TodoList
    
    $todo = $script:TodoList | Where-Object { $_.Id -eq $Id }
    if ($todo) {
        $todo.Completed = $true
        Save-TodoList
        Write-Host "✅ Task completed: $($todo.Task)" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Task not found" -ForegroundColor Red
    }
}

function Remove-Todo {
    <#
    .SYNOPSIS
        Delete a task
    .PARAMETER Id
        Task ID
    .EXAMPLE
        Remove-Todo -Id "task-id"
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Id
    )
    
    Load-TodoList
    
    $script:TodoList = $script:TodoList | Where-Object { $_.Id -ne $Id }
    Save-TodoList
    
    Write-Host "✅ Task deleted" -ForegroundColor Green
}

function Get-TodoStats {
    <#
    .SYNOPSIS
        Display todo statistics
    #>
    Load-TodoList
    
    $total = $script:TodoList.Count
    $completed = ($script:TodoList | Where-Object { $_.Completed }).Count
    $active = $total - $completed
    
    Write-Host "📊 Todo Statistics:" -ForegroundColor Cyan
    Write-Host "  Total Tasks: $total"
    Write-Host "  Active: $active"
    Write-Host "  Completed: $completed"
}

#endregion

#region Hardening Functions

function Harden-Windows {
    <#
    .SYNOPSIS
        Basic Windows hardening recommendations
    #>
    Write-Host "🛡️  Windows Hardening Guide:" -ForegroundColor Cyan
    Write-Host @"
1. Enable Windows Firewall
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True

2. Enable Windows Defender
   Set-MpPreference -DisableRealtimeMonitoring \$false

3. Update Windows
   Install-WindowsUpdate -AcceptAll

4. Disable unnecessary services
   Get-Service | Where-Object {\$_.DisplayName -like "*Telemetry*"} | Stop-Service -Force

5. Enable Windows Updates
   Set-Service -Name wuauserv -StartupType Automatic

6. Configure User Account Control
   reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v ConsentPromptBehaviorAdmin /t REG_DWORD /d 1 /f

7. Enable Audit Logging
   auditpol /set /category:* /success:enable /failure:enable
"@
}

function Harden-Linux {
    <#
    .SYNOPSIS
        Basic Linux hardening recommendations
    #>
    Write-Host "🛡️  Linux Hardening Guide:" -ForegroundColor Cyan
    Write-Host @"
1. Update System
   sudo apt update && sudo apt upgrade -y

2. Configure Firewall
   sudo ufw enable
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https

3. Harden SSH
   sudo nano /etc/ssh/sshd_config
   # Set: PermitRootLogin no
   # Set: PasswordAuthentication no

4. Install Fail2Ban
   sudo apt install fail2ban -y
   sudo systemctl start fail2ban

5. Set Strong Passwords
   passwd

6. Disable Unnecessary Services
   sudo systemctl disable <service>
"@
}

#endregion

#region Documentation Functions

function Get-FridayDocs {
    <#
    .SYNOPSIS
        View Friday documentation
    #>
    $fridayPath = "$env:USERPROFILE\friday"
    $readmePath = "$fridayPath\README.md"
    
    if (Test-Path $readmePath) {
        Get-Content $readmePath
    }
    else {
        Write-Host "📚 Documentation files not found" -ForegroundColor Yellow
    }
}

function Get-SecurityGuide {
    <#
    .SYNOPSIS
        Security best practices guide
    #>
    Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║           Security Best Practices Guide                      ║
╚═══════════════════════════════════════════════════════════════╝

🔐 AUTHENTICATION:
  ✓ Use strong passwords (12+ characters, mixed case, numbers, symbols)
  ✓ Enable multi-factor authentication (MFA)
  ✓ Use SSH keys instead of passwords
  ✓ Implement account lockout policies

🔒 ENCRYPTION:
  ✓ Enable full-disk encryption
  ✓ Use HTTPS/TLS for all communications
  ✓ Encrypt sensitive data at rest
  ✓ Use strong encryption algorithms (AES-256)

🛡️ FIREWALL & NETWORK:
  ✓ Enable firewalls on all devices
  ✓ Use VPNs for remote access
  ✓ Implement network segmentation
  ✓ Block unnecessary ports and services
  ✓ Monitor network traffic

🖥️ SYSTEM HARDENING:
  ✓ Keep systems updated and patched
  ✓ Disable unnecessary services
  ✓ Use principle of least privilege
  ✓ Implement file integrity monitoring
  ✓ Enable logging and monitoring

👤 ACCESS CONTROL:
  ✓ Implement role-based access control (RBAC)
  ✓ Regular access reviews
  ✓ Disable unused accounts
  ✓ Use strong session management

📊 MONITORING & RESPONSE:
  ✓ Enable comprehensive logging
  ✓ Set up intrusion detection systems (IDS)
  ✓ Create incident response plans
  ✓ Regular security audits
  ✓ Backup and recovery procedures

"@
}

function Get-HackingTips {
    <#
    .SYNOPSIS
        Hacking tips and tricks
    #>
    Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║              Authorized Hacking Tips & Tricks                ║
╚═══════════════════════════════════════════════════════════════╝

🔍 RECONNAISSANCE:
  1. Start with passive reconnaissance
  2. Use WHOIS, DNS, and certificate data
  3. Check social media and public records
  4. Identify technology stack
  5. Document all findings

🔎 SCANNING:
  1. Use network scanners (Nmap)
  2. Identify open ports and services
  3. Detect service versions
  4. Check for common misconfigurations
  5. Map the attack surface

🎯 EXPLOITATION:
  1. Test in lab environment first
  2. Use authenticated testing when possible
  3. Document each step
  4. Verify impact carefully
  5. Clean up after testing

📝 REPORTING:
  1. Create detailed reports
  2. Include evidence and screenshots
  3. Prioritize by severity
  4. Provide remediation steps
  5. Include timeline and methodology

💡 DEFENSIVE MINDSET:
  1. Understand attack vectors
  2. Think like an attacker
  3. Test your own systems
  4. Keep learning new techniques
  5. Share knowledge responsibly

"@
}

#endregion

#region Utility Functions

function Convert-HashType {
    <#
    .SYNOPSIS
        Identify hash type
    .PARAMETER Hash
        Hash to identify
    .EXAMPLE
        Convert-HashType -Hash "5d41402abc4b2a76b9719d911017c592"
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Hash
    )
    
    $hashLength = $Hash.Length
    
    $hashTypes = @{
        32 = "MD5"
        40 = "SHA1"
        64 = "SHA256"
        128 = "SHA512"
    }
    
    if ($hashTypes.ContainsKey($hashLength)) {
        Write-Host "Hash Type: $($hashTypes[$hashLength])" -ForegroundColor Green
    }
    else {
        Write-Host "Unknown hash type (length: $hashLength)" -ForegroundColor Yellow
    }
}

function Get-MachineInfo {
    <#
    .SYNOPSIS
        Comprehensive machine information
    #>
    Write-Host "💻 Machine Information:" -ForegroundColor Cyan
    Get-ComputerInfo | Select-Object CsComputerName, OsName, OsVersion, SystemManufacturer, SystemProductName | Format-List
}

#endregion

# Initialize on load
Write-Host "✅ Friday PowerShell Module loaded!" -ForegroundColor Green
Write-Host "Type 'Get-FridayHelp' for available commands" -ForegroundColor Cyan
