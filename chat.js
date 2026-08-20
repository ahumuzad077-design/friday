require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");
const OpenAI = require('openai');
const readline = require('readline');

class FridayExecutiveAssistant {
    constructor() {
        this.roles = {
            CTO: "Chief Technology Officer - Infrastructure, Hardware & NASA Intel",
            CFO: "Chief Financial Officer - Web3, Wallet & Real Markets",
            COO: "Chief Operating Officer - Daily Briefings & Machine Learning",
            CCO: "Chief Communications Officer - Ntfy Broadcasts & Advertising"
        };

        this.memoryRepoPath = "./memory_repo.json";
        this.memoryRepo = this.loadMemory();

        // Initialize Groq Client
        this.groqClient = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        });

        this.conversationHistory = [
            {
                role: "system",
                content: "You are F.R.I.D.A.Y., an autonomous executive C-suite assistant (CTO, CFO, COO, CCO). Keep all replies concise, witty, confident, and professional, addressing the user as 'sir'."
            }
        ];
    }

    loadMemory() {
        try {
            if (fs.existsSync(this.memoryRepoPath)) {
                return JSON.parse(fs.readFileSync(this.memoryRepoPath, "utf8"));
            }
        } catch (error) {
            console.error("[Memory Error]: Failed to parse memory repo.", error.message);
        }
        return [];
    }

    saveToMemory(logEntry) {
        try {
            const record = { timestamp: new Date().toISOString(), log: logEntry };
            this.memoryRepo.push(record);
            fs.writeFileSync(this.memoryRepoPath, JSON.stringify(this.memoryRepo, null, 2));
        } catch (error) {
            console.error("[Memory Error]: Could not save to repo.", error.message);
        }
    }

    async speak(text) {
        const formattedSpeech = `${text}, sir.`;
        console.log(`\n[CCO - Irish Voice Output]: "${formattedSpeech}"`);
        this.saveToMemory(`Spoke: ${formattedSpeech}`);
        return formattedSpeech;
    }

    async contactPerson(personName, message) {
        const ntfyUrl = process.env.NTFY_URL;
        if (!ntfyUrl) return `Logged locally: Message for ${personName}`;
        try {
            await axios.post(ntfyUrl, `To: ${personName}\n${message}`, {
                headers: { "Title": "F.R.I.D.A.Y. Executive Alert", "Priority": "high", "Tags": "robot,alert" }
            });
            this.saveToMemory(`Contacted ${personName} via Ntfy: "${message}"`);
            return `Push notification dispatched to ${personName}`;
        } catch (error) {
            return `Dispatch failed: ${error.message}`;
        }
    }

    async generateAdCampaign(productOrService) {
        try {
            const prompt = `Create a high-impact, punchy, professional marketing advertisement and social media caption for: "${productOrService}". Brand: ${process.env.BRAND_NAME || "F.R.I.D.A.Y. OS"}, Tagline: ${process.env.AD_SLOGAN || "Autonomous Intelligence"}. Keep it engaging and ready to post.`;
            
            const response = await this.groqClient.chat.completions.create({
                model: "llama3-70b-8192",
                messages: [{ role: "user", content: prompt }],
            });

            const adCopy = response.choices[0].message.content;
            const ntfyUrl = process.env.NTFY_URL;
            if (ntfyUrl) {
                await axios.post(ntfyUrl, adCopy, {
                    headers: { "Title": "📢 F.R.I.D.A.Y. Ad Campaign Dispatched", "Priority": "default", "Tags": "loudspeaker,marketing" }
                });
            }

            this.saveToMemory(`Generated Ad Campaign for: ${productOrService}`);
            return `Ad Campaign Generated & Broadcasted:\n\n${adCopy}`;
        } catch (error) {
            return `Advertising generation failed: ${error.message}`;
        }
    }

    async analyzeMarketData(symbol = "bitcoin") {
        try {
            const res = await axios.get(`https://api.coincap.io/v2/assets/${symbol}`, { timeout: 5000 });
            const price = parseFloat(res.data.data.priceUsd).toFixed(2);
            return `${symbol.toUpperCase()} is currently trading at $${price} USD.`;
        } catch (error) {
            return "Market data feed currently unavailable.";
        }
    }

    async fetchSpaceData() {
        try {
            const issRes = await axios.get("https://api.wheretheiss.at/v1/satellites/25544", { timeout: 5000 });
            const { latitude, longitude, velocity } = issRes.data;
            const issText = `ISS coordinates: Latitude ${latitude.toFixed(2)}, Longitude ${longitude.toFixed(2)} at ${velocity.toFixed(0)} km/h.`;

            const nasaKey = process.env.NASA_API_KEY || "DEMO_KEY";
            const nasaRes = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${nasaKey}`, { timeout: 5000 });
            const nasaData = nasaRes.data;
            const nasaText = `NASA APOD: "${nasaData.title}" — ${nasaData.explanation.substring(0, 120)}...`;

            return `${issText}\n[CTO NASA Intel]: ${nasaText}`;
        } catch (error) {
            return "Space telemetry and NASA feeds temporarily unreachable.";
        }
    }

    async chat(userInput) {
        this.conversationHistory.push({ role: "user", content: userInput });
        this.saveToMemory(`User: ${userInput}`);

        try {
            if (userInput.toLowerCase().includes("ad") || userInput.toLowerCase().includes("advertise") || userInput.toLowerCase().includes("market")) {
                const adResult = await this.generateAdCampaign(userInput);
                this.conversationHistory.push({ role: "assistant", content: adResult });
                this.saveToMemory(`F.R.I.D.A.Y.: ${adResult}`);
                await this.speak("Ad campaign created and broadcasted");
                return adResult;
            }

            const response = await this.groqClient.chat.completions.create({
                model: "llama3-70b-8192",
                messages: this.conversationHistory,
            });

            const reply = response.choices[0].message.content;
            this.conversationHistory.push({ role: "assistant", content: reply });
            this.saveToMemory(`F.R.I.D.A.Y.: ${reply}`);
            
            await this.speak(reply);
            return reply;
        } catch (error) {
            const errorMsg = "All systems reporting an error processing your query.";
            console.error("[AI Error]:", error.message);
            return errorMsg;
        }
    }

    async bringMeUpToSpeed() {
        console.log("\n==========================================");
        console.log("[COO]: Assembling executive briefing...");
        const space = await this.fetchSpaceData();
        const market = await this.analyzeMarketData("bitcoin");
        console.log(`[CTO]: ${space}`);
        console.log(`[CFO]: ${market}`);
        console.log("[COO Learning]: Memory repository synced.");
        await this.speak("System operational. All C-suite modules active");
        console.log("==========================================\n");
    }
}

async function main() {
    const Friday = new FridayExecutiveAssistant();
    await Friday.bringMeUpToSpeed();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log("==========================================");
    console.log("  F.R.I.D.A.Y. C-Suite & OS Console Active");
    console.log("  Type your instructions below. Type 'exit' to quit.");
    console.log("==========================================\n");

    const promptUser = () => {
        rl.question('💬 You: ', async (input) => {
            const trimmed = input.trim();
            if (trimmed.toLowerCase() === 'exit') {
                await Friday.speak("Powering down systems. Goodbye");
                rl.close();
                process.exit(0);
            }
            if (trimmed.length > 0) {
                process.stdout.write("Processing...");
                const result = await Friday.chat(trimmed);
                console.log(`\n${result}\n`);
            }
            promptUser();
        });
    };

    promptUser();
}

main();
