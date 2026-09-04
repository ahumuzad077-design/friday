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
        content: "You are FRIDAY, an elite executive assistant. STRICT RULE: Keep every response under 2 sentences. Never output tables, markdown headers, or lists. Answer questions directly and conversationally." 
    }
];

async function speak(text) {
    console.log(`\n[FRIDAY]: ${text}\n`);
    if (!ELEVEN_LABS_API_KEY) return;
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`, {
            method: "POST",
            headers: { "Accept": "audio/mpeg", "Content-Type": "application/json", "xi-api-key": ELEVEN_LABS_API_KEY },
            body: JSON.stringify({ text: text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
        });
        if (!response.ok) return;
        const buffer = await response.arrayBuffer();
        fs.writeFileSync("friday_output.mp3", Buffer.from(buffer));
        if (process.platform === "win32") exec("start friday_output.mp3");
    } catch (error) {}
}

async function askQuestion() {
    rl.question("You: ", async (userInput) => {
        if (!userInput.trim()) {
            askQuestion();
            return;
        }
        if (userInput.toLowerCase() === "exit") { rl.close(); process.exit(0); }
        chatHistory.push({ role: "user", content: userInput });
        try {
            const completion = await client.chat.completions.create({
                model: "openai/gpt-oss-20b",
                messages: chatHistory,
                temperature: 0.7,
                max_tokens: 60
            });
            const reply = completion.choices[0]?.message?.content || "I am ready to assist.";
            chatHistory.push({ role: "assistant", content: reply });
            await speak(reply);
        } catch (err) {
            console.log("[ERROR]:", err.message);
        }
        askQuestion();
    });
}

console.log("=== FRIDAY INTERACTIVE CHAT INITIALIZED ===");
askQuestion();
