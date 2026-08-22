require("dotenv").config();
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { TwitterApi } = require("twitter-api-v2");

// =========================================================================
// 🔑 MASTER KEYS CONFIGURATION (PASTE KEYS DIRECTLY HERE OR USE .ENV)
// =========================================================================
const KEYS = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "PASTE_YOUR_GEMINI_KEY_HERE",
    ALPHA_VANTAGE_KEY: process.env.ALPHA_VANTAGE_API_KEY || "P4LYSV36SHX272ZH",
    
    // Telegram Remote Control
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "PASTE_TELEGRAM_TOKEN_HERE",
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "PASTE_TELEGRAM_CHAT_ID_HERE",
    
    // X (Twitter) API Keys
    X_API_KEY: process.env.X_API_KEY || "PASTE_X_API_KEY_HERE",
    X_API_SECRET: process.env.X_API_SECRET || "PASTE_X_API_SECRET_HERE",
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || "PASTE_X_ACCESS_TOKEN_HERE",
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET || "PASTE_X_ACCESS_SECRET_HERE",

    // Shopify E-Commerce Admin API
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN || "PASTE_STORE.myshopify.com",
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN || "shpat_PASTE_SHOPIFY_TOKEN_HERE"
};

// Internal Files
const MEMORY_FILE = path.join(__dirname, "friday_lessons.json");

// Initialize Gemini AI
const genAI = KEYS.GEMINI_API_KEY && !KEYS.GEMINI_API_KEY.includes("PASTE") 
    ? new GoogleGenerativeAI(KEYS.GEMINI_API_KEY) 
    : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// Initialize Twitter/X Client
let twitterClient = null;
if (KEYS.X_API_KEY && !KEYS.X_API_KEY.includes("PASTE")) {
    twitterClient = new TwitterApi({
        appKey: KEYS.X_API_KEY,
        appSecret: KEYS.X_API_SECRET,
        accessToken: KEYS.X_ACCESS_TOKEN,
        accessSecret: KEYS.X_ACCESS_SECRET,
    }).readWrite;
}

// ==========================================
// 1. MEMORY & SELF-LEARNING ENGINE
// ==========================================
class FridayMemoryEngine {
    static getLessons() {
        if (!fs.existsSync(MEMORY_FILE)) return [];
        try {
            return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
        } catch (e) {
            return [];
        }
    }

    static recordLesson(taskType, mistake, correction) {
        const lessons = this.getLessons();
        const entry = { id: Date.now(), taskType, mistake, correction, date: new Date().toISOString() };
        lessons.push(entry);
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(lessons, null, 2));
        return entry;
    }
}

// ==========================================
// 2. SPACE & WEATHER INTELLIGENCE (CTO)
// ==========================================
class FridayCTOEngine {
    static async getSpaceStationLocation() {
        try {
            const res = await axios.get("http://api.open-notify.org/iss-now.json");
            return res.data.iss_position;
        } catch (err) {
            return null;
        }
    }

    static async getWeather(lat = 0.3476, lon = 32.5825) { // Kampala
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`;
            const res = await axios.get(url);
            return res.data.current;
        } catch (err) {
            return null;
        }
    }
}

// ==========================================
// 3. MARKET & FINANCIAL DATA (CFO)
// ==========================================
class FridayCFOEngine {
    static async getStockQuotes(symbols = ["AAPL", "TSLA", "NVDA"]) {
        const results = {};
        for (const symbol of symbols) {
            try {
                const quote = await yahooFinance.quote(symbol);
                results[symbol] = { price: quote.regularMarketPrice, changePct: quote.regularMarketChangePercent };
            } catch (e) {
                results[symbol] = null;
            }
        }
        return results;
    }

    static async getCryptoQuotes() {
        try {
            const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd");
            return res.data;
        } catch (err) {
            return null;
        }
    }
}

// ==========================================
// 4. SHOPIFY E-COMMERCE ENGINE
// ==========================================
class FridayShopifyEngine {
    static async getRecentOrders() {
        if (KEYS.SHOPIFY_STORE_DOMAIN.includes("PASTE") || KEYS.SHOPIFY_ACCESS_TOKEN.includes("PASTE")) {
            return null;
        }
        try {
            const url = `https://${KEYS.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?status=any&limit=5`;
            const res = await axios.get(url, {
                headers: {
                    "X-Shopify-Access-Token": KEYS.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json"
                }
            });
            return res.data.orders || [];
        } catch (err) {
            console.error("[Shopify Engine Error]:", err.message);
            return null;
        }
    }
}

