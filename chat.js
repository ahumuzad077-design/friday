require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");
const OpenAI = require("openai");
const readline = require("readline");

class FridayExecutiveAssistant {
  constructor() {
    this.roles = {
      CTO: "Chief Technology Officer - Infrastructure, Hardware & NASA Intel",
      CFO: "Chief Financial Officer - Web3, Wallet & Real Markets",
      COO: "Chief Operating Officer - Daily Briefings & Machine Learning",
      CCO: "Chief Communications Officer - Ntfy Broadcasts & Advertising"
    };

    this.memoryRepoPath = "./memory_repo.json";
    this.memoryRepo = this.loadMemory();

    // Initialize Groq Client for massive capacity processing
    this.groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || "dummy_key",
      baseURL: 'https://api.groq.com/openai/v1'
    });

    // Configured to Groq's highest intelligence & capacity model tier
    this.modelName = "openai/gpt-oss-120b"; 

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  loadMemory() {
    try {
      if (fs.existsSync(this.memoryRepoPath)) {
        const data = fs.readFileSync(this.memoryRepoPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("[!] Warning: Could not load memory repo. Initializing fresh buffer.");
    }
    return [
      { 
        role: "system", 
        content: "You are F.R.I.D.A.Y., a state-of-the-art C-suite Executive Assistant operating on Groq's high-intelligence LPU infrastructure. Execute orders with high precision, speed, and technical depth." 
      }
    ];
  }

  saveMemory() {
    try {
      fs.writeFileSync(this.memoryRepoPath, JSON.stringify(this.memoryRepo, null, 2));
    } catch (error) {
      console.error("[!] Critical: Failed to write persistent memory repository.");
    }
  }

  // Sliding window memory buffer to prevent mobile/desktop RAM bloat
  getPrunedMemory() {
    if (this.memoryRepo.length <= 32) return this.memoryRepo;
    const systemPrompt = this.memoryRepo[0];
    const recentHistory = this.memoryRepo.slice(-30);
    return [systemPrompt, ...recentHistory];
  }

  async processDirective(userInput) {
    this.memoryRepo.push({ role: "user", content: userInput });

    try {
      console.log("\n[F.R.I.D.A.Y. processing via Groq LPU...]");
      
      const response = await this.groqClient.chat.completions.create({
        model: this.modelName,
        messages: this.getPrunedMemory(),
        max_tokens: 8192,         // Max output ceiling for code and financial ledgers
        reasoning_effort: "high", // Unlocks maximum architectural reasoning logic
        temperature: 0.6
      });

      const reply = response.choices[0].message.content;
      this.memoryRepo.push({ role: "assistant", content: reply });
      this.saveMemory();

      return reply;
    } catch (error) {
      console.error("[!] Groq Inference Error:", error.message);
      return "Systems experiencing high data volume, sir. Standing by for network stabilization.";
    }
  }

  startCLI() {
    console.log("==========================================");
    console.log(" F.R.I.D.A.Y. C-Suite OS [Top Tier Engine] ");
    console.log("==========================================");
    
    const askQuestion = () => {
      this.rl.question("\nSir > ", async (input) => {
        if (input.toLowerCase() === "exit") {
          console.log("F.R.I.D.A.Y. going offline. Saving state.");
          this.rl.close();
          return;
        }
        
        const response = await this.processDirective(input);
        console.log(`\nF.R.I.D.A.Y. >\n${response}`);
        askQuestion();
      });
    };

    askQuestion();
  }
}

if (require.main === module) {
  const friday = new FridayExecutiveAssistant();
  friday.startCLI();
}

module.exports = FridayExecutiveAssistant;
