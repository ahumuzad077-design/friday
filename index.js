require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { chromium } = require("playwright");

// ============================================================================
// 1. SELF-LEARNING & REFLECTION ENGINE
// ============================================================================
class FridayLearningCore {
    constructor(model) {
        this.model = model;
        this.memoryFilePath = path.join(__dirname, "friday_lessons.json");
        this.lessons = this.loadLessons();
    }

    loadLessons() {
        if (fs.existsSync(this.memoryFilePath)) {
            try {
                return JSON.parse(fs.readFileSync(this.memoryFilePath, "utf8"));
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    saveLesson(taskType, mistake, correction) {
        const lesson = {
            id: Date.now(),
            taskType,
            mistake,
            correction,
            date: new Date().toISOString()
        };
        this.lessons.push(lesson);
        fs.writeFileSync(this.memoryFilePath, JSON.stringify(this.lessons, null, 2));
        console.log(`[Friday Brain Learned]: New lesson stored for task '${taskType}'.`);
    }

    getRelevantLessons(taskType) {
        return this.lessons
            .filter(l => l.taskType === taskType)
            .map(l => `- Avoid: ${l.mistake} | Strategy: ${l.correction}`)
            .join("\n");
    }

    async executeSmartTask(taskType, taskPrompt) {
        const pastLessons = this.getRelevantLessons(taskType);
        const contextualPrompt = `
You are Friday, an autonomous self-improving AI assistant.
TASK: ${taskPrompt}

${pastLessons ? `PAST LESSONS & CORRECTIONS TO APPLY:\n${pastLessons}\n` : ""}
Execute the task efficiently avoiding previous mistakes.
        `;

        try {
            console.log(`\n[Friday Brain]: Executing smart task '${taskType}'...`);
            const result = await this.model.generateContent(contextualPrompt);
            const output = result.response.text();

            await this.reflectOnOutput(taskType, taskPrompt, output);
            return output;
        } catch (error) {
            console.error(`[Smart Task Error]:`, error.message);
            this.saveLesson(taskType, error.message, "Handle network and execution errors gracefully.");
        }
    }

    async reflectOnOutput(taskType, originalPrompt, output) {
        const reflectionPrompt = `
Analyze this output for quality, accuracy, and completeness:
ORIGINAL TASK: ${originalPrompt}
OUTPUT: ${output}

Did this output succeed? Reply strictly in JSON format:
{"success": true/false, "weakness": "description if any", "improvement": "how to improve"}
        `;

        try {
            const evalResult = await this.model.generateContent(reflectionPrompt);
            const text = evalResult.response.text();
            const cleanJson = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
            const evaluation = JSON.parse(cleanJson);

            if (!evaluation.success) {
                console.log(`[Friday Reflection]: Identified area for growth in '${taskType}'.`);
                this.saveLesson(taskType, evaluation.weakness, evaluation.improvement);
            } else {
                console.log(`[Friday Reflection]: Execution validated successfully for '${taskType}'.`);
            }
        } catch (e) {
            // Memory write bypass if JSON parsing fails
        }
    }
}

// ============================================================================
// 2. PERSISTENT BROWSER & MULTI-TAB CONTROLLER
// ============================================================================
class FridayTabController {
    constructor() {
        this.context = null;
        this.tabs = new Map();
    }

    async initBrowser(headless = true) {
        const userDataDir = path.join(__dirname, "browser_user_data");
        console.log("[Tab Engine]: Launching persistent browser context...");
        this.context = await chromium.launchPersistentContext(userDataDir, {
            headless: headless,
            viewport: { width: 1280, height: 720 },
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        console.log("[Tab Engine]: Browser context initialized with saved session data.");
    }

    async openTab(tabName, url) {
        if (!this.context) await this.initBrowser(true);
        console.log(`[Tab Engine]: Opening tab '${tabName}' -> ${url}`);
        const page = await this.context.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        this.tabs.set(tabName, page);
        return page;
    }

    getTab(tabName) {
        return this.tabs.get(tabName);
    }

    async closeTab(tabName) {
        if (this.tabs.has(tabName)) {
            await this.tabs.get(tabName).close();
            this.tabs.delete(tabName);
            console.log(`[Tab Engine]: Closed tab '${tabName}'`);
        }
    }

    async manageSocialMediaCampaign(platform, postText) {
        try {
            if (platform.toLowerCase() === "x" || platform.toLowerCase() === "twitter") {
                const page = await this.openTab("twitter", "https://x.com/compose/post");
                console.log("[Social Worker]: Preparing post on X/Twitter...");
                await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 8000 });
                await page.fill('[data-testid="tweetTextarea_0"]', postText);
                console.log("[Social Worker]: Post drafted successfully.");
            } else if (platform.toLowerCase() === "facebook_ads") {
                await this.openTab("fb_ads", "https://adsmanager.facebook.com");
                console.log("[Ads Worker]: Monitoring Meta Ads Dashboard...");
            }
        } catch (err) {
            console.error(`[Social Engine Error on ${platform}]:`, err.message);
        }
    }

    async shutdown() {
        if (this.context) {
            await this.context.close();
            console.log("[Tab Engine]: Browser shut down safely.");
        }
    }
}

// ============================================================================
// 3. MASTER FRIDAY ENGINE & WORKERS
// ============================================================================
class FridayMasterEngine {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "DUMMY_KEY");
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.learningCore = new FridayLearningCore(this.model);
        this.tabController = new FridayTabController();
        this.alertTopicUrl = "https://ntfy.sh/uDIwSEpOqpUV6Hr4";
        this.memory = [];
    }

    // --- MEMORY & NOTIFICATIONS ---
    saveToMemory(logEntry) {
        const entry = `[${new Date().toISOString()}] ${logEntry}`;
        this.memory.push(entry);
        console.log(`[Memory Saved]: ${logEntry}`);
    }

    async notifyOwner(title, message, priority = "default") {
        try {
            await axios.post(this.alertTopicUrl, message, {
                headers: { Title: title, Priority: priority }
            });
            console.log(`[Alert Sent]: ${title} -> ${message}`);
        } catch (err) {
            console.error("[Alert Error]: Push notification failed.", err.message);
        }
    }

    // --- OPENSEA NFT & ARTWORK WORKER ---
    async fetchNFTCollectionStats(collectionSlug) {
        console.log(`\n[NFT Worker]: Fetching metrics for: ${collectionSlug}...`);
        try {
            if (!process.env.OPENSEA_API_KEY) {
                console.log("[NFT Worker]: OPENSEA_API_KEY missing in .env. Running in simulated mode.");
                return { slug: collectionSlug, floorPriceETH: "0.45" };
            }

            const response = await axios.get(`https://api.opensea.io/api/v2/collections/${collectionSlug}/stats`, {
                headers: { "x-api-key": process.env.OPENSEA_API_KEY }
            });

            const stats = response.data.total;
            console.log(`[NFT Worker Success]: Collection ${collectionSlug} | Floor: ${stats.floor_price} ETH`);
            this.saveToMemory(`NFT Check: ${collectionSlug} Floor = ${stats.floor_price} ETH`);
            return stats;
        } catch (err) {
            console.error("[NFT Worker Error]:", err.response?.data || err.message);
        }
    }

    // --- FREELANCE & DIGITAL CONTENT WORKER ---
    async generateDigitalProductOrArticle(topic, clientTaskType = "blog_post") {
        const taskPrompt = `Generate a high-quality, professional ${clientTaskType} on the subject: "${topic}".`;
        const output = await this.learningCore.executeSmartTask("freelance_content", taskPrompt);

        if (output) {
            console.log(`\n[Digital Work Output Preview]:\n--------------------------------\n${output.substring(0, 250)}...\n--------------------------------`);
            this.saveToMemory(`Completed ${clientTaskType} on: ${topic}`);
            await this.notifyOwner("Digital Job Complete", `Finished ${clientTaskType} task on "${topic}".`, "high");
        }
        return output;
    }

    // --- PLAYWRIGHT WEB PRODUCT SOURCING ---
    async searchAndBuyProduct(itemQuery, maxBudgetUSD) {
        console.log(`\n[Web Sourcing]: Searching for "${itemQuery}" under $${maxBudgetUSD}...`);
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        try {
            const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(itemQuery)}&_sop=15`;
            await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

            const title = await page.locator(".s-item__title").nth(1).innerText();
            const price = await page.locator(".s-item__price").nth(1).innerText();

            console.log(`[Sourcing Found]: ${title} | Price: ${price}`);
            this.saveToMemory(`Sourced item "${title}" at ${price}`);
            await this.notifyOwner("Item Sourced", `Found "${title}" at ${price}`, "high");

        } catch (error) {
            console.error("[Sourcing Error]: Navigation failed.", error.message);
        } finally {
            await browser.close();
        }
    }

    // --- E-COMMERCE & SHOPIFY OPS ---
    async syncECommerceOrders() {
        console.log("\n[E-Commerce Ops]: Checking store orders...");
        try {
            if (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
                const url = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/orders.json?status=unfulfilled`;
                const res = await axios.get(url, {
                    headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN }
                });
                console.log(`[Shopify Ops]: Found ${res.data.orders?.length || 0} unfulfilled order(s).`);
            } else {
                console.log("[Shopify Ops]: Shopify credentials pending in .env (Simulated Check).");
            }
        } catch (err) {
            console.error("[E-Commerce Error]:", err.message);
        }
    }

    // --- FINANCIAL / ALPACA PAPER TRADING CHECK ---
    async checkTradingAccount() {
        console.log("\n[Finance Engine]: Checking Alpaca Account...");
        if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_SECRET_KEY) {
            console.log("[Finance Engine]: Alpaca keys missing in .env. Skipping live account check.");
            return;
        }

        try {
            const res = await axios.get("https://paper-api.alpaca.markets/v2/account", {
                headers: {
                    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY,
                    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY
                }
            });
            console.log(`[Alpaca Account]: Cash: $${res.data.cash} | Buying Power: $${res.data.buying_power}`);
        } catch (err) {
            console.error("[Finance Engine Error]:", err.response?.data || err.message);
        }
    }

    // --- MASTER WORKER CONTROL LOOP ---
    async startAutonomousWorker(intervalMinutes = 10) {
        await this.notifyOwner("Friday Master Engine Online", "All systems operational.", "default");
        console.log(`\n================================================================`);
        console.log(`=== FRIDAY MASTER AUTONOMOUS ENGINE ACTIVE (${intervalMinutes}m cycle) ===`);
        console.log(`================================================================\n`);

        const runCycle = async () => {
            console.log(`\n--- Autonomous Cycle Started: ${new Date().toLocaleTimeString()} ---`);
            
            await this.fetchNFTCollectionStats("boredapeyachtclub");
            await this.syncECommerceOrders();
            await this.checkTradingAccount();
            
            console.log("\n--- Autonomous Cycle Complete. Sleeping... ---");
        };

        await runCycle();
        setInterval(runCycle, intervalMinutes * 60 * 1000);
    }
}

// ============================================================================
// 4. EXECUTION ENTRY POINT
// ============================================================================
async function main() {
    const Friday = new FridayMasterEngine();

    // 1. Generate digital freelance work (with self-learning loop)
    await Friday.generateDigitalProductOrArticle("Top AI Automation Tools in 2026", "blog_post");

    // 2. Run Playwright product search
    await Friday.searchAndBuyProduct("minimalist wallet", 25);

    // 3. Start background autonomous cycle (runs every 10 minutes)
    await Friday.startAutonomousWorker(10);
}

main();