// ==========================================
// 5. SOCIAL MEDIA ENGINE (X / TWITTER)
// ==========================================
class FridaySocialEngine {
    static async postTweet(content) {
        if (!twitterClient) {
            console.log("[X Engine]: Twitter keys not configured in top KEYS block.");
            return false;
        }
        try {
            const res = await twitterClient.v2.tweet(content);
            console.log(`[X Engine]: Tweet posted successfully! ID: ${res.data.id}`);
            return res.data;
        } catch (err) {
            console.error("[X Engine Error]:", err.message);
            return false;
        }
    }
}

// ==========================================
// 6. REVENUE ENGINE (AUTONOMOUS MONETIZATION)
// ==========================================
class FridayRevenueEngine {
    static async scanMarketSignals(tickers = ["AAPL", "TSLA", "BTC-USD"]) {
        const signals = [];
        for (const ticker of tickers) {
            try {
                const quote = await yahooFinance.quote(ticker);
                const changePct = quote.regularMarketChangePercent;
                if (changePct <= -3.0) {
                    signals.push(`🚨 DIP ALERT: ${ticker} dropped ${changePct.toFixed(2)}% ($${quote.regularMarketPrice}). Potential buy entry.`);
                } else if (changePct >= 5.0) {
                    signals.push(`📈 SURGE ALERT: ${ticker} gained +${changePct.toFixed(2)}% ($${quote.regularMarketPrice}). Consider taking profit.`);
                }
            } catch (err) {
                // Skip errored ticker
            }
        }
        return signals;
    }

    static async generateSocialContent(topic) {
        if (!model) return "Gemini API key not configured.";
        const prompt = `Write a viral X (Twitter) thread (3 posts max) breaking down: "${topic}". Include actionable insights and hashtags.`;
        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (err) {
            return `Error generating content: ${err.message}`;
        }
    }
}

// ==========================================
// 7. TELEGRAM MOBILE REMOTE CONTROL
// ==========================================
class FridayTelegramEngine {
    constructor() {
        if (!KEYS.TELEGRAM_BOT_TOKEN || KEYS.TELEGRAM_BOT_TOKEN.includes("PASTE")) {
            console.log("[Telegram Remote]: Bot token not set. Mobile control offline.");
            return;
        }
        this.bot = new TelegramBot(KEYS.TELEGRAM_BOT_TOKEN, { polling: true });
        this.init();
    }

