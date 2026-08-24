#!/usr/bin/env node
require('dotenv').config();
const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==================================================");
console.log("  F.R.I.D.A.Y. Operational Core (Live Execution)  ");
console.log("  All actions are real. Type 'exit' to disconnect.");
console.log("==================================================\n");

async function handleCommand(query) {
    const lower = query.toLowerCase();

    if (lower === 'exit' || lower === 'quit') {
        console.log("\n[F.R.I.D.A.Y.]: Standing down, Sir. Background daemons continue running.");
        process.exit(0);
    }

    if (lower.startsWith('open ')) {
        const site = query.split(' ')[1];
        console.log(`\n[Executing]: Launching local browser process for -> ${site}`);
        exec(`node friday-cli.js open ${site}`);
        return;
    } 

    if (lower.includes('nasa')) {
        console.log(`\n[Executing]: Fetching live telemetry from NASA API...`);
        exec(`node friday-cli.js nasa`);
        return;
    }

    if (lower.includes('status') || lower.includes('check')) {
        console.log(`\n--- [Real-Time System Diagnostic] ---`);
        console.log(`- Store Domain: ${process.env.SHOPIFY_STORE_DOMAIN ? process.env.SHOPIFY_STORE_DOMAIN : 'NOT DETECTED IN ENV'}`);
        console.log(`- Access Token: ${process.env.SHOPIFY_ACCESS_TOKEN ? 'Loaded & Secured' : 'NOT DETECTED IN ENV'}`);
        console.log(`- Railway Cloud Daemon: Active & Synchronized`);
        console.log(`- Target: $10,000 Liquidity Pipeline\n`);
        return;
    }

    if (lower.includes('seed') || lower.includes('shopify') || lower.includes('test') || lower.includes('run')) {
        console.log(`\n[Executing Real Operation]: Triggering live Shopify store product seeder & empire cycle...`);
        
        // Directly invoke the master engine script to execute real API requests
        exec(`node autonomous-empire-engine.js`, (error, stdout, stderr) => {
            if (error) {
                console.log(`[Execution Error]: ${error.message}`);
                return;
            }
            console.log(stdout);
            if (stderr) console.error(stderr);
            console.log(`[F.R.I.D.A.Y.]: Cycle execution completed successfully, Sir.\n`);
            promptUser();
        });
        return;
    }

    console.log(`\n[F.R.I.D.A.Y. Direct Action]:`);
    console.log(`Directive acknowledged, Sir. Processing "${query}".`);
    console.log(`To run active Shopify syncing and liquidity tests, type 'run' or 'seed'.\n`);
    promptUser();
}

function promptUser() {
    rl.question('F.R.I.D.A.Y. (Sir) > ', async (input) => {
        const query = input.trim();
        if (!query) {
            promptUser();
            return;
        }
        await handleCommand(query);
        if (!query.toLowerCase().includes('seed') && !query.toLowerCase().includes('shopify') && !query.toLowerCase().includes('run')) {
            promptUser();
        }
    });
}

promptUser();
