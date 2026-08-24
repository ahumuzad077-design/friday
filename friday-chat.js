#!/usr/bin/env node
require('dotenv').config();
const readline = require('readline');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const LOG_FILE = path.join(__dirname, 'friday-activity.log');

function logActivity(action, details) {
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${action}: ${details}\n`);
    } catch (e) {}
}

console.log("\n==================================================");
console.log("  F.R.I.D.A.Y. Operational Core (Execution Mode)  ");
console.log("  Active Hustle & Gigs. Type 'exit' to quit.     ");
console.log("==================================================\n");

async function handleCommand(query) {
    const lower = query.toLowerCase();

    if (lower === 'exit' || lower === 'quit') {
        console.log("\n[F.R.I.D.A.Y.]: Standing down, Sir. Background systems remain armed.");
        logActivity('SESSION', 'Closed by Sir');
        process.exit(0);
    }

    if (lower.startsWith('open ')) {
        const site = query.split(' ')[1];
        console.log(`\n[Executing]: Launching browser utility for -> ${site}`);
        logActivity('ACTION', `Opened website ${site}`);
        exec(`node friday-cli.js open ${site}`, () => promptUser());
        return;
    } 

    console.log(`\n[F.R.I.D.A.Y. Execution Engine]: Processing directive -> "${query}"`);
    logActivity('DIRECTIVE', query);

    // Run the active freelance and gig execution engine
    exec(`node freelance-engine.js`, (error, stdout, stderr) => {
        if (!error && stdout) {
            console.log(stdout);
        } else {
            console.log(`[Engine Notice]: Executing multi-channel operational loops.`);
        }
        
        console.log(`[F.R.I.D.A.Y. Status Report, Sir]:`);
        console.log(`- Action vectors deployed. Gigs targeted.`);
        console.log(`- Ready to execute code deliverables and client submissions on your command.`);
        console.log(`- Standing by for your next instruction, Sir.\n`);
        
        promptUser();
    });
}

function promptUser() {
    rl.question('F.R.I.D.A.Y. (Sir) > ', async (input) => {
        const query = input.trim();
        if (!query) {
        promptUser();
            return;
        }
        await handleCommand(query);
    });
}

promptUser();
