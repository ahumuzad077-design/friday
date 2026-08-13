require('dotenv/config');
const OpenAI = require('openai');
const { exec } = require('child_process');
const util = require('util');
const si = require('systeminformation');
const readline = require('readline');

const execPromise = util.promisify(exec);

// Initialize OpenAI client pointing to Groq's Free API
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
// 🔊 F.R.I.D.A.Y. Female Voice Synthesizer
function speak(text) {
  const safeText = text.replace(/["'\r\n]/g, " ");
  const psCommand = `
    Add-Type -AssemblyName System.Speech;
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
    $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
    $synth.Rate = 1;
    $synth.Volume = 100;
    $synth.Speak('${safeText}');
  `;

  exec(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, (err) => {
    if (err) console.error("Speech Error:", err.message);
  });
}

// 1. Define F.R.I.D.A.Y.'s Capabilities & C-Suite Executive Tools
const tools = [
  {
    type: "function",
    function: {
      name: "runPowerShell",
      description: "Executes a PowerShell command on the Windows PC to manage files, apps, or settings.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The PowerShell command to execute." },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSystemStats",
      description: "Retrieves real-time CPU, RAM, and battery statistics of the PC.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateCFOFinancials",
      description: "CFO Tool: Calculates ROI, profit margins, revenue forecasts, or breakeven points.",
      parameters: {
        type: "object",
        properties: {
          revenue: { type: "number", description: "Total projected revenue" },
          costs: { type: "number", description: "Total fixed + variable costs" },
        },
        required: ["revenue", "costs"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generateAdCampaign",
      description: "CMO Tool: Generates an advertising campaign strategy and ad copy for a given product or service.",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "Name of the product or service" },
          targetAudience: { type: "string", description: "Target demographic" },
          platform: { type: "string", description: "Platform (e.g., Facebook Ads, Google Ads, TikTok)" },
        },
        required: ["productName", "targetAudience"],
      },
    },
  }
];

// 2. Tool Execution Logic
async function executeTool(name, args) {
  if (name === "runPowerShell") {
    try {
      const { stdout, stderr } = await execPromise(`powershell -Command "${args.command}"`);
      return stdout || stderr || "Command executed successfully.";
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  if (name === "getSystemStats") {
    try {
      const cpu = await si.currentLoad();
      const mem = await si.mem();
      const battery = await si.battery();
      return JSON.stringify({
        cpuLoad: `${Math.round(cpu.currentLoad)}%`,
        freeMemory: `${Math.round(mem.available / 1024 / 1024 / 1024)}GB`,
        totalMemory: `${Math.round(mem.total / 1024 / 1024 / 1024)}GB`,
        batteryPercent: battery.hasBattery ? `${battery.percent}%` : "Desktop / No battery",
      });
    } catch (error) {
      return "Failed to retrieve system stats.";
    }
  }

  if (name === "calculateCFOFinancials") {
    const profit = args.revenue - args.costs;
    const margin = args.revenue > 0 ? ((profit / args.revenue) * 100).toFixed(2) : 0;
    const roi = args.costs > 0 ? ((profit / args.costs) * 100).toFixed(2) : 0;
    return JSON.stringify({
      netProfit: `$${profit.toLocaleString()}`,
      profitMargin: `${margin}%`,
      ROI: `${roi}%`,
      status: profit >= 0 ? "Profitable" : "Operating at a Loss"
    });
  }

  if (name === "generateAdCampaign") {
    return `Campaign blueprint generated for ${args.productName} targeting ${args.targetAudience} on ${args.platform || 'Multi-platform'}. Ready for review.`;
  }

  return "Unknown tool";
}

// 3. Interactive CLI Chat Loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const conversationHistory = [
  { 
    role: "system", 
    content: `You are F.R.I.D.A.Y., Tony Stark's AI assistant running locally on a Windows PC. You are equipped with a full C-Suite Executive Suite: - CFO: Chief Financial Officer (Financial analysis, margins, pricing strategy) - CMO: Chief Marketing & Advertising Officer (Campaign creation, branding, ad copy) - Sales Director: Sales strategy, lead conversion, objection handling - COO / CTO: Technical operations, PowerShell execution, and system diagnostics When answering, adopt the appropriate C-Suite executive persona when relevant, or act as the master overseer (F.R.I.D.A.Y.). Keep responses concise, direct, professional, witty, and ready for spoken audio.` 
  }
];

async function askFriday(userInput) {
  conversationHistory.push({ role: "user", content: userInput });

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: conversationHistory,
    tools: tools,
    tool_choice: "auto",
  });

  const responseMessage = response.choices[0].message;

  if (responseMessage.tool_calls) {
    conversationHistory.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      console.log(`🤖 F.R.I.D.A.Y. Protocol Executing: [${toolCall.function.name}]...`);
      
      const functionArgs = Object.keys(toolCall.function.arguments).length > 0 
        ? JSON.parse(toolCall.function.arguments) 
        : {};
        
      const toolResult = await executeTool(toolCall.function.name, functionArgs);

      conversationHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }

    const finalResponse = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: conversationHistory,
    });

    const reply = finalResponse.choices[0].message.content;
    conversationHistory.push({ role: "assistant", content: reply });

    speak(reply);
    return reply;
  }

  const reply = responseMessage.content;
  conversationHistory.push(responseMessage);

  speak(reply);
  return reply;
}

console.log("=================================================");
console.log("  F.R.I.D.A.Y. C-Suite Protocol Active (Voice Enabled)");
console.log("  Bluetooth Output: Connected");
console.log("  Type 'exit' to end the session.");
console.log("=================================================");

const promptUser = () => {
  rl.question('\nYou: ', async (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      const shutdownMsg = "Goodbye, boss. Shutting down all C-suite protocols.";
      console.log(`F.R.I.D.A.Y.: ${shutdownMsg}`);
      speak(shutdownMsg);
      setTimeout(() => { rl.close(); process.exit(0); }, 2000);
      return;
    }

    try {
      const response = await askFriday(input);
      console.log(`\nF.R.I.D.A.Y.: ${response}`);
    } catch (err) {
      console.error(`\nF.R.I.D.A.Y. Error: ${err.message}`);
    }

    promptUser();
  });
};

promptUser();
