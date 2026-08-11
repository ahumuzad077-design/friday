import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("==========================================");
console.log("  F.R.I.D.A.Y. Terminal Interface Active");
console.log("  Type 'exit' to end the conversation.");
console.log("==========================================");

const promptUser = () => {
  rl.question('\nYou: ', (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      console.log('F.R.I.D.A.Y.: Goodbye! Shutting down system.');
      rl.close();
      return;
    }

    // Basic response logic (can be connected to your AI backend/API later)
    console.log(`F.R.I.D.A.Y.: Processing request for: "${input}"`);
    
    promptUser();
  });
};

promptUser();
