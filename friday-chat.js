import dotenv from 'dotenv';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import fs from 'fs';

dotenv.config();

// Connects using your API key from .env (Groq, OpenRouter, or compatible endpoint)
const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1"
});

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

export async function chatWithFriday(userPrompt) {
    try {
        console.log(`[USER PROMPT]: ${userPrompt}`);

        // 1. Send the prompt to openai/gpt-oss-20b
        const completion = await client.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                {
                    role: "system",
                    content: "You are FRIDAY, an elite autonomous executive assistant. Speak with sharp intelligence, directness, and total reliability. Keep responses punchy and structured for voice playback."
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1024
        });

        const reply = completion.choices[0]?.message?.content || "Command processed.";
        console.log(`[FRIDAY REPLY]: ${reply}`);

        // 2. Optional: Generate spoken audio output via ElevenLabs if configured
        if (ELEVEN_LABS_API_KEY) {
            await synthesizeVoice(reply);
        }

        return reply;
    } catch (error) {
        console.error("[CHAT ERROR]:", error.message);
        return `Error executing command: ${error.message}`;
    }
}

async function synthesizeVoice(text) {
    try {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVEN_LABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
        });

        if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);

        const audioBuffer = await response.arrayBuffer();
        fs.writeFileSync('./friday_response.mp3', Buffer.from(audioBuffer));
        console.log("[AUDIO GENERATED]: Saved to friday_response.mp3");
    } catch (err) {
        console.error("[VOICE ERROR]:", err.message);
    }
}s