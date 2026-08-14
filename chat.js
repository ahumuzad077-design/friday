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
const audioPath = path.join(process.cwd(), 'input.wav');

let tradingPortfolio = {
    cashBalanceUSD: 100000,
    holdings: {}
};

const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || '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',
    baseURL: 'https://api.groq.com/openai/v1',
});

// Bluetooth Device Connectivity Checker
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

function fetchRealTimeMarketData(symbol) {
    return new Promise((resolve, reject) => {
        let formattedSymbol = symbol.toUpperCase().trim();
        const commonCrypto = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'DOT', 'AVAX'];
        if (commonCrypto.includes(formattedSymbol)) {
            formattedSymbol += '-USD';
        }
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formattedSymbol)}?interval=1d&range=1d`;
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        };
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

const tools = [
    {
        type: "function",
        function: {
            name: "getMarketData",
            parameters: {
                type: "object",
                properties: { assetSymbol: { type: "string" } },
                required: ["assetSymbol"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getSystemStats",
            parameters: { type: "object", properties: {} },
        },
    }
];

async function executeTool(name, args) {
    if (name === "getMarketData") {
        return JSON.stringify(await fetchRealTimeMarketData(args.assetSymbol));
    }
    if (name === "getSystemStats") {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        return JSON.stringify({ cpuLoad: `${Math.round(cpu.currentLoad)}%`, ramUsed: `${(mem.active / (1024 ** 3)).toFixed(1)}GB` });
    }
    return "Unknown tool";
}

const conversationHistory = [
    { role: "system", content: "You are F.R.I.D.A.Y., Tony Stark's autonomous AI assistant. Keep replies concise, witty, and confident." }
];

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
            if (await isBluetoothConnected()) await speak(finalReply);
            return;
        }

        conversationHistory.push(responseMessage);
        const finalReply = responseMessage.content;
        console.log(`\nF.R.I.D.A.Y.: ${finalReply}\n`);
        
        if (await isBluetoothConnected()) await speak(finalReply);
    } catch (error) {
        console.error("AI Error:", error.message);
    }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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
        if (text.length > 0) await askFriday(text);
        promptLoop();
    });
}

promptLoop();
