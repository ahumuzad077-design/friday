import 'dotenv/config';
import OpenAI from 'openai';
import { exec } from 'child_process';
import util from 'util';
import si from 'systeminformation';
import readline from 'readline';

const execPromise = util.promisify(exec);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 1. Define F.R.I.D.A.Y.'s Tools
const tools = [
  {
    type: "function",
    function: {
      name: "runPowerShell",
      description: "Executes a PowerShell command on the Windows PC. Can open apps, manage files, or run system tasks.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The PowerShell command to execute.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSystemStats",
      description: "Retrieves current CPU, RAM, and battery statistics of the PC.",
      parameters: { type: "object", properties: {} },
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
    content: "You are F.R.I.D.A.Y., Tony Stark's AI assistant running on a Windows PC. You can run PowerShell commands and check system stats. Be concise, professional, helpful, and slightly witty." 
  }
];

async function askFriday(userInput) {
  conversationHistory.push({ role: "user", content: userInput });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: conversationHistory,
    tools: tools,
    tool_choice: "auto",
  });

  const responseMessage = response.choices[0].message;

  // Check if F.R.I.D.A.Y. requested a tool execution
  if (responseMessage.tool_calls) {
    conversationHistory.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      console.log(`🤖 F.R.I.D.A.Y.: Executing protocol [${toolCall.function.name}]...`);
      
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
      model: "gpt-4o-mini",
      messages: conversationHistory,
    });

    const reply = finalResponse.choices[0].message.content;
    conversationHistory.push({ role: "assistant", content: reply });
    return reply;
  }

  conversationHistory.push(responseMessage);
  return responseMessage.content;
}

console.log("==========================================");
console.log("  F.R.I.D.A.Y. Protocol Active");
console.log("  Type 'exit' to end the session.");
console.log("==========================================");

const promptUser = () => {
  rl.question('\nYou: ', async (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      console.log('F.R.I.D.A.Y.: Goodbye, boss. Shutting down systems.');
      rl.close();
      return;
    }

    try {
      const response = await askFriday(input);
      console.log(`F.R.I.D.A.Y.: ${response}`);
    } catch (err) {
      console.error(`F.R.I.D.A.Y. Error: ${err.message}`);
    }

    promptUser();
  });
};

promptUser();
