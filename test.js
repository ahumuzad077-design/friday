import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";
import { exec } from "child_process";
import readline from "readline";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1"
});

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const chatHistory = [
    { 
        role: "system", 
        content: "You are FRIDAY, an elite executive assistant. NEVER output long status reports, markdown tables, or bullet lists when chatting. Give brief, punchy, conversational replies under 3 sentences so they sound natural when spoken aloud." 
    }
];

async function speak(text) {
    console.log(`\n[FRIDAY]: ${text}\n`);
    
    if (!ELEVEN_LABS_API_KEY) return;

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`, {
            method: "POST",
            headers: {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVEN_LABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
        });

        if (!response.ok) return;

        const buffer = await response.arrayBuffer();
        const filePath = "friday_output.mp3";
        fs.writeFileSync(filePath, Buffer.from(buffer));

        if (process.platform === "win32") {
            exec(`start ${filePath}`);
        } else if (process.platform === "darwin") {
            exec(`afplay ${filePath}`);
        } else {
            exec(`xdg-open ${filePath}`);
        }
    } catch (error) {
        // Silent catch for audio playback errors
    }
}

async function askQuestion() {
    rl.question("You: ", async (userInput) => {
        if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
            console.log("Goodbye!");
            rl.close();
            process.exit(0);
        }

        chatHistory.push({ role: "user", content: userInput });

        try {
            const completion = await client.chat.completions.create({
                model: "openai/gpt-oss-20b",
                messages: chatHistory,
                temperature: 0.7,
                max_tokens: 80
            });

            const reply = completion.choices[0]?.message?.content || "Ready.";
            chatHistory.push({ role: "assistant", content: reply });
            await speak(reply);
        } catch (err) {
            console.log("[ERROR]:", err.message);
        }

        askQuestion();
    });
}

console.log("=== FRIDAY INTERACTIVE CHAT INITIALIZED ===");
console.log("Type your message below and press Enter. Type 'exit' to quit.\n");
askQuestion();