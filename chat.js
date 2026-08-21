require("dotenv").config();
const readline = require("readline");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n==========================================");
console.log("[CCO Friday Interactive Chat Console]");
console.log("System operational. Type your message below (or 'exit' to quit):");
console.log("==========================================\n");

const chatSession = model.startChat({
    history: [
        {
            role: "user",
            parts: [{ text: "You are Friday, an elite executive AI assistant. Be concise, sharp, and helpful." }]
        },
        {
            role: "model",
            parts: [{ text: "Systems online, sir. How can I assist you today?" }]
        }
    ]
});

function promptUser() {
    rl.question("You > ", async (input) => {
        const text = input.trim();
        
        if (text.toLowerCase() === "exit") {
            console.log("\n[Friday]: Shutting down chat session. Good day, sir.");
            rl.close();
            process.exit(0);
        }

        if (text.length > 0) {
            try {
                const result = await chatSession.sendMessage(text);
                console.log(`\nFriday > ${result.response.text()}\n`);
            } catch (err) {
                console.error(`\n[Friday Error]: ${err.message}\n`);
            }
        }

        promptUser();
    });
}

promptUser();
