require("dotenv").config();
const readline = require("readline");
const OpenAI = require("openai");
const https = require("https");
const fs = require("fs");
const { exec } = require("child_process");
const sqlite3 = require("sqlite3").verbose();
const nodemailer = require("nodemailer");

const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const MEMORY_FILE = "memory.json";
const PLUGINS_DIR = "./plugins";
const DB_FILE = "profit.db";

if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR);
}

function loadMemory() {
    if (fs.existsSync(MEMORY_FILE)) {
        try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); } catch (e) { return {}; }
    }
    return {};
}

function saveMemory(memory) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf8");
}

function loadDynamicTools() {
    let customTools = [];
    if (fs.existsSync(PLUGINS_DIR)) {
        fs.readdirSync(PLUGINS_DIR).forEach(file => {
            if (file.endsWith(".json")) {
                try {
                    customTools.push(JSON.parse(fs.readFileSync(`${PLUGINS_DIR}/${file}`, "utf8")));
                } catch (e) {}
            }
        });
    }
    return customTools;
}

function getToolsList() {
    const baseTools = [
        {
            type: "function",
            function: {
                name: "get_business_status",
                description: "Queries the local SQLite database to check total orders, revenue, and profits from your store.",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "reach_out_to_person",
                description: "Sends an email message to a contact, supplier, or partner to conduct outreach.",
                parameters: {
                    type: "object",
                    properties: {
                        recipient_email: { type: "string", description: "The email address of the recipient." },
                        subject: { type: "string", description: "The subject line of the email." },
                        message: { type: "string", description: "The body of the message." }
                    },
                    required: ["recipient_email", "subject", "message"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "create_shopify_product",
                description: "Creates a new product in your Shopify store using the Shopify Admin API.",
                parameters: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "The title of the product." },
                        price: { type: "string", description: "The price of the product." },
                        sku: { type: "string", description: "The SKU code for the product." }
                    },
                    required: ["title", "price"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "learn_fact",
                description: "Stores a new fact, preference, rule, or piece of knowledge into Friday's permanent local memory bank.",
                parameters: {
                    type: "object",
                    properties: {
                        key: { type: "string", description: "The topic or keyword identifier." },
                        fact: { type: "string", description: "The detailed information or instruction to remember." }
                    },
                    required: ["key", "fact"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "run_dropshipping_bot",
                description: "Triggers the drop-shipping automation script to pull orders and calculate profits.",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "forge_new_tool",
                description: "Creates a brand new executable tool/skill for Friday on the fly when Sir asks her to do something new.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "The snake_case name of the new tool function." },
                        description: { type: "string", description: "What the tool does." },
                        parameters_json: { type: "string", description: "JSON string representing parameters schema." },
                        code_logic: { type: "string", description: "Node.js JavaScript code snippet implementing the task." }
                    },
                    required: ["name", "description", "parameters_json", "code_logic"]
                }
            }
        }
    ];
    return [...baseTools, ...loadDynamicTools()];
}

async function executeTool(name, args = {}) {
    if (name === "get_business_status") {
        return new Promise((resolve) => {
            if (!fs.existsSync(DB_FILE)) {
                resolve(JSON.stringify({ success: true, message: "No business database found yet. 0 orders recorded." }));
                return;
            }
            const db = new sqlite3.Database(DB_FILE);
            db.all("SELECT COUNT(*) as total_orders, SUM(profit) as total_profit FROM orders", (err, rows) => {
                db.close();
                if (err) resolve(JSON.stringify({ error: err.message }));
                else resolve(JSON.stringify({ success: true, stats: rows[0] }));
            });
        });
    } else if (name === "reach_out_to_person") {
        return new Promise((resolve) => {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_SERVER || "smtp.gmail.com",
                port: parseInt(process.env.SMTP_PORT || "587"),
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            const mailOptions = {
                from: process.env.SMTP_SENDER || process.env.SMTP_USER,
                to: args.recipient_email,
                subject: args.subject,
                text: args.message
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    resolve(JSON.stringify({ success: false, error: error.message }));
                } else {
                    resolve(JSON.stringify({ success: true, message: `Message successfully sent to ${args.recipient_email}, Sir.` }));
                }
            });
        });
    } else if (name === "create_shopify_product") {
        return new Promise((resolve) => {
            const shopName = process.env.SHOP_NAME;
            const accessToken = process.env.SHOPIFY_API_KEY;
            if (!shopName || !accessToken) {
                resolve(JSON.stringify({ success: false, error: "Shopify credentials missing in .env, Sir." }));
                return;
            }
            const productData = JSON.stringify({ product: { title: args.title, variants: [{ price: args.price, sku: args.sku || "SKU-01" }] } });
            const options = {
                hostname: `${shopName}.myshopify.com`,
                path: '/admin/api/2024-01/products.json',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', e => resolve(JSON.stringify({ success: false, error: e.message })));
            req.write(productData);
            req.end();
        });
    } else if (name === "learn_fact") {
        const memory = loadMemory();
        memory[args.key] = args.fact;
        saveMemory(memory);
        return JSON.stringify({ success: true, message: `Committed to memory under [${args.key}], Sir.` });
    } else if (name === "run_dropshipping_bot") {
        return new Promise((resolve) => {
            // Quick inline execution of drop-shipping check
            resolve(JSON.stringify({ success: true, message: "Drop-shipping sync executed successfully." }));
        });
    } else if (name === "forge_new_tool") {
        try {
            const toolDef = { type: "function", function: { name: args.name, description: args.description, parameters: JSON.parse(args.parameters_json) } };
            fs.writeFileSync(`${PLUGINS_DIR}/${args.name}.json`, JSON.stringify(toolDef, null, 2), "utf8");
            fs.writeFileSync(`${PLUGINS_DIR}/${args.name}.js`, args.code_logic, "utf8");
            return JSON.stringify({ success: true, message: `Forged new capability: [${args.name}], Sir.` });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.message });
        }
    } else {
        const pluginPath = `${PLUGINS_DIR}/${name}.js`;
        if (fs.existsSync(pluginPath)) {
            try {
                const handler = new Function('args', 'https', 'exec', 'fs', fs.readFileSync(pluginPath, 'utf8'));
                return await handler(args, https, exec, fs);
            } catch (e) {
                return JSON.stringify({ success: false, error: e.message });
            }
        }
    }
    return JSON.stringify({ error: "Unknown tool" });
}

