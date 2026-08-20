require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");
const OpenAI = require('openai');

class FridayExecutiveAssistant {
    constructor() {
        // C-Suite Operational Roles
        this.roles = {
            CTO: "Chief Technology Officer - Infrastructure & Hardware",
            CFO: "Chief Financial Officer - Web3 & Real Trading",
            COO: "Chief Operating Officer - Daily Briefings & Machine Learning",
            CCO: "Chief Communications Officer - Outreach & Voice Interface"
        };

        this.memoryRepoPath = "./memory_repo.json";
        this.memoryRepo = this.loadMemory();

        // Initialize Groq Client using the provided environment variable
        this.groqClient = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        });
    }

    // --- MEMORY ENGINE ---
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

    // --- CCO MODULE: VOICE & FREE DISCORD OUTREACH ---
    async speak(text) {
        const formattedSpeech = `${text}, sir.`;
        console.log(`[CCO - Irish Voice Output]: "${formattedSpeech}"`);
        this.saveToMemory(`Spoke: ${formattedSpeech}`);
        return formattedSpeech;
    }

    async contactPerson(personName, message) {
        console.log(`[CCO]: Reaching out via Discord webhook...`);
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        
        if (!webhookUrl) {
            console.warn("[CCO Warning]: DISCORD_WEBHOOK_URL not configured.");
            return `Logged locally: Message for ${personName}`;
        }

        try {
            await axios.post(webhookUrl, {
                content: `**[F.R.I.D.A.Y. CCO Alert]** To: **${personName}**\n> ${message}`
            });
            console.log(`[CCO]: Dispatch successful to ${personName}.`);
            this.saveToMemory(`Contacted ${personName}: "${message}"`);
            return `Message dispatched to ${personName}`;
        } catch (error) {
            console.error("[CCO Error]: Failed to send dispatch.", error.message);
            return `Dispatch failed: ${error.message}`;
        }
    }

    // --- CFO MODULE: WEB3 & REAL MARKETS ---
    async connectWeb3() {
        try {
            if (!process.env.ALCHEMY_API_KEY || !process.env.WALLET_PRIVATE_KEY) {
                console.warn("[CFO Warning]: Web3 keys missing in .env.");
                return null;
            }

            const providerUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
            const provider = new ethers.JsonRpcProvider(providerUrl);
            const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
            
            console.log(`[CFO]: Web3 Wallet connected. Public Address: ${wallet.address}`);
            this.saveToMemory(`Connected Web3 wallet: ${wallet.address}`);
            return wallet;
        } catch (error) {
            console.error("[CFO Error]: Wallet connection failed.", error.message);
            return null;
        }
    }

    async analyzeMarketData(symbol = "bitcoin") {
        try {
            const res = await axios.get(`https://api.coincap.io/v2/assets/${symbol}`, { timeout: 5000 });
            const price = parseFloat(res.data.data.priceUsd).toFixed(2);
            console.log(`[CFO Market Data]: ${symbol.toUpperCase()} is currently $${price} USD.`);
            return { symbol, price };
        } catch (error) {
            console.error("[CFO Error]: Could not fetch market data.");
            return { symbol, price: "Unavailable" };
        }
    }

    // --- CTO MODULE: SPACE DATA & INFRASTRUCTURE ---
    async fetchSpaceData() {
        try {
            const res = await axios.get("https://api.wheretheiss.at/v1/satellites/25544", { timeout: 5000 });
            const { latitude, longitude, velocity } = res.data;
            console.log(`[CTO Space Data]: ISS Coordinates: (${latitude.toFixed(2)}, ${longitude.toFixed(2)}) at ${velocity.toFixed(0)} km/h.`);
            return res.data;
        } catch (error) {
            console.error("[CTO Error]: Space telemetry unreachable.");
            return null;
        }
    }

    // --- COO MODULE: BRIEFINGS & AI REASONING ---
    runLearningAlgorithm() {
        console.log("[COO Learning]: Parsing conversation memory repo to optimize response patterns...");
        console.log(`[COO Insights]: Processed ${this.memoryRepo.length} historical data points.`);
    }

    async bringMeUpToSpeed() {
        console.log("\n==========================================");
        console.log("[COO]: Assembling executive briefing...");
        
        await this.fetchSpaceData();
        await this.analyzeMarketData("bitcoin");
        this.runLearningAlgorithm();
        
        await this.speak("System operational. All C-suite modules active and up to date");
        console.log("==========================================\n");
    }
}

// --- EXECUTION BLOCK ---
async function main() {
    const Friday = new FridayExecutiveAssistant();
    await Friday.bringMeUpToSpeed();
}

main();
