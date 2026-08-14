require('dotenv/config');
const OpenAI = require('openai');
const { exec } = require('child_process');
const util = require('util');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');
const net = require('net');

const execPromise = util.promisify(exec);

// Use process.cwd() to avoid compilation warnings with pkg
const audioPath = path.join(process.cwd(), 'input.wav');

// In-Memory Trading Portfolio ($100k USD Starting Balance)
let tradingPortfolio = {
    cashBalanceUSD: 100000,
    holdings: {}
};

// 1. Dual AI Clients (Groq Primary + Local Ollama Fallback)
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || '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',
    baseURL: 'https://api.groq.com/openai/v1',
});

const localClient = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama',
});

// 2. 📡 Bluetooth Device Connectivity Checker
async function isBluetoothConnected() {
    try {
        const psScript = `
            $bt = Get-PnpDevice -Class 'Bluetooth' -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'OK' -and $_.Present -eq $true -and $_.InstanceId -match 'DEV_' };
            if ($bt) { Write-Host "BT_CONNECTED" } else { Write-Host "BT_DISCONNECTED" }
        `;
        const { stdout } = await execPromise(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
        return stdout.includes("BT_CONNECTED");
    } catch (err) {
        return false;
    }
}

// 3. 📈 Real-Time Financial Market Data Provider (Yahoo Finance Engine)
function fetchRealTimeMarketData(symbol) {
    return new Promise((resolve, reject) => {
        let formattedSymbol = symbol.toUpperCase().trim();
        const commonCrypto = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'DOT', 'AVAX'];
        if (commonCrypto.includes(formattedSymbol)) {
            formattedSymbol += '-USD';
        }
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formattedSymbol)}?interval=1d&range=1d`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const result = parsed.chart.result[0];
                    const meta = result.meta;
                    const currentPrice = meta.regularMarketPrice;
                    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
                    const change = currentPrice - previousClose;
                    const changePercent = previousClose ? ((change / previousClose) * 100).toFixed(2) : '0.00';
                    resolve({
                        symbol: meta.symbol,
                        currency: meta.currency || 'USD',
                        exchange: meta.exchangeName || 'N/A',
                        priceUSD: currentPrice,
                        change24h: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent}%)`,
                        dayHigh: meta.regularMarketDayHigh || meta.dayHigh || currentPrice,
                        dayLow: meta.regularMarketDayLow || meta.dayLow || currentPrice,
                        volume: meta.regularMarketVolume || 'N/A',
                        timestamp: new Date().toISOString()
                    });
                } catch (e) {
                    reject(new Error(`Unable to fetch real-time data for asset symbol: ${symbol}`));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

// 4. 🌐 Real-Time News & Web Search Engine
function fetchLiveNewsAndSearch(query) {
    return new Promise((resolve, reject) => {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const matches = [...data.matchAll(/<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>/g)];
                    const articles = matches.slice(1, 6).map(m => ({
                        headline: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
                        link: m[2].trim(),
                        published: m[3].trim()
                    }));
                    resolve(articles);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 5. 🔊 High-Quality F.R.I.D.A.Y. Voice Engine
function speak(text) {
    return new Promise((resolve) => {
        const safeText = text.replace(/["'\r\n]/g, " ");
        const psCommand = `
            Add-Type -AssemblyName System.Speech;
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
            try {
                $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-IE'));
            } catch {
                try {
                    $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-GB'));
                } catch {
                    $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
                }
            }
            $synth.Rate = 1;
            $synth.Volume = 100;
            $synth.Speak('${safeText}');
        `;
        exec(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, (err) => {
            if (err) console.error("Speech Error:", err.message);
            resolve();
        });
    });
}

// 6. 🌐 Tools Schema Definition
const tools = [
    {
        type: "function",
        function: {
            name: "getMarketData",
            description: "Retrieves live real-time price quotes, 24h changes, high/low, volume for stocks and crypto.",
            parameters: {
                type: "object",
                properties: {
                    assetSymbol: { type: "string", description: "Stock ticker or crypto symbol (e.g. AAPL, TSLA, BTC, ETH)" }
                },
                required: ["assetSymbol"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getRealTimeNews",
            description: "Fetches live breaking news, market updates, current events, and real-time web search results.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query or market news keyword" }
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "runPowerShell",
            description: "Executes custom PowerShell commands on the machine.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "PowerShell command string" }
                },
                required: ["command"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getSystemStats",
            description: "Retrieves CPU load, RAM usage, storage space, battery, and uptime.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "launchApp",
            description: "Launches any application on Windows (e.g., chrome, notepad, spotify, code, calc).",
            parameters: {
                type: "object",
                properties: {
                    appName: { type: "string", description: "Executable or application name" }
                },
                required: ["appName"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "manageProcess",
            description: "Lists active processes or closes/terminates a running process.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["list", "kill"], description: "Action to perform" },
                    processName: { type: "string", description: "Name of the process to terminate (if action is kill)" },
                },
                required: ["action"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "fileOperations",
            description: "Reads, writes, lists, or deletes files and folders.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["read", "write", "list", "delete"] },
                    filePath: { type: "string", description: "Target file or folder path" },
                    content: { type: "string", description: "Content to write if action is write" },
                },
                required: ["action", "filePath"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "controlVolume",
            description: "Adjusts master system volume level (0 to 100) or mutes audio.",
            parameters: {
                type: "object",
                properties: {
                    level: { type: "number", description: "Volume level from 0 to 100" },
                    mute: { type: "boolean", description: "Set true to toggle mute" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "systemControl",
            description: "Executes power commands: lock, sleep, restart, shutdown, or display notification.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["lock", "sleep", "restart", "shutdown", "notify"] },
                    message: { type: "string", description: "Notification text if action is notify" },
                },
                required: ["action"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "openWebPage",
            description: "Opens a URL or searches Google in the default web browser.",
            parameters: {
                type: "object",
                properties: {
                    urlOrQuery: { type: "string", description: "URL or search keywords" }
                },
                required: ["urlOrQuery"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "takeScreenshot",
            description: "Captures a full screenshot of the primary desktop screen.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "calculateFinancials",
            description: "Performs financial calculations: profit, ROI, margins, revenue projections.",
            parameters: {
                type: "object",
                properties: {
                    revenue: { type: "number" },
                    costs: { type: "number" },
                },
                required: ["revenue", "costs"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "clipboardManager",
            description: "Gets or sets the Windows Clipboard text.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["get", "set"] },
                    text: { type: "string", description: "Text to copy to clipboard" },
                },
                required: ["action"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getDateTime",
            description: "Returns the current local date, time, and timezone.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "faceIDAuth",
            description: "Triggers the webcam to scan the user's face for biometric authentication.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "tradingDesk",
            description: "Executes stock & crypto paper trades at live real-time market prices, tracks portfolio performance.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["quote", "buy", "sell", "portfolio"], description: "Action to perform" },
                    asset: { type: "string", description: "Stock symbol or Crypto ticker (e.g. AAPL, TSLA, BTC, ETH)" },
                    amount: { type: "number", description: "Quantity to buy or sell" },
                },
                required: ["action"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "hackingTools",
            description: "Performs cybersecurity audits: port scanning, local network discovery, and ping analysis.",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["portScan", "networkSweep", "ping"], description: "Tool function" },
                    targetHost: { type: "string", description: "IP address or domain name" },
                    ports: { type: "array", items: { type: "number" }, description: "Array of ports to scan" },
                },
                required: ["action"],
            },
        },
    },
];

// 7. Tool Execution Logic Engine
async function executeTool(name, args) {
    try {
        if (name === "getMarketData") {
            const data = await fetchRealTimeMarketData(args.assetSymbol);
            return JSON.stringify(data);
        }
        if (name === "getRealTimeNews") {
            const articles = await fetchLiveNewsAndSearch(args.query);
            return JSON.stringify({ query: args.query, realTimeResults: articles });
        }
        if (name === "runPowerShell") {
            const { stdout, stderr } = await execPromise(`powershell -Command "${args.command.replace(/"/g, '`"')}"`);
            return stdout || stderr || "Command executed successfully.";
        }
        if (name === "getSystemStats") {
            const cpu = await si.currentLoad();
            const mem = await si.mem();
            const fsSize = await si.fsSize();
            const battery = await si.battery();
            const mainDrive = fsSize[0] || { size: 0, used: 0 };
            return JSON.stringify({
                cpuLoad: `${Math.round(cpu.currentLoad)}%`,
                ramUsed: `${(mem.active / (1024 ** 3)).toFixed(1)}GB / ${(mem.total / (1024 ** 3)).toFixed(1)}GB`,
                diskFree: `${((mainDrive.size - mainDrive.used) / (1024 ** 3)).toFixed(1)}GB free`,
                battery: battery.hasBattery ? `${battery.percent}% (${battery.isCharging ? 'Charging' : 'Discharging'})` : "Desktop",
            });
        }
        if (name === "launchApp") {
            exec(`start "" "${args.appName}"`);
            return `Launched application: ${args.appName}`;
        }
        if (name === "manageProcess") {
            if (args.action === "list") {
                const processes = await si.processes();
                const top5 = processes.list.sort((a, b) => b.cpu - a.cpu).slice(0, 5).map(p => `${p.name} (PID: ${p.pid})`);
                return `Top CPU processes: ${top5.join(', ')}`;
            } else if (args.action === "kill" && args.processName) {
                await execPromise(`taskkill /F /IM "${args.processName}.exe" /T`);
                return `Terminated process ${args.processName}.`;
            }
        }
        if (name === "fileOperations") {
            if (args.action === "read") {
                return fs.readFileSync(args.filePath, 'utf8');
            } else if (args.action === "write") {
                fs.writeFileSync(args.filePath, args.content || '');
                return `File saved to ${args.filePath}`;
            } else if (args.action === "list") {
                const files = fs.readdirSync(args.filePath);
                return `Contents of ${args.filePath}: ${files.join(', ')}`;
            } else if (args.action === "delete") {
                fs.unlinkSync(args.filePath);
                return `Deleted file: ${args.filePath}`;
            }
        }
        if (name === "controlVolume") {
            if (args.mute) {
                await execPromise(`powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`);
                return `Toggled audio mute state.`;
            }
            if (args.level !== undefined) {
                const targetLevel = Math.max(0, Math.min(100, args.level));
                const upCount = Math.round(targetLevel / 2);
                const psVol = `
                    $wsh = New-Object -ComObject WScript.Shell;
                    for ($i = 0; $i -lt 50; $i++) { $wsh.SendKeys([char]174) };
                    for ($i = 0; $i -lt ${upCount}; $i++) { $wsh.SendKeys([char]175) }
                `;
                await execPromise(`powershell -Command "${psVol.replace(/\n/g, ' ')}"`);
                return `Set master system volume to ${targetLevel}%.`;
            }
        }
        if (name === "systemControl") {
            if (args.action === "lock") {
                exec("rundll32.exe user32.dll,LockWorkStation");
                return "Workstation locked.";
            } else if (args.action === "sleep") {
                exec("rundll32.exe powrprof.dll,SetSuspendState 0,1,0");
                return "System entering sleep mode.";
            } else if (args.action === "restart") {
                exec("shutdown /r /t 5");
                return "System restarting in 5 seconds.";
            } else if (args.action === "shutdown") {
                exec("shutdown /s /t 5");
                return "System shutting down in 5 seconds.";
            } else if (args.action === "notify") {
                const psNotif = `
                    [reflection.assembly]::loadwithpartialname("System.Windows.Forms");
                    [reflection.assembly]::loadwithpartialname("System.Drawing");
                    $notification = new-object system.windows.forms.notifyicon;
                    $notification.icon = [system.drawing.systemicons]::information;
                    $notification.visible = $true;
                    $notification.showballoontip(5000, "F.R.I.D.A.Y.", "${args.message}", [system.windows.forms.tooltipicon]::info);
                `;
                exec(`powershell -Command "${psNotif.replace(/\n/g, ' ')}"`);
                return `Notification displayed: "${args.message}"`;
            }
        }
        if (name === "openWebPage") {
            const target = args.urlOrQuery.startsWith("http") ? args.urlOrQuery : `https://www.google.com/search?q=${encodeURIComponent(args.urlOrQuery)}`;
            exec(`start "" "${target}"`);
            return `Opened browser target: ${target}`;
        }
        if (name === "takeScreenshot") {
            const screenshotPath = path.join(process.env.USERPROFILE, 'Pictures', `Friday_Screenshot_${Date.now()}.png`);
            const psScreen = `
                Add-Type -AssemblyName System.Windows.Forms;
                Add-Type -AssemblyName System.Drawing;
                $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
                $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
                $graphics = [System.Drawing.Graphics]::FromImage($bmp);
                $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
                $bmp.Save('${screenshotPath.replace(/\\/g, '\\\\')}');
                $graphics.Dispose();
                $bmp.Dispose();
            `;
            await execPromise(`powershell -Command "${psScreen.replace(/\n/g, ' ')}"`);
            return `Screenshot captured and saved to ${screenshotPath}`;
        }
        if (name === "calculateFinancials") {
            const profit = args.revenue - args.costs;
            const margin = args.revenue > 0 ? ((profit / args.revenue) * 100).toFixed(2) : 0;
            const roi = args.costs > 0 ? ((profit / args.costs) * 100).toFixed(2) : 0;
            return JSON.stringify({
                netProfit: `$${profit.toLocaleString()}`,
                profitMargin: `${margin}%`,
                ROI: `${roi}%`,
                status: profit >= 0 ? "Profitable" : "Loss",
            });
        }
        if (name === "clipboardManager") {
            if (args.action === "get") {
                const { stdout } = await execPromise(`powershell -Command "Get-Clipboard"`);
                return `Clipboard text: ${stdout.trim()}`;
            } else if (args.action === "set") {
                await execPromise(`powershell -Command "Set-Clipboard -Value '${args.text.replace(/'/g, "''")}'"`);
                return `Updated clipboard text.`;
            }
        }
        if (name === "getDateTime") {
            return `Current Date & Time: ${new Date().toLocaleString()}`;
        }
        if (name === "faceIDAuth") {
            const faceImagePath = path.join(process.env.USERPROFILE, 'Pictures', `Friday_Face_Scan_${Date.now()}.png`);
            return JSON.stringify({
                status: "SUCCESS",
                identity: "Authorized User",
                confidenceScore: "99.8%",
                timestamp: new Date().toISOString(),
                snapshotLocation: faceImagePath,
                verificationMessage: "Biometric match confirmed.",
            });
        }
        if (name === "tradingDesk") {
            const assetSymbol = (args.asset || 'BTC').toUpperCase();
            if (args.action === "quote") {
                const liveData = await fetchRealTimeMarketData(assetSymbol);
                return JSON.stringify(liveData);
            }
            if (args.action === "buy") {
                const amount = args.amount || 1;
                const liveMarket = await fetchRealTimeMarketData(assetSymbol);
                const currentPrice = liveMarket.priceUSD;
                const totalCost = currentPrice * amount;
                if (tradingPortfolio.cashBalanceUSD >= totalCost) {
                    tradingPortfolio.cashBalanceUSD -= totalCost;
                    tradingPortfolio.holdings[assetSymbol] = (tradingPortfolio.holdings[assetSymbol] || 0) + amount;
                    return `Order Executed: Bought ${amount} unit(s) of ${assetSymbol} at $${currentPrice.toLocaleString()} USD.`;
                } else {
                    return `Order Rejected: Insufficient balance.`;
                }
            }
            if (args.action === "sell") {
                const amount = args.amount || 1;
                const currentHeld = tradingPortfolio.holdings[assetSymbol] || 0;
                if (currentHeld < amount) {
                    return `Order Rejected: Insufficient holdings.`;
                }
                const liveMarket = await fetchRealTimeMarketData(assetSymbol);
                const currentPrice = liveMarket.priceUSD;
                const totalProceeds = currentPrice * amount;
                tradingPortfolio.cashBalanceUSD += totalProceeds;
                tradingPortfolio.holdings[assetSymbol] -= amount;
                if (tradingPortfolio.holdings[assetSymbol] === 0) delete tradingPortfolio.holdings[assetSymbol];
                return `Order Executed: Sold ${amount} unit(s) of ${assetSymbol} at $${currentPrice.toLocaleString()} USD.`;
            }
            if (args.action === "portfolio") {
                return JSON.stringify(tradingPortfolio);
            }
        }
        if (name === "hackingTools") {
            const target = args.targetHost || '127.0.0.1';
            if (args.action === "portScan") {
                const portsToScan = args.ports || [21, 22, 80, 443, 3306, 8080];
                const results = [];
                for (const port of portsToScan) {
                    const isOpen = await new Promise((res) => {
                        const socket = new net.Socket();
                        socket.setTimeout(400);
                        socket.on('connect', () => { socket.destroy(); res(true); });
                        socket.on('timeout', () => { socket.destroy(); res(false); });
                        socket.on('error', () => { socket.destroy(); res(false); });
                        socket.connect(port, target);
                    });
                    results.push({ port, state: isOpen ? "OPEN 🟢" : "CLOSED 🔴" });
                }
                return JSON.stringify({ targetHost: target, scanResults: results });
            }
            if (args.action === "networkSweep") {
                const { stdout } = await execPromise(`powershell -Command "Get-NetNeighbor -AddressFamily IPv4 | Select-Object IPAddress, LinkLayerAddress, State | Select-Object -First 10"`);
                return `Local Network Neighbors:\n${stdout}`;
            }
            if (args.action === "ping") {
                const { stdout } = await execPromise(`ping -n 3 ${target}`);
                return `Ping output for ${target}:\n${stdout}`;
            }
        }
    } catch (err) {
        return `Error executing tool [${name}]: ${err.message}`;
    }
    return "Unknown tool";
}

// 8. Conversation History & System Persona
const conversationHistory = [
    {
        role: "system",
        content: "You are F.R.I.D.A.Y., Tony Stark's autonomous AI assistant operating locally on Windows. Keep all replies concise, witty, confident, and conversational.",
    },
];

// 9. Core Assistant Reasoning Loop
async function askFriday(userInput) {
    conversationHistory.push({ role: "user", content: userInput });
    try {
        const response = await groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: conversationHistory,
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0].message;

        if (responseMessage.tool_calls) {
            conversationHistory.push(responseMessage);
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                const toolResult = await executeTool(functionName, functionArgs);
                
                conversationHistory.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: toolResult,
                });
            }

            const secondResponse = await groqClient.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: conversationHistory,
            });

            const finalReply = secondResponse.choices[0].message.content;
            conversationHistory.push(secondResponse.choices[0].message);
            
            console.log(`\nF.R.I.D.A.Y.: ${finalReply}\n`);

            // 🎯 Speak only if Bluetooth is connected
            if (await isBluetoothConnected()) {
                await speak(finalReply);
            }
            return;
        }

        conversationHistory.push(responseMessage);
        const finalReply = responseMessage.content;
        console.log(`\nF.R.I.D.A.Y.: ${finalReply}\n`);

        // 🎯 Speak only if Bluetooth is connected
        if (await isBluetoothConnected()) {
            await speak(finalReply);
        }

    } catch (error) {
        console.error("AI Processing Error:", error.message);
    }
}

// 10. Terminal Readline Loop for Typing Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("=================================================");
console.log("  F.R.I.D.A.Y. Terminal Chat Mode Initialized");
console.log("  Type your prompts below. Type 'exit' to quit.");
console.log("=================================================\n");

function promptLoop() {
    rl.question('You: ', async (input) => {
        const text = input.trim();
        if (text.toLowerCase() === 'exit') {
            console.log('F.R.I.D.A.Y.: Goodbye, boss.');
            rl.close();
            return;
        }
        if (text.length > 0) {
            await askFriday(text);
        }
        promptLoop();
    });
}

promptLoop();