    init() {
        console.log("[Telegram Remote]: Bot initialized and polling...");

        this.bot.onText(/\/start/, (msg) => {
            this.bot.sendMessage(msg.chat.id, "Friday Executive Engine online.\n\nCommands:\n/briefing - Executive summary\n/orders - Recent Shopify orders\n/signals - Scan market dips & surges\n/tweet [Text] - Post directly to X/Twitter");
        });

        this.bot.onText(/\/orders/, async (msg) => {
            this.bot.sendMessage(msg.chat.id, "Checking Shopify store orders...");
            const orders = await FridayShopifyEngine.getRecentOrders();
            if (!orders) {
                this.bot.sendMessage(msg.chat.id, "❌ Shopify credentials missing or invalid.");
            } else if (orders.length === 0) {
                this.bot.sendMessage(msg.chat.id, "🛍️ No recent orders found in store.");
            } else {
                let text = `🛍️ *Recent Shopify Orders (${orders.length}):*\n\n`;
                orders.forEach(o => {
                    text += `• Order #${o.order_number}: $${o.total_price} (${o.financial_status})\n`;
                });
                this.bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
            }
        });

        this.bot.onText(/\/signals/, async (msg) => {
            this.bot.sendMessage(msg.chat.id, "Scanning market signals...");
            const signals = await FridayRevenueEngine.scanMarketSignals();
            const text = signals.length > 0 ? signals.join("\n\n") : "No market anomalies detected.";
            this.bot.sendMessage(msg.chat.id, text);
        });

        this.bot.onText(/\/tweet (.+)/, async (msg, match) => {
            const textToPost = match[1];
            this.bot.sendMessage(msg.chat.id, `Posting to X: "${textToPost}"...`);
            const success = await FridaySocialEngine.postTweet(textToPost);
            if (success) {
                this.bot.sendMessage(msg.chat.id, "✅ Tweet successfully published!");
            } else {
                this.bot.sendMessage(msg.chat.id, "❌ Failed to publish tweet. Check API keys.");
            }
        });

        this.bot.onText(/\/briefing/, async (msg) => {
            const iss = await FridayCTOEngine.getSpaceStationLocation();
            const weather = await FridayCTOEngine.getWeather();
            const stocks = await FridayCFOEngine.getStockQuotes();
            const crypto = await FridayCFOEngine.getCryptoQuotes();

            let summary = `📊 *FRIDAY EXECUTIVE BRIEFING*\n\n`;
            if (iss) summary += `🛰️ *ISS Position:* Lat ${iss.latitude}, Lon ${iss.longitude}\n`;
            if (weather) summary += `🌡️ *Kampala Weather:* ${weather.temperature_2m}°C, ${weather.relative_humidity_2m}% humidity\n`;
            if (stocks.AAPL) summary += `📈 *AAPL:* $${stocks.AAPL.price}\n`;
            if (crypto) summary += `₿ *BTC:* $${crypto.bitcoin.usd} | *ETH:* $${crypto.ethereum.usd}\n`;

            this.bot.sendMessage(msg.chat.id, summary, { parse_mode: "Markdown" });
        });

        this.bot.on("message", async (msg) => {
            if (msg.text && !msg.text.startsWith("/") && model) {
                try {
                    this.bot.sendChatAction(msg.chat.id, "typing");
                    const result = await model.generateContent(msg.text);
                    this.bot.sendMessage(msg.chat.id, result.response.text());
                } catch (e) {
                    this.bot.sendMessage(msg.chat.id, `[Friday Error]: ${e.message}`);
                }
            }
        });
    }
}

// ==========================================
// 8. EXECUTIVE BRIEFING & CHAT LAUNCHER
// ==========================================
async function runExecutiveBriefing() {
    console.log("\n==========================================");
    console.log("[COO]: Assembling executive briefing...");

    const iss = await FridayCTOEngine.getSpaceStationLocation();
    if (iss) console.log(`[CTO Space Data]: ISS Coordinates: (${iss.latitude}, ${iss.longitude}).`);

    const weather = await FridayCTOEngine.getWeather();
    if (weather) console.log(`[CTO Weather]: Kampala: ${weather.temperature_2m}°C | Humidity: ${weather.relative_humidity_2m}%.`);

    const stocks = await FridayCFOEngine.getStockQuotes();
    const crypto = await FridayCFOEngine.getCryptoQuotes();
    if (stocks.AAPL && crypto) {
        console.log(`[CFO Market Data]: AAPL: $${stocks.AAPL.price} | BTC: $${crypto.bitcoin.usd} | ETH: $${crypto.ethereum.usd}`);
    }

    const orders = await FridayShopifyEngine.getRecentOrders();
    if (orders) console.log(`[Shopify Engine]: Store active. ${orders.length} recent orders checked.`);

    console.log('[CCO]: "System operational. All C-suite modules active, sir."');
    console.log("==========================================\n");
}

function startInteractiveConsole() {
    if (!model) {
        console.log("[Friday Console]: Gemini API key missing. Enter your key at the top of index.js.");
        return;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const chatSession = model.startChat({
        history: [
            { role: "user", parts: [{ text: "You are Friday, an AI assistant." }] },
            { role: "model", parts: [{ text: "Systems online, sir." }] }
        ]
    });

    console.log("Type your message below (or 'exit' to quit):\n");

    function promptUser() {
        rl.question("You > ", async (input) => {
            if (input.trim().toLowerCase() === "exit") {
                rl.close();
                process.exit(0);
            }
            if (input.trim().length > 0) {
                try {
                    const result = await chatSession.sendMessage(input);
                    console.log(`\nFriday > ${result.response.text()}\n`);
                } catch (err) {
                    console.error(`\n[Friday Error]: ${err.message}\n`);
                }
            }
            promptUser();
        });
    }
    promptUser();
}

// Master Initialization Routine
async function main() {
    await runExecutiveBriefing();
    new FridayTelegramEngine();
    startInteractiveConsole();
}

main();
