import * as readline from 'readline';
import { trader } from './trading';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("🤖 F.R.I.D.A.Y. CLI Initialized. Type 'help' for commands or 'exit' to quit.\n");

function promptUser() {
    rl.question('F.R.I.D.A.Y.> ', async (input) => {
        const command = input.trim().toLowerCase();

        if (command === 'exit') {
            console.log('Goodbye!');
            rl.close();
            return;
        }

        switch (command) {
            case 'market':
                console.log('Fetching live market metrics...');
                const metrics = await trader.fetchMarketStatus();
                console.table(metrics);
                break;

            case 'positions':
                const positions = trader.getActivePositions();
                console.log('Active Positions:', positions.length ? positions : 'None');
                break;

            case 'help':
                console.log('Available commands:');
                console.log('  market    - Fetch live crypto market prices');
                console.log('  positions - View active trade orders');
                console.log('  exit      - Close the assistant');
                break;

            default:
                console.log(`Unknown command: "${input}". Type 'help' for options.`);
        }

        console.log('');
        promptUser();
    });
}

promptUser();
