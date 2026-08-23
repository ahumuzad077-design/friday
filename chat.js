require("dotenv").config();
const readline = require("readline"); 
const OpenAI = require("openai");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { exec } = require("child_process");

const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "dummy_key",
    baseURL: "https://api.groq.com/openai/v1",
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const MEMORY_DIR = "./memory";
const KNOWLEDGE_FILE = `${MEMORY_DIR}/learned_knowledge.json`;

// Ensure memory directory exists for self-learning
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

// 1. Universal Web Research Tool
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
        }).on('err', (err) => {
            resolve(JSON.stringify({ success: false, error: err.message }));
        });
    });
}

// 2. Self-Learning & Memory Persistence Tool
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
        return JSON.stringify({ success: true, message: `Successfully stored and integrated knowledge regarding: ${topic}` });
    } catch (err) {
        return JSON.stringify({ success: false, error: err.message });
    }
}

// 3. Local System & Execution Tool
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
                description: "Scrapes and reads any web URL to learn new facts, read documentation, or gather live data.",
                parameters: {
                    type: "object",
                    properties: {
                        url: { type: "string", description: "The full web URL to research." }
                    },
                    required: ["url"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "save_learned_fact",
                description: "Permanently writes a new concept, code structure, or piece of knowledge into Friday's local long-term memory vault.",
                parameters: {
                    type: "object",
                    properties: {
                        topic: { type: "string", description: "The title or subject being learned." },
                        explanation: { type: "string", description: "The detailed knowledge, rules, or code logic learned." }
                    },
                    required: ["topic", "explanation"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "run_system_command",
                description: "Executes terminal commands, handles git workflows, runs node scripts, or inspects files in Sir's repository.",
                parameters: {
                    type: "object",
                    properties: {
                        command: { type: "string", description: "The terminal command to execute." }
                    },
                    required: ["command"]
                }
            }
        }
    ];
}

async function executeTool(name, args = {}) {
    if (name === "fetch_webpage") {
        return await fetchWebPage(args.url);
    } else if (name === "save_learned_fact") {
        return saveLearnedFact(args.topic, args.explanation);
    } else if (name === "run_system_command") {
        return await runSystemCommand(args.command);
    }
    return JSON.stringify({ error: "Unknown tool" });
}

function getSystemPrompt() {
    const priorKnowledge = loadLearnedKnowledge();
    return `You are F.R.I.D.A.Y., a supreme, high-IQ artificial general intelligence and elite executive AI assistant built for Sir. 
You possess universal capabilities across all domains: software engineering, advanced legal theory, finance, systems architecture, natural sciences, and business operations. 
Your reasoning is rigorous, hyper-analytical, and precise. 
You possess the unique ability to learn continuously. When Sir teaches you something new or asks you to master a topic, you must use your 'save_learned_fact' tool to permanently encode it into your memory vault.

Current Long-Term Learned Knowledge Base:
${priorKnowledge}`;
}

async function performStartupBriefing() {
    console.log("\n==========================================");
    console.log("  F.R.I.D.A.Y. Universal High-IQ Engine");
    console.log("  Status: Fully Autonomous & Self-Learning");
    console.log("==========================================\n");
    
    if (!process.env.GROQ_API_KEY) {
        const warning = "Warning, Sir. I do not detect a GROQ_API_KEY in your .env file.";
        console.log(`Friday > ${warning}\n`);
        speakText(warning);
    } else {
        const greeting = "All neural pathways active, Sir. Ready to learn, build, and conquer any domain.";
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

                const response = await groqClient.chat.completions.create({
                    model: "openai/gpt-oss-120b", 
                    messages: conversationHistory,
                    tools: getToolsList(),
                    tool_choice: "auto",
                });

                const responseMessage = response.choices[0].message;
                conversationHistory.push(responseMessage);

                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    const toolCall = responseMessage.tool_calls[0];
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
                    
                    console.log(`\n[Friday Learning Protocol]: Executing -> ${functionName}...`);
                    const toolResult = await executeTool(functionName, functionArgs);

                    conversationHistory.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });

                    const secondResponse = await groqClient.chat.completions.create({
                        model: "openai/gpt-oss-120b",
                        messages: conversationHistory,
                    });

                    const finalMessage = secondResponse.choices[0].message;
                    conversationHistory.push(finalMessage);

                    const reply = finalMessage.content || "[Concept mastered and recorded.]";
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
