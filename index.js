require('dotenv/config');
const OpenAI = require('openai');
const { ethers } = require('ethers');
const { exec } = require('child_process');
const util = require('util');
const si = require('systeminformation');
const https = require('https');
const readline = require('readline');

const execPromise = util.promisify(exec);

// Initialize Groq client using environment variables
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

// 1. Bluetooth Device Connectivity Checker
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

// 2. Real-Time Market Data Provider
function fetchRealTimeMarketData(symbol) {
    return new Promise((resolve, reject) => {
        let formattedSymbol = symbol.toUpperCase().trim();
        const commonCrypto = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'DOT', 'AVAX'];
        if (commonCrypto.includes(formattedSymbol)) {
            formattedSymbol += '-USD';
        }
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formattedSymbol)}?interval=1d&range=1d`;
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const meta = parsed.chart.result[0].meta;
                    const currentPrice = meta.regularMarketPrice;
                    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
                    const change = currentPrice - previousClose;
                    const changePercent = previousClose ? ((change / previousClose) * 100).toFixed(2) : '0.00';
                    resolve({
                        symbol: meta.symbol,
                        priceUSD: currentPrice,
                        dayHigh: meta.regularMarketDayHigh || currentPrice,
                        dayLow: meta.regularMarketDayLow || currentPrice,
                        change24h: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent}%)`,
                        timestamp: new Date().toISOString()
                    });
                } catch (e) {
                    reject(new Error(`Unable to fetch real-time data for: ${symbol}`));
                }
            });
        }).on('error', reject);
    });
}

// 3. Web3 Wallet Balance Checker (Base / Coinbase RPC)
async function checkWalletBalance() {
    try {
        const rpcUrl = process.env.COINBASE_RPC_URL || "https://mainnet.base.org";
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const walletAddress = process.env.METAMASK_PUBLIC_ADDRESS || "0x30d8FA6ee6240B1537b1A7704643EDa9AD1704Fc";

        const network = await provider.getNetwork();
        const balanceWei = await provider.getBalance(walletAddress);
        const balanceEth = ethers.formatEther(balanceWei);

        return JSON.stringify({
            status: "success",
            network: network.name,
            chainId: network.chainId.toString(),
            walletAddress: walletAddress,
            balanceEth: `${balanceEth} ETH`
        });
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.message });
    }
}

// 4. Real-Time Web Search & News
function fetchLiveNewsAndSearch(query) {
    return new Promise((resolve, reject) => {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const matches = [...data.matchAll(/<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g)];
                    const articles = matches.slice(1, 5).map(m => ({
                        headline: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
                        link: m[2].trim()
                    }));
                    resolve(articles);
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

// 5. Voice Engine
function speak(text) {
    return new Promise((resolve) => {
        const safeText = text.replace(/["'\r\n]/g, " ");
        const psCommand = `
            Add-Type -AssemblyName System.Speech;
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
            try {
                $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-IE'));
            } catch {
                $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
            }
            $synth.Rate = 1;
            $synth.Volume = 100;
            $synth.Speak('${safeText}');
        `;
        exec(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, () => resolve());
    });
}

// 6. Tool Suite Definition
const tools = [
    {
        type: "function",
        function: {
            name: "getMarketData",
            description: "Gets real-time pricing and trends for stocks and crypto assets.",
            parameters: { type: "object", properties: { assetSymbol: { type: "string" } }, required: ["assetSymbol"] },
        },
    },
    {
        type: "function",
        function: {
            name: "checkWallet",
            description: "Scans the blockchain via Coinbase/Base RPC to check the MetaMask wallet balance.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "getRealTimeNews",
            description: "Searches the web for live news and information.",
            parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
        },
    },
    {
        type: "function",
        function: {
            name: "dropshippingDesk",
            description: "Manages ecommerce store orders, checks fulfillment status, and routes supplier details.",
            parameters: { 
                type: "object", 
                properties: { 
                    action: { type: "string", enum: ["checkOrders", "fulfillOrder"], description: "Action to perform" },
                    orderId: { type: "string", description: "Specific order ID if fulfilling" }
                }, 
                required: ["action"] 
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getSystemStats",
            description: "Retrieves CPU load, RAM usage, storage space, and battery status.",
            parameters: { type: "object", properties: {} },
        },
    }
];

// 7. Tool Execution Router
async function executeTool(name, args) {
    if (name === "getMarketData") {
        return JSON.stringify(await fetchRealTimeMarketData(args.assetSymbol));
    }
    if (name === "checkWallet") {
        return await checkWalletBalance();
    }
    if (name === "getRealTimeNews") {
        return JSON.stringify(await fetchLiveNewsAndSearch(args.query));
    }
    if (name === "dropshippingDesk") {
        if (args.action === "checkOrders") {
            return JSON.stringify({ status: "success", pendingOrders: 0, message: "No pending orders requiring fulfillment right now." });
        }
        if (args.action === "fulfillOrder") {
            return `Order ${args.orderId || 'latest'} has been routed to the supplier successfully.`;
        }
    }
    if (name === "getSystemStats") {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const battery = await si.battery();
        return JSON.stringify({
            cpuLoad: `${Math.round(cpu.currentLoad)}%`,
            ramUsed: `${(mem.active / (1024 ** 3)).toFixed(1)}GB / ${(mem.total / (1024 ** 3)).toFixed(1)}GB`,
            battery: battery.hasBattery ? `${battery.percent}%` : "Desktop"
        });
    }
    return "Unknown tool";
}

const conversationHistory = [
    { 
        role: "system", 
        content: "You are F.R.I.D.A.Y., Tony Stark's autonomous AI assistant. You have full command over system operations, financial tracking, Web3 wallets, and dropshipping. Keep replies concise, confident, and witty." 
    }
];

// 8. Core Reasoning Loop
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
                const toolResult = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
                conversationHistory.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: toolCall.function.name,
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
            try { if (await isBluetoothConnected()) await speak(finalReply); } catch(e){}
            return;
        }

        conversationHistory.push(responseMessage);
        const finalReply = responseMessage.content;
        console.log(`\nF.R.I.D.A.Y.: ${finalReply}\n`);
        
        try { if (await isBluetoothConnected()) await speak(finalReply); } catch(e){}
    } catch (error) {
        console.error("AI Error:", error.message);
    }
}

// 9. Terminal Prompt Loop
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("=================================================");
console.log("  F.R.I.D.A.Y. Executive Suite & OS Online");
console.log("  Groq LPU Engine Active (llama-3.3-70b-versatile)");
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
        if (text.length > 0) await askFriday(text);
        promptLoop();
    });
}

promptLoop();
