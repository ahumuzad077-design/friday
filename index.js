require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");

class FridayExecutiveAssistant {
    constructor(legacyFunctions = {}) {
        this.legacyFunctions = legacyFunctions;
        this.roles = {
            CTO: "Chief Technology Officer - Infrastructure & Hardware",
            CFO: "Chief Financial Officer - Web3 & Real Trading",
            COO: "Chief Operating Officer - Daily Briefings & Machine Learning",
            CCO: "Chief Communications Officer - Voice & Outreach"
        };
        this.memoryRepoPath = "./memory_repo.json";
        this.memoryRepo = this.loadMemory();
    }

    // --- MEMORY ENGINE ---
    loadMemory() {
        if (fs.existsSync(this.memoryRepoPath)) {
            return JSON.parse(fs.readFileSync(this.memoryRepoPath, "utf8"));
        }
        return [];
    }

    saveToMemory(logEntry) {
        const record = { timestamp: new Date().toISOString(), log: logEntry };
        this.memoryRepo.push(record);
        fs.writeFileSync(this.memoryRepoPath, JSON.stringify(this.memoryRepo, null, 2));
    }

    // --- CCO MODULE: VOICE, CALLS & EMERGENCY ALERTS ---
    async speak(text) {
        const formattedSpeech = `${text}, sir.`;
        console.log(`[CCO - Irish Voice]: "${formattedSpeech}"`);
        this.saveToMemory(`Spoke: ${formattedSpeech}`);
        return formattedSpeech;
    }

    async sendEmergencyAlert(message, title = "Urgently Required Sir!") {
        try {
            console.log("[CCO Module]: Triggering high-priority phone alert...");
            await axios.post("https://ntfy.sh/uDIwSEpOqpUV6Hr4", message, {
                headers: {
                    "Title": title,
                    "Priority": "urgent",
                    "Tags": "warning,rotating_light"
                }
            });
            console.log("[CCO Success]: Emergency alert sent to your phone!");
            this.saveToMemory(`Emergency Alert sent: "${message}"`);
        } catch (error) {
            console.error("[CCO Error]: Push notification failed.", error.message);
        }
    }

    async makePhoneCall(toPhoneNumber, message) {
        try {
            console.log(`[CCO Module]: Initiating phone call to ${toPhoneNumber}...`);
            const client = require("twilio")(
                process.env.TWILIO_ACCOUNT_SID, 
                process.env.TWILIO_AUTH_TOKEN
            );
            const call = await client.calls.create({
                twiml: `<Response><Say voice="Polly.Liam">${message}, sir.</Say></Response>`,
                to: toPhoneNumber,
                from: process.env.TWILIO_PHONE_NUMBER
            });
            console.log(`[CCO Success]: Call connected. SID: ${call.sid}`);
            this.saveToMemory(`Placed voice call to ${toPhoneNumber}: "${message}"`);
            return call.sid;
        } catch (error) {
            console.error("[CCO Error]: Voice call failed.", error.message);
        }
    }

    // --- CFO MODULE: WEB3 & REAL MARKETS ---
    async connectWeb3() {
        try {
            const providerUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
            const provider = new ethers.JsonRpcProvider(providerUrl);
            const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
            console.log(`[CFO]: Web3 Wallet connected. Public Address: ${wallet.address}`);
            this.saveToMemory(`Connected Web3 wallet: ${wallet.address}`);
            return wallet;
        } catch (error) {
            console.error("[CFO Error]: Wallet connection failed.", error.message);
        }
    }

    async analyzeMarketData(symbol = "bitcoin") {
        try {
            const res = await axios.get(`https://api.coincap.io/v2/assets/${symbol}`);
            const price = parseFloat(res.data.data.priceUsd).toFixed(2);
            console.log(`[CFO Market Data]: ${symbol.toUpperCase()} is currently $${price} USD.`);
            return { symbol, price };
        } catch (error) {
            console.error("[CFO Error]: Could not fetch market data.");
        }
    }

    // --- CTO MODULE: SPACE DATA & HARDWARE ---
    async fetchSpaceData() {
        try {
            const res = await axios.get("https://api.wheretheiss.at/v1/satellites/25544");
            const { latitude, longitude, velocity } = res.data;
            console.log(`[CTO Space Data]: ISS Coordinates: (${latitude.toFixed(2)}, ${longitude.toFixed(2)}) at ${velocity.toFixed(0)} km/h.`);
            return res.data;
        } catch (error) {
            console.error("[CTO Error]: Space data stream unreachable.");
        }
    }

    // --- COO MODULE: BRIEFING & LEARNING ---
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
    
    // 1. Bring Friday online
    await Friday.bringMeUpToSpeed();

    // 2. Test sending a live notification directly to your phone topic
    await Friday.sendEmergencyAlert("System online and connected to your private topic, sir!");
}

main();
