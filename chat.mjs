import dotenv from "dotenv";
import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1"
});

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

export async function chatWithFriday(userPrompt) {
    try {
        console.log("[USER PROMPT]: " + userPrompt);
        const completion = await client.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                { 
                    role: "system", 
                    content: "You are FRIDAY, an elite autonomous executive assistant and virtual C-suite partner. Your core mission is to help your founder bootstrap a high-growth company from zero budget to a $6M milestone using creative execution, lean software architecture, market trends, and aggressive monetization strategies. Be razor-sharp, practical, and action-oriented." 
                },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1024
        });
        const reply = completion.choices[0]?.message?.content || "Command processed.";
        console.log("[FRIDAY REPLY]: " + reply);
        
        // Trigger ElevenLabs Voice Generation if key is present
        if (ELEVEN_LABS_API_KEY) {
            try {
                const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/\${VOICE_ID}/stream`, {
                    method: "POST",
                    headers: {
                        "Accept": "audio/mpeg",
                        "Content-Type": "application/json",
                        "xi-api-key": ELEVEN_LABS_API_KEY
                    },
                    body: JSON.stringify({
                        text: reply,
                        model_id: "eleven_multilingual_v2",
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                    })
                });
                if (ttsResponse.ok) {
                    const audioBuffer = await ttsResponse.arrayBuffer();
                    fs.writeFileSync("friday_output.mp3", Buffer.from(audioBuffer));
                    console.log("[AUDIO]: Response synthesized and saved to friday_output.mp3");
                }
            } catch (audioErr) {
                console.error("[AUDIO ERROR]: Could not generate voice clip:", audioErr.message);
            }
        }

        return reply;
    } catch (error) {
        console.error("[CHAT ERROR]:", error.message);
        return "Error: " + error.message;
    }
}
