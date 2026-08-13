require('dotenv/config');
const OpenAI = require('openai');
const { exec } = require('child_process');
const util = require('util');
const si = require('systeminformation');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);
const audioPath = path.join(__dirname, 'input.wav');

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

// 🎙️ Record Audio via PowerShell (Windows MCI)
function recordAudio(outputFile) {
  return new Promise((resolve, reject) => {
    const psScript = `
      $code = @'
      using System;
      using System.Runtime.InteropServices;
      public class AudioRecorder {
          [DllImport("winmm.dll", EntryPoint = "mciSendStringA", CharSet = CharSet.Ansi)]
          public static extern int mciSendString(string command, string buffer, int bufferSize, IntPtr hwndCallback);
      }
'@
      Add-Type -TypeDefinition $code
      [AudioRecorder]::mciSendString("open new type waveaudio alias recsound", $null, 0, [IntPtr]::Zero)
      [AudioRecorder]::mciSendString("record recsound", $null, 0, [IntPtr]::Zero)
      Write-Host "recording"
      [Console]::ReadLine() | Out-Null
      [AudioRecorder]::mciSendString("save recsound ${outputFile.replace(/\\/g, '\\\\')}", $null, 0, [IntPtr]::Zero)
      [AudioRecorder]::mciSendString("close recsound", $null, 0, [IntPtr]::Zero)
    `;

    const process = exec(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, (err) => {
      if (err) return reject(err);
      resolve();
    });

    process.stdout.on('data', (data) => {
      if (data.includes("recording")) {
        console.log("\n🎙️ Listening... Press [ENTER] when done speaking.");
      }
    });
  });
}

// 📝 Transcribe Audio using Groq Whisper API
async function transcribeAudio(filePath) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3-turbo",
    });
    return transcription.text;
  } catch (error) {
    console.error("Transcription Error:", error.message);
    return null;
  }
}

// 1. Define C-Suite Tools
const tools = [
  {
    type: "function",
    function: {
      name: "runPowerShell",
      description: "Executes a PowerShell command on the Windows PC.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSystemStats",
      description: "Retrieves real-time CPU, RAM, and battery statistics.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateCFOFinancials",
      description: "CFO Tool: Calculates ROI, profit margins, revenue forecasts.",
      parameters: {
        type: "object",
        properties: {
          revenue: { type: "number" },
          costs: { type: "number" },
        },
        required: ["revenue", "costs"],
      },
    },
  },
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
      status: profit >= 0 ? "Profitable" : "Operating at a Loss",
    });
  }
  return "Unknown tool";
}

// 3. Conversation Setup
const conversationHistory = [
  {
    role: "system",
    content: "You are F.R.I.D.A.Y., Tony Stark's AI assistant running locally on a Windows PC. Keep responses concise, witty, direct, and conversational.",
  },
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
      console.log(`🤖 F.R.I.D.A.Y. Executing: [${toolCall.function.name}]...`);
      const functionArgs = Object.keys(toolCall.function.arguments).length > 0 ? JSON.parse(toolCall.function.arguments) : {};
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

// 4. Voice Interaction Loop
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("=================================================");
console.log("  F.R.I.D.A.Y. Voice Protocol Active");
console.log("  Press [ENTER] to talk, or type 'exit' to quit.");
console.log("=================================================");

const promptUser = () => {
  rl.question('\nPress [ENTER] to speak (or type "exit"): ', async (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      const shutdownMsg = "Goodbye, boss. Shutting down.";
      console.log(`F.R.I.D.A.Y.: ${shutdownMsg}`);
      speak(shutdownMsg);
      setTimeout(() => {
        rl.close();
        process.exit(0);
      }, 2000);
      return;
    }

    try {
      // 1. Record user audio
      await recordAudio(audioPath);

      // 2. Transcribe audio to text
      console.log("⚡ Transcribing voice...");
      const userText = await transcribeAudio(audioPath);

      if (!userText || userText.trim().length === 0) {
        console.log("F.R.I.D.A.Y.: I didn't catch that. Try speaking again.");
        promptUser();
        return;
      }

      console.log(`\nYou said: "${userText}"`);

      // 3. Process request
      const response = await askFriday(userText);
      console.log(`\nF.R.I.D.A.Y.: ${response}`);

      // Clean up audio file
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    } catch (err) {
      console.error(`\nF.R.I.D.A.Y. Error: ${err.message}`);
    }

    promptUser();
  });
};

promptUser();
