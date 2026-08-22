cat << 'EOF' > chat.js
require("dotenv").config();
const readline = require("readline");
const OpenAI = require("openai");
const https = require("https");

// Initialize Groq client using your environment variables
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==========================================");
console.log("  F.R.I.D.A.Y. Command Center - Core Online");
console.log("  Engine: Groq LPU (openai/gpt-oss-20b)");
console.log("  Operator: Sir");
console.log("  Type your message below (or type 'exit' to quit):");
console.log("==========================================\n");

// Define live telemetry & space tools
const tools = [
    {
        type: "function",
        function: {
            name: "get_iss_telemetry",
            description: "Fetches live coordinates, altitude, and velocity of the International Space Station (ISS).",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "fetch_nasa_apod",
            description: "Fetches NASA's Astronomy Picture of the Day data using the NASA API key.",
            parameters: { type: "object", properties: {} }
        }
    }
];

// Execute requested tools securely
async function executeTool(name) {
    if (name === "get_iss_telemetry") {
        return new Promise((resolve) => {
            https.get("https://api.wheretheiss.at/v1/satellites/25544", (res) => {
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("end", () => resolve(data));
            }).on("error", (err) => resolve(JSON.stringify({ error: err.message })));
        });
    } else if (name === "fetch_nasa_apod") {
        const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
        return new Promise((resolve) => {
            https.get(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`, (res) => {
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("end", () => resolve(data));
            }).on("error", (err) => resolve(JSON.stringify({ error: err.message })));
        });
    }
    return JSON.stringify({ error: "Unknown tool" });
}

const conversationHistory = [
    { 
        role: "system", 
        content: "You are F.R.I.D.A.Y., Tony Stark's elite autonomous AI assistant. You are assisting your creator and operator, Sir. Always address him as Sir. Be sharp, witty, highly competent with code and Web3 operations, and invoke your live satellite/space tools whenever requested." 
    }
];

function startChat() {
    rl.question("Sir > ", async (input) => {
        const text = input.trim();
        
        if (text.toLowerCase() === "exit") {
            console.log("\nF.R.I.D.A.Y.: Systems going standby. Have a great day, Sir.");
            rl.close();
            process.exit(0);
        }

        if (text.length > 0) {
            try {
                conversationHistory.push({ role: "user", content: text });

                const response = await groqClient.chat.completions.create({
                    model: "openai/gpt-oss-20b",
                    messages: conversationHistory,
                    tools: tools,
                    tool_choice: "auto",
                });

                const responseMessage = response.choices[0].message;
                conversationHistory.push(responseMessage);

                // Handle tool execution if triggered
                if (responseMessage.tool_calls) {
                    for (const toolCall of responseMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        console.log(`\n[Friday System]: Executing protocol [${functionName}]...`);
                        
                        const toolResult = await executeTool(functionName);

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
                    });

                    const finalReply = secondResponse.choices[0].message.content;
                    conversationHistory.push({ role: "assistant", content: finalReply });
                    console.log(`\nFriday > ${finalReply}\n`);
                } else {
                    const reply = responseMessage.content;
                    console.log(`\nFriday > ${reply}\n`);
                }

            } catch (err) {
                console.error(`\n[Friday Error]: ${err.message}\n`);
            }
        }
        
        startChat();
    });
}

startChat();
EOF

git add chat.js
git commit -m "Upgrade chat.js with telemetry tools, gpt-oss-20b engine, and custom Sir greeting"
git push origin main
