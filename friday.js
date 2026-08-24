// F.R.I.D.A.Y. Autonomous Shopify Navigator Core
require('dotenv').config();
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const STATE_FILE = path.join(__dirname, 'friday-state.json');
const LOG_FILE = path.join(__dirname, 'friday-activity.log');

let state = {
    checkCount: 0,
    lastAction: "Core initialized with token-based store navigation."
};

if (fs.existsSync(STATE_FILE)) {
    try {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {}
}

function saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function logActivity(action, details) {
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${action}: ${details}\n`);
    } catch (e) {}
}

function speak(text) {
    console.log(`\n[F.R.I.D.A.Y.]: "${text}"`);
    logActivity('VOICE_OUTPUT', text);
    
    if (process.platform === 'win32') {
        const escaped = text.replace(/"/g, '`"');
        const psScript = `
            Add-Type -AssemblyName System.Speech;
            $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
            $voice = $synth.GetInstalledVoices() | Where-Object { 
                $_.VoiceInfo.Gender -eq 'Female' -and ($_.VoiceInfo.Culture -like 'en-GB*' -or $_.VoiceInfo.Culture -like 'en-IE*' -or $_.VoiceInfo.Name -like '*Zira*') 
            } | Select-Object -First 1;
            if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name); }
            $synth.Speak('${escaped}');
        `;
        exec(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, () => {});
    }
}

// Function where the token guides navigation into the store backend
function navigateStore(callback) {
    const token = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_API_KEY;
    const explicitDomain = process.env.SHOPIFY_STORE_DOMAIN;

    if (!token) {
        callback(false, "No Shopify access token detected in backend configuration.");
        return;
    }

    // If a domain isn't explicitly provided, we can infer it or prompt for it, 
    // but if your token/app is linked to a specific store endpoint, we test common patterns or use the domain.
    if (!explicitDomain || explicitDomain === 'your-store.myshopify.com') {
        callback(false, "Please ensure your store domain (e.g. your-store.myshopify.com) and token are both set so I can navigate directly.");
        return;
    }

    const options = {
        hostname: explicitDomain,
        path: '/admin/api/2024-01/shop.json',
        method: 'GET',
        headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    callback(true, `Successfully navigated to store: "${json.shop.name}" (${json.shop.domain}). Currency: ${json.shop.currency}`);
                } catch (e) {
                    callback(true, "Successfully connected via token, but encountered parsing anomaly.");
                }
            } else {
                callback(false, `Store navigation failed with status code ${res.statusCode}. Check your token permissions.`);
            }
        });
    });

    req.on('error', (e) => {
        callback(false, `Navigation network error: ${e.message}`);
    });

    req.end();
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==================================================");
console.log("  F.R.I.D.A.Y. - STORE NAVIGATION PROTOCOL        ");
console.log("  Status: Token authentication active.            ");
console.log("==================================================\n");

function handleCommand(query) {
    const lower = query.toLowerCase();

    if (lower === 'exit' || lower === 'quit') {
        speak("Standing down, Sir.");
        process.exit(0);
    }

    state.checkCount++;
    logActivity('DIRECTIVE', query);

    console.log(`\n[F.R.I.D.A.Y. Telemetry (Check #${state.checkCount})]:`);

    if (lower.includes('status') || lower.includes('navigate') || lower.includes('explore') || lower.includes('start') || lower.includes('run')) {
        console.log(`- Utilizing token to navigate store backend...`);
        navigateStore((success, message) => {
            console.log(`- Result: ${message}`);
            speak(success ? "Store navigation successful, Sir. I have eyes on the backend." : "Navigation check failed, Sir. Verify your configuration.");
            saveState();
            promptUser();
        });
        return;
    } else {
        console.log(`- Directive logged: "${query}"`);
        speak("Command received, Sir. Working on it.");
    }

    saveState();
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
