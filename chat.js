require("dotenv").config();
const readline = require("readline");
const OpenAI = require("openai");

// Initialize Groq client using your environment variables
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==========================================");
console.log("  F.R.I.D.A.Y. Interactive Chat Console");
console.log("  Engine: Groq LPU (llama-3.3-70b-versatile)");
console.log("  Type your message below (or type 'exit' to quit):");
console.log("==========================================\n");

const conversationHistory = [
    { 
        role: "system", 
        content: "You are F.R.I.D.A.Y., Tony Stark's elite autonomous AI assistant. Be sharp, concise, witty, and ready to assist with code, Web3, and system operations." 
    }
];

function startChat() {
    rl.question("You > ", async (input) => {
        const text = input.trim();
        
        if (text.toLowerCase() === "exit") {
            console.log("\nF.R.I.D.A.Y.: Shutting down chat session. Have a good day, sir.");
            rl.close();
            process.exit(0);
        }

        if (text.length > 0) {
            try {
                conversationHistory.push({ role: "user", content: text });

                const response = await groqClient.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: conversationHistory,
                });

                const reply = response.choices[0].message.content;
                conversationHistory.push({ role: "assistant", content: reply });

                console.log(`\nFriday > ${reply}\n`);
            } catch (err) {
                console.error(`\n[Friday Error]: ${err.message}\n`);
            }
        }
        
        startChat();
    });
}

startChat();
