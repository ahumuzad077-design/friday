require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { TwitterApi } = require("twitter-api-v2");
const TelegramBot = require("node-telegram-bot-api");

async function runDiagnostics() {
    console.log("\n===========================================");
    console.log("🔍 FRIDAY SYSTEM HEALTH DIAGNOSTICS");
    console.log("===========================================\n");

    // 1. Memory Core Check
    try {
        const exists = fs.existsSync("./friday_lessons.json");
        console.log(`[Memory Engine]:   ${exists ? "✅ ONLINE (File present)" : "⚠️ WARN (File missing, will auto-create)"}`);
    } catch (e) {
        console.log(`[Memory Engine]:   ❌ ERROR (${e.message})`);
    }

    // 2. Open Endpoints (ISS & Weather)
    try {
        const iss = await axios.get("http://api.open-notify.org/iss-now.json");
        const weather = await axios.get("https://api.open-meteo.com/v1/forecast?latitude=0.3476&longitude=32.5825&current=temperature_2m");
        if (iss.data && weather.data) {
            console.log("[CTO Telemetry]:   ✅ ONLINE (ISS & Open-Meteo responding)");
        }
    } catch (e) {
        console.log(`[CTO Telemetry]:   ❌ ERROR (${e.message})`);
    }

    // 3. Financial Market Data
    try {
        const stock = await yahooFinance.quote("AAPL");
        const crypto = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
        if (stock && crypto.data) {
            console.log("[CFO Market Engine]:✅ ONLINE (Yahoo Finance & CoinGecko live)");
        }
    } catch (e) {
        console.log(`[CFO Market Engine]:❌ ERROR (${e.message})`);
    }

    // 4. Gemini AI Engine
    try {
        const key = process.env.GEMINI_API_KEY;
        if (!key || key.includes("PASTE")) {
            console.log("[Gemini AI]:       ⏭️ SKIPPED (Key not provided)");
        } else {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            await model.generateContent("Test connection");
            console.log("[Gemini AI]:       ✅ ONLINE (API key validated)");
        }
    } catch (e) {
        console.log(`[Gemini AI]:       ❌ ERROR (${e.message})`);
    }

    // 5. Twitter / X API
    try {
        const appKey = process.env.X_API_KEY;
        if (!appKey || appKey.includes("PASTE")) {
            console.log("[X / Twitter]:     ⏭️ SKIPPED (Keys not provided)");
        } else {
            const client = new TwitterApi({
                appKey: process.env.X_API_KEY,
                appSecret: process.env.X_API_SECRET,
                accessToken: process.env.X_ACCESS_TOKEN,
                accessSecret: process.env.X_ACCESS_SECRET,
            });
            const user = await client.v2.me();
            console.log(`[X / Twitter]:     ✅ ONLINE (Authenticated as @${user.data.username})`);
        }
    } catch (e) {
        console.log(`[X / Twitter]:     ❌ ERROR (${e.message})`);
    }

    // 6. Shopify Admin API
    try {
        const domain = process.env.SHOPIFY_STORE_DOMAIN;
        const token = process.env.SHOPIFY_ACCESS_TOKEN;
        if (!domain || domain.includes("PASTE")) {
            console.log("[Shopify Store]:   ⏭️ SKIPPED (Credentials not provided)");
        } else {
            const res = await axios.get(`https://${domain}/admin/api/2024-01/shop.json`, {
                headers: { "X-Shopify-Access-Token": token }
            });
            console.log(`[Shopify Store]:   ✅ ONLINE (Connected to ${res.data.shop.name})`);
        }
    } catch (e) {
        console.log(`[Shopify Store]:   ❌ ERROR (${e.response?.status === 401 ? "Invalid Access Token" : e.message})`);
    }

    // 7. Telegram Bot Remote
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token || token.includes("PASTE")) {
            console.log("[Telegram Remote]: ⏭️ SKIPPED (Token not provided)");
        } else {
            const bot = new TelegramBot(token);
            const me = await bot.getMe();
            console.log(`[Telegram Remote]: ✅ ONLINE (Bot active as @${me.username})`);
        }
    } catch (e) {
        console.log(`[Telegram Remote]: ❌ ERROR (${e.message})`);
    }

    console.log("\n===========================================\n");
}

runDiagnostics();
