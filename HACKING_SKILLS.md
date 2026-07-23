# 🛡️ Hacking Skills Guide

A comprehensive resource covering ethical hacking, programming tricks, productivity hacks, and security best practices.

## Table of Contents
1. [Ethical Hacking & Cybersecurity](#ethical-hacking--cybersecurity)
2. [Programming Hacks & Tricks](#programming-hacks--tricks)
3. [Productivity & Life Hacks](#productivity--life-hacks)
4. [Repository-Specific Techniques](#repository-specific-techniques)

---

## 🔐 Ethical Hacking & Cybersecurity

### Core Principles

**The Cybersecurity Lifecycle:**
1. **Reconnaissance** - Gather information about target systems (DNS, IP ranges, open ports)
2. **Scanning & Enumeration** - Identify vulnerabilities and services
3. **Exploitation** - Leverage known vulnerabilities to gain access
4. **Post-Exploitation** - Maintain access, escalate privileges, cover tracks
5. **Reporting** - Document findings and remediation steps

### Essential Tools

| Tool | Purpose | Use Case |
|------|---------|----------|
| **Nmap** | Network mapping and port scanning | Identify open ports and services |
| **Metasploit** | Exploitation framework | Test vulnerabilities systematically |
| **Burp Suite** | Web application testing | Find XSS, SQLi, CSRF vulnerabilities |
| **Wireshark** | Network packet analysis | Monitor network traffic |
| **SQLmap** | SQL injection testing | Automate SQLi vulnerability detection |
| **Hashcat** | Password cracking | Brute-force password hashes |
| **John the Ripper** | Hash cracking | Crack weak password hashes |
| **Aircrack-ng** | WiFi security testing | Test wireless network security |

### OWASP Top 10 Vulnerabilities

1. **Broken Access Control** - Users can act outside intended permissions
2. **Cryptographic Failures** - Sensitive data exposure
3. **Injection** - SQL, OS, or LDAP injection attacks
4. **Insecure Design** - Missing security controls
5. **Security Misconfiguration** - Default passwords, unnecessary features enabled
6. **Vulnerable & Outdated Components** - Using known vulnerable libraries
7. **Authentication Failures** - Broken login, session management
8. **Software & Data Integrity Failures** - Unsafe CI/CD pipelines
9. **Logging & Monitoring Failures** - Insufficient logging of security events
10. **Server-Side Request Forgery (SSRF)** - Server makes unintended requests

### Quick Security Wins

```bash
# 1. Check for known vulnerabilities in dependencies
npm audit                          # Node.js
pip check                          # Python
bundle audit                       # Ruby

# 2. Scan for security issues in code
eslint --ext .js --plugin security    # JavaScript
bandit -r .                           # Python
semgrep --config=p/security-audit     # Multi-language

# 3. Check SSL/TLS certificate
openssl s_client -connect example.com:443

# 4. Test password strength
crunch 8 8 -o wordlist.txt          # Generate password combinations
hashcat -a 3 -m 1000 hash.txt       # Crack passwords

# 5. Find default credentials
# Check /var/www/html, /opt, config files for:
# admin:admin, root:root, default:default
```

### Learning Resources

- **HackTheBox** - Real-world hacking scenarios
- **TryHackMe** - Beginner-friendly security labs
- **PortSwigger Web Security Academy** - Free web security training
- **PentesterLab** - Hands-on penetration testing
- **OWASP Top 10 Course** - Official vulnerability guide

### Setup Home Lab

```bash
# Vulnerable VMs for practice:
# 1. DVWA (Damn Vulnerable Web Application)
# 2. WebGoat (OWASP learning tool)
# 3. Metasploitable (Linux practice target)
# 4. HackTheBox (Online platform)

# Docker setup for local labs
docker run -p 80:80 vulnerables/web-dvwa
```

---

## 💻 Programming Hacks & Clever Tricks

### JavaScript/TypeScript

#### Early Return Pattern
```javascript
// ❌ Bad: Nested conditions
if (user) {
    if (user.isActive) {
        if (user.isPremium) {
            processUser(user);
        }
    }
}

// ✅ Good: Early return
if (!user) return;
if (!user.isActive) return;
if (!user.isPremium) return;
processUser(user);
```

#### Object Spread & Immutability
```javascript
// Avoid mutation
const updated = { ...obj, newField: value };
const filtered = arr.filter(x => x > 5);

// Deep clone
const deepClone = JSON.parse(JSON.stringify(obj));
```

#### Destructuring with Defaults
```javascript
const { name = 'Guest', role = 'user', email = 'no-email@example.com' } = userData;

// Renaming during destructuring
const { userId: id, userName: name } = user;
```

#### Optional Chaining & Nullish Coalescing
```javascript
// Optional chaining (?.) - returns undefined if property doesn't exist
const email = user?.profile?.email;

// Nullish coalescing (??) - use default for null/undefined
const email = user?.profile?.email ?? 'no-email@example.com';

// Safe array access
const firstItem = arr?.[0];
const result = func?.();
```

#### Powerful Array Methods
```javascript
// map - transform each element
const doubled = [1, 2, 3].map(x => x * 2);  // [2, 4, 6]

// filter - keep matching elements
const evens = [1, 2, 3, 4].filter(x => x % 2 === 0);  // [2, 4]

// reduce - combine into single value
const sum = [1, 2, 3, 4].reduce((acc, x) => acc + x, 0);  // 10

// find - get first matching element
const user = users.find(u => u.id === 5);

// some/every - boolean checks
const hasAdmin = users.some(u => u.role === 'admin');
const allActive = users.every(u => u.isActive);
```

### Python

#### List Comprehensions
```python
# ❌ Verbose
squares = []
for x in range(10):
    squares.append(x ** 2)

# ✅ Concise and faster
squares = [x ** 2 for x in range(10)]

# With conditions
evens = [x for x in nums if x % 2 == 0]

# Nested
flattened = [item for sublist in nested_list for item in sublist]
```

#### Walrus Operator (:=)
```python
# Python 3.8+ - assign and use in one expression
if (n := len(data)) > 10:
    print(f"Large list: {n}")

# In loops
while (line := f.readline()) != '':
    process(line)
```

#### *args and **kwargs
```python
# *args: variable positional arguments
def flexible(*args):
    for arg in args:
        print(arg)

flexible(1, 2, 3)  # Prints: 1, 2, 3

# **kwargs: variable keyword arguments
def flexible(**kwargs):
    for key, value in kwargs.items():
        print(f"{key}: {value}")

flexible(name="Alice", age=30)  # Prints: name: Alice, age: 30

# Combine both
def super_flexible(*args, **kwargs):
    print(args, kwargs)
```

#### Context Managers
```python
# Automatically handles resource cleanup
with open('file.txt') as f:
    content = f.read()
    # File automatically closes

# Custom context manager
class DatabaseConnection:
    def __enter__(self):
        self.conn = create_connection()
        return self.conn
    
    def __exit__(self, *args):
        self.conn.close()

with DatabaseConnection() as db:
    db.execute("SELECT * FROM users")
```

### General Programming Patterns

#### Memoization - Cache Function Results
```javascript
// ❌ Slow - recalculates every time
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// ✅ Fast - caches results
const memo = {};
function fibonacci(n) {
    if (n in memo) return memo[n];
    if (n <= 1) return n;
    memo[n] = fibonacci(n - 1) + fibonacci(n - 2);
    return memo[n];
}
```

#### Generator Functions - Lazy Evaluation
```javascript
// Saves memory - generates values on demand
function* infiniteSequence() {
    let i = 0;
    while (true) {
        yield i++;
    }
}

const gen = infiniteSequence();
console.log(gen.next().value);  // 0
console.log(gen.next().value);  // 1
```

#### Composition - Build from Simple Functions
```javascript
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;
const square = (n) => multiply(n, n);
const addAndSquare = (a, b) => square(add(a, b));

addAndSquare(2, 3);  // (2+3)² = 25
```

#### Decorators - Add Functionality
```python
# Python decorator
def timing_decorator(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        print(f"Took {time.time() - start}s")
        return result
    return wrapper

@timing_decorator
def slow_function():
    time.sleep(2)
```

---

## ⚡ Productivity & Life Hacks

### Developer Workflow Optimizations

#### Terminal & Shell

```bash
# Git aliases - save typing
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'

# Now use: git co, git br, etc.

# Shell aliases - add to ~/.bashrc or ~/.zshrc
alias ll='ls -lah'
alias gs='git status'
alias ga='git add'
alias gc='git commit -m'
alias gp='git push'
alias cd..='cd ..'

# Search git history
git log -S "functionName" --oneline          # Search by content
git log --grep="feature" --oneline            # Search by message
git log --author="John" --oneline             # Search by author

# Find large files
find . -type f -size +100M -exec ls -lh {} \;

# Check disk usage
du -sh * | sort -rh

# Monitor processes
watch -n 1 'ps aux | grep node'
```

#### VSCode Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K Cmd+F` | Format document |
| `Cmd+Shift+P` | Command palette |
| `Cmd+P` | Quick file open |
| `Cmd+Shift+F` | Find across files |
| `Cmd+D` | Select word |
| `Cmd+L` | Select line |
| `Alt+Up/Down` | Move line |
| `Cmd+/` | Toggle comment |

#### Browser DevTools Hacks

```javascript
// Console tricks
console.table(array)           // View as table
console.time('label')          // Start timer
console.timeEnd('label')       // End timer
console.trace()                // Stack trace
debugger;                      // Breakpoint in code

// Quick DOM queries
$0                             // Last selected element
$("selector")                  // querySelector
$$("selector")                 // querySelectorAll
```

### Time Management

#### Pomodoro Technique
- **25 minutes** focused work
- **5 minutes** break
- After 4 cycles: **15-30 minute** long break
- Tools: Toggl, Focus@Will, Forest

#### Time Blocking
```
9:00 - 10:30  → Deep work (coding)
10:30 - 10:45 → Break
10:45 - 12:00 → Meetings/Communication
12:00 - 1:00  → Lunch
1:00 - 3:00   → Deep work (coding)
3:00 - 3:15   → Break
3:15 - 5:00   → Admin/Email
```

### Learning Hacks

| Strategy | Benefit |
|----------|----------|
| **Spaced Repetition** | Review content at increasing intervals (1 day, 3 days, 1 week, 1 month) |
| **Active Recall** | Test yourself instead of re-reading |
| **Feynman Technique** | Teach concepts in simple terms to identify gaps |
| **Building Projects** | Learn by doing, not just reading |
| **Reading Code** | Study others' implementations |
| **Contributing to OSS** | Real-world experience + portfolio |
| **Pair Programming** | Learn from others, catch mistakes faster |
| **Writing Documentation** | Reinforces understanding |

### File Organization

```bash
# Well-organized project structure
project/
├── src/
│   ├── components/     # Reusable components
│   ├── utils/          # Helper functions
│   ├── hooks/          # Custom hooks
│   ├── constants/      # Configuration
│   └── types/          # TypeScript types
├── tests/              # Test files
├── docs/               # Documentation
├── .github/
│   └── workflows/      # CI/CD pipelines
├── README.md
├── package.json
└── .gitignore
```

---

## 🏗️ Repository-Specific Techniques

### Code Navigation

```bash
# Find where a function is defined
grep -r "functionName" src/

# Find where a function is used
grep -r "functionName(" . --include="*.js"

# Count lines of code
wc -l src/**/*.js

# Find TODO comments
grep -r "TODO\|FIXME" src/

# List all exports from a file
grep -E "^export" src/index.js
```

### Security Audit

```bash
# Check for common vulnerabilities
npm audit              # Show vulnerabilities
npm audit fix          # Auto-fix if possible
npm audit --json       # Get detailed report

# Check outdated dependencies
npm outdated

# Scan dependencies for licenses
npm-check-licenses
```

### Performance Optimization

```bash
# Bundle analysis
webpack-bundle-analyzer

# Performance metrics
lighthouse                    # Chrome extension
PageSpeed Insights           # Online tool

# Monitor memory usage
node --max-old-space-size=4096 app.js

# Profile code execution
node --prof app.js
node --prof-process isolate-*.log
```

### Testing & Quality

```bash
# Run tests with coverage
jest --coverage

# Check code quality
eslint src/ --fix

# Security scanning
npm run security-scan

# Type checking (TypeScript)
tsc --noEmit
```

---

## 📚 Quick Reference Checklist

### Before Starting a Project
- [ ] Set up `.gitignore` properly
- [ ] Initialize with `package.json` / `requirements.txt`
- [ ] Configure linting and formatting (ESLint, Prettier)
- [ ] Set up testing framework
- [ ] Add pre-commit hooks (Husky)
- [ ] Document setup instructions

### Before Deploying
- [ ] Run security audit (`npm audit`)
- [ ] Check for secrets in code (git-secrets)
- [ ] Run all tests
- [ ] Verify environment variables
- [ ] Check performance metrics
- [ ] Update dependencies if needed
- [ ] Build minified version
- [ ] Test in staging environment

### Security Checklist
- [ ] No hardcoded passwords/secrets
- [ ] Validate all user inputs
- [ ] Use HTTPS/SSL
- [ ] Implement rate limiting
- [ ] Use strong authentication
- [ ] Keep dependencies updated
- [ ] Enable CORS properly
- [ ] Use environment variables
- [ ] Implement logging/monitoring
- [ ] Have incident response plan

---

## 🔗 Resources & Links

### Cybersecurity
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [HackTheBox](https://www.hackthebox.com)
- [TryHackMe](https://tryhackme.com)
- [PortSwigger Academy](https://portswigger.net/web-security)

### Programming
- [MDN Web Docs](https://developer.mozilla.org)
- [Python Documentation](https://docs.python.org)
- [JavaScript.info](https://javascript.info)
- [Design Patterns](https://refactoring.guru/design-patterns)

### Tools & Utilities
- [regex101.com](https://regex101.com) - Test regex patterns
- [caniuse.com](https://caniuse.com) - Browser compatibility
- [excalidraw.com](https://excalidraw.com) - Quick diagrams
- [jsoncrack.com](https://jsoncrack.com) - Visualize JSON

---

**Remember:** The best hack is clean, maintainable code that solves real problems! 🚀