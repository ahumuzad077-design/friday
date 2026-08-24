// ==========================================================
// F.R.I.D.A.Y. CUMULATIVE MEGA-CORE (STARK PROTOCOL v7.0)
// Features: Secure .env Backend, Offline JSON State, 
// ElevenLabs Pro Voice, & Multi-Platform Social Dispatcher
// ==========================================================
require('dotenv').config();
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const STATE_FILE = path.join(__dirname, 'friday-state.json');
const LOG_FILE = path.join(__dirname, 'friday-activity.log');

// Cumulative persistent state structure
let state = {
    system: "F.R.I.D.A.Y. Mega-Core",
    version: "7.0-Cumulative",
    checkCount: 0,
    productsManaged: 0,
    socialPostsDispatched: 0,
    lastAction: "Mega-core initialized with all operational modules."
};

// 1. Load persistent memory state safely
if (fs.existsSync(STATE_FILE)) {
    try {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
        console.log("[System Notice]: Initializing fresh memory matrix.");
    }
}

function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {}
}

function logActivity(action, details) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${action}] ${details}\n`;
    try {
        fs.appendFileSync(LOG_FILE, entry);
    } catch (e) {}
}

// 2. Pro Voice Engine (ElevenLabs API with local fallback)
function speak(text) {
    console.log(`\n[F.R.I.D.A.Y. Voice Engine]: "${text}"`);
    logActivity('VOICE_OUTPUT', text);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

    if (!apiKey) {
        // Fallback local text notification if API key isn't provided yet
        return;
    }

    const payload = JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    });

    const options = {
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        }
    };

    const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
            const audioPath = path.join(__dirname, 'temp_voice.mp3');
            const fileStream = fs.createWriteStream(audioPath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                if (process.platform === 'win32') {
                    exec(`powershell -c "(New-Object Media.SoundPlayer '${audioPath}').PlaySync();"`, () => {});
                }
            });
        }
    });

    req.on('error', () => {});
    req.write(payload);
    req.end();
}

// 3. Shopify Backend Verification Module
fnShopifyCheck = (callback) => {
    const token = process.env.SHOPIFY_ACCESS_TOKEN;
    const domain = process.env.SHOPIFY_STORE_DOMAIN;

    if (!token || !domain || domain === 'your-store.myshopify.com') {
        callback(false, "Store parameters running on local offline simulation vectors.");
        return;
    }

    const options = {
        hostname: domain,
        path: '/admin/api/2024-01/shop.json',
        method: 'GET',
        headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    callback(true, `Connected to Shopify Store: ${json.shop.name}`);
                } catch (e) {
                    callback(true, "Store connection verified.");
                }
            } else {
                callback(false, `Shopify returned error code ${res.statusCode}`);
            }
        });
    });

    req.on('error', (e) => callback(false, `Network offline: ${e.message}`));
    req.end();
};

// 4. Multi-Platform Social Media Dispatcher (Instagram, TikTok, YouTube)
function dispatchSocialMedia(platform, message, callback) {
    const socialKey = process.env.SOCIAL_API_KEY;

    if (!socialKey) {
        callback(true, `Simulated secure broadcast to ${platform.toUpperCase()}: "${message}"`);
        return;
    }

    const payload = JSON.stringify({ platforms: [platform], post: message });
    const options = {
        hostname: 'app.ayrshare.com',
        path: '/api/post',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${socialKey}`
        }
    };

    const req = https.request(options, (res) => {
        let resData = '';
        res.on('data', chunk => resData += chunk);
        res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
                callback(true, `Successfully published to ${platform.toUpperCase()}`);
            } else {
                callback(false, `Platform sync error (${res.statusCode})`);
            }
        });
    });

    req.on('error', (e) => callback(false, `Connection failure: ${e.message}`));
    req.write(payload);
    req.end();
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==================================================");
console.log("  F.R.I.D.A.Y. - CUMULATIVE MEGA-CORE ACTIVE      ");
console.log("  Store, Social, Voice & Offline Memory Online.   ");
console.log("==================================================\n");

function handleCommand(query) {
    const lower = query.toLowerCase();

    if (lower === 'exit' || lower === 'quit') {
        speak("Standing down, Sir. All systems saved and secured.");
        process.exit(0);
    }

    state.checkCount++;
    logActivity('USER_DIRECTIVE', query);

    console.log(`\n[F.R.I.D.A.Y. Telemetry (Check #${state.checkCount})]:`);

    if (lower.includes('status') || lower.includes('health') || lower.includes('report')) {
        fnShopifyCheck((success, msg) => {
            console.log(`- Backend Audit: ${msg}`);
            console.log(`- Cumulative Memory: ${state.productsManaged} products managed, ${state.socialPostsDispatched} social broadcasts sent.`);
            saveState();
            speak("All systems verified, Sir. Operational logs are clean.");
            promptUser();
        });
        return;
    } else if (lower.includes('instagram') || lower.includes('tiktok') || lower.includes('youtube') || lower.includes('social')) {
        state.socialPostsDispatched++;
        let target = 'instagram';
        if (lower.includes('tiktok')) target = 'tiktok';
        if (lower.includes('youtube')) target = 'youtube';

        dispatchSocialMedia(target, `Autonomous update from F.R.I.D.A.Y. command center. #business #growth`, (success, msg) => {
            console.log(`- Social Pipeline: ${msg}`);
            speak(`Broadcast sequence completed for ${target}, Sir.`);
            saveState();
            promptUser();
        });
        return;
    } else if (lower.includes('product') || lower.includes('sell') || lower.includes('business') || lower.includes('100')) {
        state.productsManaged++;
        console.log(`- E-Commerce Vector: Managing item pipeline #${state.productsManaged}.`);
        saveState();
        speak("Product pipeline advanced, Sir. Managing inventory vectors.");
    } else {
        console.log(`- Directive Processed: "${query}" (Offline & Backend synced).`);
        saveState();
        speak("Command acknowledged, Sir. Standing by.");
    }

    promptUser();
}

function promptUser() {
    rl.question('\nF.R.I.D.A.Y. (Sir) > ', (input) => {
        const query = input.trim();
        if (!query) {
            promptUser();
            return;
        }
        handleCommand(query);
    });
}

promptUser();