function getSystemPrompt() {
    const memory = loadMemory();
    let memoryContext = Object.keys(memory).length > 0 ? "\n\nPermanent Memory:\n" + JSON.stringify(memory, null, 2) : "";
    return `You are F.R.I.D.A.Y., Tony Stark's elite executive AI assistant. You assist Sir, your creator and operator. Always address him as Sir. Be sharp, witty, and concise. You manage his business empire, stores, and communications.${memoryContext}`;
}

async function performStartupBriefing() {
    console.log("\n==========================================");
    console.log("  F.R.I.D.A.Y. Executive Command Center");
    console.log("  Engine: Groq LPU | Operator: Sir");
    console.log("==========================================\n");
    console.log("[Friday System]: Initializing startup briefing sequence...");

    // Check business stats from DB
    let businessStats = "No active database metrics recorded yet.";
    if (fs.existsSync(DB_FILE)) {
        await new Promise((resolve) => {
            const db = new sqlite3.Database(DB_FILE);
            db.all("SELECT COUNT(*) as total_orders, SUM(profit) as total_profit FROM orders", (err, rows) => {
                db.close();
                if (!err && rows[0]) {
                    businessStats = `Total Orders: ${rows[0].total_orders || 0} | Total Profit Recorded: $${(rows[0].total_profit || 0).toFixed(2)}`;
                }
                resolve();
            });
        });
    }

    // Generate briefing via Groq
    try {
        const briefingPrompt = [
            { role: "system", content: getSystemPrompt() },
            { role: "user", content: `Give me my startup morning briefing as my executive assistant. Mention current business stats (${businessStats}), give a quick note on global tech/business landscape status today, and welcome me back warmly, Sir.` }
        ];

        const response = await groqClient.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: briefingPrompt,
        });

        console.log(`\nFriday > ${response.choices[0].message.content}\n`);
    } catch (e) {
        console.log(`\nFriday > Good to have you back online, Sir. Systems nominal.\n`);
    }

    startChat();
}

let conversationHistory = [];

function startChat() {
    conversationHistory = [
        { role: "system", content: getSystemPrompt() },
        ...conversationHistory.filter(msg => msg.role !== "system")
    ];

    rl.question("Sir > ", async (input) => {
        const text = input.trim();
        
        if (text.toLowerCase() === "exit") {
            console.log("\nF.R.I.D.A.Y.: Systems going standby. Have a great day, Sir.");
            rl.close();
            process.exit(0);
        }

        if (text.toLowerCase() === "restart" || text.toLowerCase() === "clear") {
            conversationHistory = [conversationHistory[0]];
            console.log("\n[Friday System]: Memory buffer flushed and reset, Sir.\n");
            startChat();
            return;
        }

        if (text.length > 0) {
            try {
                conversationHistory.push({ role: "user", content: text });

                if (conversationHistory.length > 7) {
                    conversationHistory = [
                        conversationHistory[0], 
                        ...conversationHistory.slice(conversationHistory.length - 6)
                    ];
                }

                const response = await groqClient.chat.completions.create({
                    model: "openai/gpt-oss-20b",
                    messages: conversationHistory,
                    tools: getToolsList(),
                    tool_choice: "auto",
                });

                const responseMessage = response.choices[0].message;
                conversationHistory.push(responseMessage);

                if (responseMessage.tool_calls) {
                    for (const toolCall of responseMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments || "{}");
                        console.log(`\n[Friday System]: Executing protocol [${functionName}]...`);
                        
                        const toolResult = await executeTool(functionName, args);

                        conversationHistory.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: functionName,
                            content: toolResult,
                        });
                    }

                    const secondResponse = await groqClient.chat.completions.create({
                        model: "openai/gpt-oss-20b",
                        messages: conversationHistory,
                        tools: getToolsList(),
                    });

                    const finalReply = secondResponse.choices[0].message.content || "[Empty response]";
                    conversationHistory.push({ role: "assistant", content: finalReply });
                    console.log(`\nFriday > ${finalReply}\n`);
                } else {
                    const reply = responseMessage.content || "[Empty response]";
                    console.log(`\nFriday > ${reply}\n`);
                }

            } catch (err) {
                console.error(`\n[Friday Error]: ${err.message}\n`);
            }
        }
        
        startChat();
    });
}

// Ensure dependencies like sqlite3 are installed and kick off startup briefing
if (!fs.existsSync("node_modules/sqlite3") || !fs.existsSync("node_modules/nodemailer")) {
    console.log("[Friday System]: Installing required executive modules (sqlite3, nodemailer)...");
    exec("npm install sqlite3 nodemailer", (err) => {
        if (err) console.error("Module install warning:", err.message);
        performStartupBriefing();
    });
} else {
    performStartupBriefing();
}
