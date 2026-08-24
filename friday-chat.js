#!/usr/bin/env node
const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==================================================");
console.log("  F.R.I.D.A.Y. Interactive Terminal Chat Online   ");
console.log("  Type your commands or goals. Type 'exit' to quit.");
console.log("==================================================\n");

function askQuestion() {
    rl.question('F.R.I.D.A.Y. > ', (input) => {
        const query = input.trim();

        if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
            console.log("[F.R.I.D.A.Y.]: Session closed. Operating background daemons remain active, Sir.");
            rl.close();
            return;
        }

        if (query.toLowerCase().startsWith('open ')) {
            const site = query.split(' ')[1];
            console.log(`[F.R.I.D.A.Y.]: Launching website -> ${site}`);
            exec(`node friday-cli.js open ${site}`);
        } 
        else if (query.toLowerCase().includes('nasa')) {
            exec(`node friday-cli.js nasa`);
        }
        else if (query.toLowerCase().includes('search ')) {
            const term = query.substring(7);
            exec(`node friday-cli.js search "${term}"`);
        }
        else {
            console.log(`[F.R.I.D.A.Y.]: Received directive: "${query}". Processing strategy against Shopify store integration, Web3 allocation, and adaptive liquidity engine...`);
            console.log(`[F.R.I.D.A.Y. Status]: All background systems nominal. Target $10,000 weekly test pipeline is active.`);
        }

        console.log(""); // spacing
        askQuestion();
    });
}

askQuestion();
