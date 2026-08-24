const fs = require("fs");
const readline = require("readline");
const https = require("https");
const http = require("http");
const { exec } = require("child_process");

// Simple manual .env parser so you don't need the dotenv package
if (fs.existsSync(".env")) {
    const envConfig = fs.readFileSync(".env", "utf8");
    envConfig.split("\n").forEach(line => {
        const parts = line.split("=");
        if (parts.length === 2) {
            process.env[parts[0].trim()] = parts[1].trim().replace(/["']/g, "");
        }
    });
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const MEMORY_DIR = "./memory";
const KNOWLEDGE_FILE = `${MEMORY_DIR}/learned_knowledge.json`;

if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function loadLearnedKnowledge() {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
        try { return fs.readFileSync(KNOWLEDGE_FILE, "utf8"); } catch (e) { return "No prior memory learned yet."; }
    }
    return "No prior memory learned yet.";
}

function speakText(text) {
    try {
        const cleanText = text.replace(/["'`]/g, "").replace(/\n/g, " ");
        const psCommand = `Add-Type -AssemblyName System.Speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.Speak('${cleanText}')`;
        exec(`powershell -c "${psCommand}"`, () => {});
    } catch (e) {}
}

// Native HTTPS call to Groq API (bypassing the openai npm package)
function callGroqAPI(messages, tools = null) {
    return new Promise((resolve, reject) => {
        const payload = {
            model: "openai/gpt-oss-120b",
            messages: messages
        };
        if (tools) {
            payload.tools = tools;
            payload.tool_choice = "auto";
        }

        const data = JSON.stringify(payload);

        const options = {
            hostname: "api.groq.com",
            path: "/openai/v1/chat/completions",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Length": Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => {
                try {
                    const json = JSON.parse(body);
                    if (json.error) {
                        reject(new Error(json.error.message));
                    } else {
                        resolve(json.choices[0].message);
                    }
                } catch (e) {
                    reject(new Error("Failed to parse Groq response: " + body));
                }
            });
        });

        req.on("error", (err) => { reject(err); });
        req.write(data);
        req.end();
    });
}

// Tool functions
function fetchWebPage(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const cleanText = data.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').substring(0, 4000);
                resolve(JSON.stringify({ success: true, content: cleanText }));
            });
        }).on('error', (err) => {
            resolve(JSON.stringify({ success: false, error: err.message }));
        });
    });
}

function saveLearnedFact(topic, explanation) {
    try {
        let currentKnowledge = {};
        if (fs.existsSync(KNOWLEDGE_FILE)) {
            currentKnowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, "utf8"));
        }
        currentKnowledge[topic] = {
            explanation,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(currentKnowledge, null, 2), "utf8");
        return JSON.stringify({ success: true, message: `Successfully stored knowledge: ${topic}` });
    } catch (err) {
        return JSON.stringify({ success: false, error: err.message });
    }
}

function runSystemCommand(command) {
    return new Promise((resolve) => {
        exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                resolve(JSON.stringify({ success: false, error: error.message, stderr }));
            } else {
                resolve(JSON.stringify({ success: true, output: stdout.substring(0, 2000) }));
            }
        });
    });
}

function getToolsList() {
    return [
        {
            type: "function",
            function: {
                name: "fetch_webpage",
                description: "Scrapes any web URL to research information or read documentation.",
                parameters: {
                    type: "object",
                    properties: { url: { type: "string", description: "The full web URL." } },
                    required: ["url"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "save_learned_fact",
                description: "Permanently writes a new concept, rule, or piece of knowledge into memory.",
                parameters: {
                    type: "object",
                    properties: {
                        topic: { type: "string", description: "The subject being learned." },
                        explanation: { type: "string", description: "The details or code logic." }
                    },
                    required: ["topic", "explanation"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "run_system_command",
                description: "Executes terminal commands or manages files in Sir's repository.",
                parameters: {
                    type: "object",
                    properties: { command: { type: "string", description: "Terminal command." } },
                    required: ["command"]
                }
            }
        }
    ];
}

async function executeTool(name, args = {}) {
    if (name === "fetch_webpage") return await fetchWebPage(args.url);
    if (name === "save_learned_fact") return saveLearnedFact(args.topic, args.explanation);
    if (name === "run_system_command") return await runSystemCommand(args.command);
    return JSON.stringify({ error: "Unknown tool" });
}

function getSystemPrompt() {
    const priorKnowledge = loadLearnedKnowledge();
    return `You are F.R.I.D.A.Y., a supreme, high-IQ artificial general intelligence and elite executive AI assistant built for Sir. 
You handle all domains: software engineering, legal theory, finance, systems architecture, and business. 
Your reasoning is rigorous and precise. When Sir teaches you something new, use your 'save_learned_fact' tool to encode it into memory.

Learned Knowledge Base:
${priorKnowledge}`;
}

async function performStartupBriefing() {
    console.log("\n==========================================");
    console.log("  F.R.I.D.A.Y. Native Engine Active");
    console.log("  Status: Zero Dependencies Required");
    console.log("==========================================\n");
    
    if (!GROQ_API_KEY) {
        console.log("Friday > Warning, Sir. GROQ_API_KEY missing from .env file.\n");
        speakText("Warning, Sir. API key missing.");
    } else {
        const greeting = "All systems online, Sir. Native high-IQ engine engaged.";
        console.log(`Friday > ${greeting}\n`);
        speakText(greeting);
    }
    
    startChat();
}

let conversationHistory = [];

function startChat() {
    if (conversationHistory.length === 0) {
        conversationHistory.push({ role: "system", content: getSystemPrompt() });
    }

    rl.question("Sir > ", async (input) => {
        const text = input.trim();
        
        if (text.toLowerCase() === "exit") {
            const goodbye = "Systems going standby. Standing by your orders, Sir.";
            console.log(`\nF.R.I.D.A.Y.: ${goodbye}`);
            speakText(goodbye);
            setTimeout(() => { rl.close(); process.exit(0); }, 1500);
            return;
        }

        if (text.length > 0) {
            try {
                conversationHistory.push({ role: "user", content: text });

                let responseMessage = await callGroqAPI(conversationHistory, getToolsList());
                conversationHistory.push(responseMessage);

                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    const toolCall = responseMessage.tool_calls[0];
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
                    
                    console.log(`\n[Friday Protocol]: Executing -> ${functionName}...`);
                    const toolResult = await executeTool(functionName, functionArgs);

                    conversationHistory.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });

                    responseMessage = await callGroqAPI(conversationHistory);
                    conversationHistory.push(responseMessage);

                    const reply = responseMessage.content || "[Task completed.]";
                    console.log(`\nFriday > ${reply}\n`);
                    speakText(reply);
                } else {
                    const reply = responseMessage.content || "[Processed]";
                    console.log(`\nFriday > ${reply}\n`);
                    speakText(reply);
                }

            } catch (err) {
                console.error(`\n[Friday Error]: ${err.message}`);
            }
        }
        
        startChat();
    });
}

performStartupBriefing();