require("dotenv").config();
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const http = require("http");

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, "empire_state.db");
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error("[Database] Connection error:", err.message);
        process.exitCode = 1;
        return;
    }

    console.log("[Database] Connected to SQLite.");
    db.run(`
        CREATE TABLE IF NOT EXISTS empire_financial_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_source TEXT NOT NULL,
            revenue_generated REAL NOT NULL DEFAULT 0,
            allocation_target TEXT,
            status TEXT NOT NULL,
            details TEXT,
            timestamp TEXT NOT NULL
        )
    `, (createErr) => {
        if (createErr) {
            console.error("[Database] Schema error:", createErr.message);
            process.exitCode = 1;
        }
    });
});

function logEmpireActivity(source, revenue, target, status, details) {
    const timestamp = new Date().toISOString();
    db.run(
        `INSERT INTO empire_financial_logs
         (module_source, revenue_generated, allocation_target, status, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [source, revenue, target, status, details, timestamp],
        (err) => {
            if (err) {
                console.error("[Database] Log error:", err.message);
            }
        }
    );
}

async function fetchLiveMarketData() {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd";
    const response = await fetch(url, { headers: { accept: "application/json" } });

    if (!response.ok) {
        throw new Error(`Market-data request failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data?.ethereum?.usd || !data?.bitcoin?.usd) {
        throw new Error("Market-data response is missing required prices");
    }

    return data;
}

async function runEmpireAutomationCycle() {
    console.log("\n==================================================");
    console.log("  F.R.I.D.A.Y. V2 — Autonomous Analysis Cycle");
    console.log("==================================================");

    try {
        const marketPrices = await fetchLiveMarketData();
        const eth = marketPrices.ethereum.usd;
        const btc = marketPrices.bitcoin.usd;

        console.log(`[Market Intel] ETH: $${eth} | BTC: $${btc}`);

        // V2 never invents revenue, orders, payments, trades, or profits.
        // Real financial integrations must report confirmed provider transactions.
        logEmpireActivity(
            "Market-Intelligence",
            0,
            "None",
            "ANALYSIS_ONLY",
            `Observed live ETH=$${eth} and BTC=$${btc}. No funds moved and no revenue was claimed.`
        );

        console.log("[Safety] Analysis completed. No simulated cash and no financial transaction executed.");
    } catch (error) {
        console.error(`[Empire Error] ${error.message}`);
        logEmpireActivity("System-Core", 0, "None", "FAILED", error.message);
    }
}

const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
}

http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: "friday-v2", mode: "analysis-only" }));
        return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
}).listen(PORT, () => {
    console.log(`[Server] Health endpoint listening on port ${PORT}`);
});

runEmpireAutomationCycle();
const INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(runEmpireAutomationCycle, INTERVAL_MS);
