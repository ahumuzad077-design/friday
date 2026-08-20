require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");
const OpenAI = require("openai");
const readline = require("readline");
const puppeteer = require("puppeteer");

class FridayExecutiveAssistant {
  constructor() {
    this.roles = {
      CTO: "Chief Technology Officer - Satellite Telemetry & Hardware",
      CFO: "Chief Financial Officer - Web3, Wallet & Real Markets",
      COO: "Chief Operating Officer - Daily Briefings & Machine Learning",
      CCO: "Chief Communications Officer - Social Media & Broadcasting"
    };

    this.memoryRepoPath = "./memory_repo.json";
    this.memoryRepo = this.loadMemory();

    // Initialize Groq Client for massive capacity processing
    this.groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || "dummy_key",
      baseURL: 'https://api.groq.com/openai/v1'
    });

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
        content: "You are F.R.I.D.A.Y., a state-of-the-art C-suite Executive Assistant with satellite telemetry, browser automation, and tech intelligence capabilities." 
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

  getPrunedMemory() {
    if (this.memoryRepo.length <= 32) return this.memoryRepo;
    const systemPrompt = this.memoryRepo[0];
    const recentHistory = this.memoryRepo.slice(-30);
    return [systemPrompt, ...recentHistory];
  }

  // BROWSER & SATELLITE FEED LAUNCHER
  async openSatelliteFeed(targetType) {
    try {
      let feedUrl = "https://eyes.nasa.gov/"; // Default NASA Earth/Satellite live viewer
      
      const lower = targetType.toLowerCase();
      if (lower.includes("weather") || lower.includes("noaa")) {
        feedUrl = "https://www.star.nesdis.noaa.gov/GOES/fulldisk.php?sat=G16";
      } else if (lower.includes("iss") || lower.includes("space station")) {
        feedUrl = "https://spotthestation.nasa.gov/";
      } else if (lower.includes("earth")) {
        feedUrl = "https://earth.nullschool.net/";
      }

      console.log(`\n[F.R.I.D.A.Y. Telemetry Link: Opening live satellite feed -> ${feedUrl}]`);
      const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
      const page = await browser.newPage();
      await page.goto(feedUrl, { waitUntil: 'networkidle2' });
      return `Live satellite telemetry feed initialized on your screen, sir: ${feedUrl}`;
    } catch (error) {
      console.error("[!] Satellite Feed Error:", error.message);
      return `Telemetry link error: ${error.message}`;
    }
  }

  async processDirective(userInput) {
    this.memoryRepo.push({ role: "user", content: userInput });

    const lowerInput = userInput.toLowerCase();
    
    // Check if user is requesting satellite feeds or live tracking
    if (lowerInput.includes("satellite") || lowerInput.includes("nasa") || lowerInput.includes("earth feed") || lowerInput.includes("weather map")) {
      const feedResult = await this.openSatelliteFeed(userInput);
      this.memoryRepo.push({ role: "assistant", content: feedResult });
      this.saveMemory();
      return feedResult;
    }

    // General browser opening tool
    if (lowerInput.includes("open") || lowerInput.includes("navigate to")) {
      const urlMatch = userInput.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
        const page = await browser.newPage();
        await page.goto(urlMatch[0], { waitUntil: 'networkidle2' });
        const resMsg = `Opened ${urlMatch[0]} on your desktop screen, sir.`;
        this.memoryRepo.push({ role: "assistant", content: resMsg });
        this.saveMemory();
        return resMsg;
      }
    }

    try {
      console.log("\n[F.R.I.D.A.Y. processing via Groq LPU...]");
      
      const response = await this.groqClient.chat.completions.create({
        model: this.modelName,
        messages: this.getPrunedMemory(),
        max_tokens: 8192,
        reasoning_effort: "high",
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
    console.log("==================================================");
    console.log(" F.R.I.D.A.Y. C-Suite [Satellite & Browser OS]    ");
    console.log("==================================================");
    
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
