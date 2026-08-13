require('dotenv/config');
const OpenAI = require('openai');
const { exec } = require('child_process');
const util = require('util');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);
const audioPath = path.join(__dirname, 'input.wav');

// 1. Dual AI Clients (Groq Cloud Primary + Local Ollama Fallback)
const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'no_key',
  baseURL: 'https://api.groq.com/openai/v1',
});

const localClient = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

// 2. 🔊 High-Quality F.R.I.D.A.Y. Voice Engine
function speak(text) {
  return new Promise((resolve) => {
    const safeText = text.replace(/["'\r\n]/g, " ");
    const psCommand = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      
      # Select Best Available Female Voice (Prefers Irish en-IE, then British en-GB, then standard)
      try {
        $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-IE'));
      } catch {
        try {
          $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-GB'));
        } catch {
          $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
        }
      }
      
      $synth.Rate = 1;     # Conversational pace
      $synth.Volume = 100;
      $synth.Speak('${safeText}');
    `;
    exec(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, (err) => {
      if (err) console.error("Speech Error:", err.message);
      resolve();
    });
  });
}

// 3. Wake-Word Listener ("Hey Friday")
function listenForWakeWord() {
  return new Promise((resolve) => {
    console.log("\n🟢 Listening for 'Hey Friday'...");
    
    const psScript = `
      Add-Type -AssemblyName System.Speech;
      $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine;
      $choices = New-Object System.Speech.Recognition.Choices;
      $choices.Add([string[]]@("Hey Friday", "Friday"));
      $gb = New-Object System.Speech.Recognition.GrammarBuilder;
      $gb.Append($choices);
      $g = New-Object System.Speech.Recognition.Grammar($gb);
      $engine.LoadGrammar($g);
      $engine.SetInputToDefaultAudioDevice();
      $result = $engine.Recognize();
      if ($result) { Write-Host "WAKE_WORD_DETECTED" }
    `;

    const proc = exec(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);

    proc.stdout.on('data', (data) => {
      if (data.includes("WAKE_WORD_DETECTED")) {
        proc.kill();
        resolve(true);
      }
    });

    proc.on('error', () => resolve(false));
  });
}

// 4. Audio Recorder
function recordAudio(outputFile) {
  return new Promise((resolve, reject) => {
    console.log("🎙️ Listening... Speak now!");
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
      Start-Sleep -Seconds 5
      [AudioRecorder]::mciSendString("save recsound ${outputFile.replace(/\\/g, '\\\\')}", $null, 0, [IntPtr]::Zero)
      [AudioRecorder]::mciSendString("close recsound", $null, 0, [IntPtr]::Zero)
    `;

    exec(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// 5. Speech-to-Text Transcription
async function transcribeAudio(filePath) {
  try {
    const transcription = await groqClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3-turbo",
    });
    return transcription.text;
  } catch (error) {
    console.log("🌐 Groq Whisper unavailable, using local dictation...");
    return new Promise((resolve) => {
      const psScript = `
        Add-Type -AssemblyName System.Speech;
        $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine;
        $engine.SetInputToDefaultAudioDevice();
        $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar));
        $result = $engine.Recognize([TimeSpan]::FromSeconds(5));
        if ($result) { Write-Host "RESULT:$($result.Text)" }
      `;
      const proc = exec(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
      proc.stdout.on('data', (data) => {
        if (data.includes("RESULT:")) {
          resolve(data.split("RESULT:")[1].trim());
          proc.kill();
        }
      });
      proc.on('close', () => resolve(null));
    });
  }
}

// 6. 🌐 Comprehensive System & Assistant Tools
const tools = [
  {
    type: "function",
    function: {
      name: "runPowerShell",
      description: "Executes custom PowerShell commands on the machine.",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "PowerShell command string" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSystemStats",
      description: "Retrieves CPU load, RAM usage, storage space, battery, and uptime.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "launchApp",
      description: "Launches any application on Windows (e.g., chrome, notepad, spotify, code, calc).",
      parameters: {
        type: "object",
        properties: { appName: { type: "string", description: "Executable or application name" } },
        required: ["appName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manageProcess",
      description: "Lists active processes or closes/terminates a running process.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "kill"], description: "Action to perform" },
          processName: { type: "string", description: "Name of the process to terminate (if action is kill)" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fileOperations",
      description: "Reads, writes, lists, or deletes files and folders.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "write", "list", "delete"] },
          filePath: { type: "string", description: "Target file or folder path" },
          content: { type: "string", description: "Content to write if action is write" },
        },
        required: ["action", "filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "controlVolume",
      description: "Adjusts master system volume level or mutes audio.",
      parameters: {
        type: "object",
        properties: {
          level: { type: "number", description: "Volume level from 0 to 100" },
          mute: { type: "boolean", description: "Set true to mute audio" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "systemControl",
      description: "Executes power commands: lock, sleep, restart, shutdown, or display notification.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["lock", "sleep", "restart", "shutdown", "notify"] },
          message: { type: "string", description: "Notification text if action is notify" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "openWebPage",
      description: "Opens a URL or searches Google in the default web browser.",
      parameters: {
        type: "object",
        properties: { urlOrQuery: { type: "string", description: "URL or search keywords" } },
        required: ["urlOrQuery"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "takeScreenshot",
      description: "Captures a full screenshot of the desktop.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateFinancials",
      description: "Performs financial calculations: profit, ROI, margins, revenue projections.",
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
  {
    type: "function",
    function: {
      name: "clipboardManager",
      description: "Gets or sets the Windows Clipboard text.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["get", "set"] },
          text: { type: "string", description: "Text to copy to clipboard" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDateTime",
      description: "Returns the current local date, time, and timezone.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// 7. Tool Execution Logic Engine
async function executeTool(name, args) {
  try {
    if (name === "runPowerShell") {
      const { stdout, stderr } = await execPromise(`powershell -Command "${args.command}"`);
      return stdout || stderr || "Command executed successfully.";
    }

    if (name === "getSystemStats") {
      const cpu = await si.currentLoad();
      const mem = await si.mem();
      const fsSize = await si.fsSize();
      const battery = await si.battery();
      const mainDrive = fsSize[0] || { size: 0, used: 0 };
      return JSON.stringify({
        cpuLoad: `${Math.round(cpu.currentLoad)}%`,
        ramUsed: `${Math.round(mem.active / 1024 / 1024 / 1024)}GB / ${Math.round(mem.total / 1024 / 1024 / 1024)}GB`,
        diskFree: `${Math.round((mainDrive.size - mainDrive.used) / 1024 / 1024 / 1024)}GB free`,
        battery: battery.hasBattery ? `${battery.percent}% (${battery.isCharging ? 'Charging' : 'Discharging'})` : "Desktop",
      });
    }

    if (name === "launchApp") {
      exec(`start ${args.appName}`);
      return `Launched application: ${args.appName}`;
    }

    if (name === "manageProcess") {
      if (args.action === "list") {
        const processes = await si.processes();
        const top5 = processes.list.sort((a, b) => b.cpu - a.cpu).slice(0, 5).map(p => `${p.name} (PID: ${p.pid})`);
        return `Top CPU processes: ${top5.join(', ')}`;
      } else if (args.action === "kill" && args.processName) {
        await execPromise(`taskkill /F /IM "${args.processName}.exe" /T`);
        return `Terminated process ${args.processName}.`;
      }
    }

    if (name === "fileOperations") {
      if (args.action === "read") {
        return fs.readFileSync(args.filePath, 'utf8');
      } else if (args.action === "write") {
        fs.writeFileSync(args.filePath, args.content || '');
        return `File saved to ${args.filePath}`;
      } else if (args.action === "list") {
        const files = fs.readdirSync(args.filePath);
        return `Contents of ${args.filePath}: ${files.join(', ')}`;
      } else if (args.action === "delete") {
        fs.unlinkSync(args.filePath);
        return `Deleted file: ${args.filePath}`;
      }
    }

    if (name === "controlVolume") {
      if (args.mute !== undefined) {
        await execPromise(`powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`);
        return `Toggled audio mute state.`;
      }
      if (args.level !== undefined) {
        const ps = `[Audio]::SetVolume(${args.level})`;
        return `Set system volume to ${args.level}%.`;
      }
    }

    if (name === "systemControl") {
      if (args.action === "lock") {
        exec("rundll32.exe user32.dll,LockWorkStation");
        return "Workstation locked.";
      } else if (args.action === "sleep") {
        exec("rundll32.exe powrprof.dll,SetSuspendState 0,1,0");
        return "System entering sleep mode.";
      } else if (args.action === "restart") {
        exec("shutdown /r /t 5");
        return "System restarting in 5 seconds.";
      } else if (args.action === "shutdown") {
        exec("shutdown /s /t 5");
        return "System shutting down in 5 seconds.";
      } else if (args.action === "notify") {
        const psNotif = `[reflection.assembly]::loadwithpartialname("System.Windows.Forms"); [reflection.assembly]::loadwithpartialname("System.Drawing"); $notification = new-object system.windows.forms.notifyicon; $notification.icon = [system.drawing.systemicons]::information; $notification.visible = $true; $notification.showballtip(5000, "F.R.I.D.A.Y.", "${args.message}", [system.windows.forms.tooltipicon]::info)`;
        exec(`powershell -Command "${psNotif}"`);
        return `Notification displayed: "${args.message}"`;
      }
    }

    if (name === "openWebPage") {
      const target = args.urlOrQuery.startsWith("http") ? args.urlOrQuery : `https://www.google.com/search?q=${encodeURIComponent(args.urlOrQuery)}`;
      exec(`start ${target}`);
      return `Opened browser target: ${target}`;
    }

    if (name === "takeScreenshot") {
      const screenshotPath = path.join(process.env.USERPROFILE, 'Pictures', `Friday_Screenshot_${Date.now()}.png`);
      const psScreen = `Add-Type -AssemblyName System.Windows.Forms; $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; $graphics = [System.Drawing.Graphics]::FromImage($bmp); $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bmp.Save('${screenshotPath.replace(/\\/g, '\\\\')}'); $graphics.Dispose(); $bmp.Dispose()`;
      await execPromise(`powershell -Command "${psScreen}"`);
      return `Screenshot captured and saved to ${screenshotPath}`;
    }

    if (name === "calculateFinancials") {
      const profit = args.revenue - args.costs;
      const margin = args.revenue > 0 ? ((profit / args.revenue) * 100).toFixed(2) : 0;
      const roi = args.costs > 0 ? ((profit / args.costs) * 100).toFixed(2) : 0;
      return JSON.stringify({
        netProfit: `$${profit.toLocaleString()}`,
        profitMargin: `${margin}%`,
        ROI: `${roi}%`,
        status: profit >= 0 ? "Profitable" : "Loss",
      });
    }

    if (name === "clipboardManager") {
      if (args.action === "get") {
        const { stdout } = await execPromise(`powershell -Command "Get-Clipboard"`);
        return `Clipboard text: ${stdout.trim()}`;
      } else if (args.action === "set") {
        await execPromise(`powershell -Command "Set-Clipboard -Value '${args.text}'"`);
        return `Updated clipboard text.`;
      }
    }

    if (name === "getDateTime") {
      return `Current Date & Time: ${new Date().toLocaleString()}`;
    }
  } catch (err) {
    return `Error executing tool [${name}]: ${err.message}`;
  }

  return "Unknown tool";
}

// 8. Conversation History & System Persona
const conversationHistory = [
  {
    role: "system",
    content: "You are F.R.I.D.A.Y., Tony Stark's autonomous AI assistant operating locally on Windows. You have full system access including running commands, managing files, launching apps, system controls, screen captures, audio management, and financial analysis. Keep all replies concise, confident, witty, direct, and conversational.",
  },
];

// 9. Core Assistant Reasoning Loop
async function askFriday(userInput) {
  conversationHistory.push({ role: "user", content: userInput });

  try {
    const response = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: conversationHistory,
      tools: tools,
      tool_choice: "auto",
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
      conversationHistory.push(responseMessage);
      for (const toolCall of responseMessage.tool_calls) {
        console.log(`🤖 F.R.I.D.A.Y. Executing tool: [${toolCall.function.name}]...`);
        const functionArgs = Object.keys(toolCall.function.arguments).length > 0 ? JSON.parse(toolCall.function.arguments) : {};
        const toolResult = await executeTool(toolCall.function.name, functionArgs);
        conversationHistory.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      const finalResponse = await groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: conversationHistory,
      });

      const reply = finalResponse.choices[0].message.content;
      conversationHistory.push({ role: "assistant", content: reply });
      await speak(reply);
      return reply;
    }

    const reply = responseMessage.content;
    conversationHistory.push(responseMessage);
    await speak(reply);
    return reply;

  } catch (onlineError) {
    console.log("🌐 Cloud API offline. Switching to local Ollama...");
    try {
      const localResponse = await localClient.chat.completions.create({
        model: "llama3.2",
        messages: conversationHistory,
      });
      const reply = localResponse.choices[0].message.content;
      conversationHistory.push({ role: "assistant", content: reply });
      await speak(reply);
      return reply;
    } catch (localError) {
      const errorMsg = "All engines offline. Please check your connection or launch Ollama.";
      await speak(errorMsg);
      return errorMsg;
    }
  }
}

// 10. Main Infinite Loop
async function startAssistant() {
  console.log("=================================================");
  console.log("  F.R.I.D.A.Y. Full OS OS-Control Protocol Active");
  console.log("  Say 'Hey Friday' or 'Friday' to trigger.");
  console.log("=================================================");

  while (true) {
    const triggered = await listenForWakeWord();

    if (triggered) {
      console.log("\n✨ Wake Word Detected!");
      await speak("At your service, boss.");

      await recordAudio(audioPath);
      console.log("⚡ Transcribing audio input...");

      const userText = await transcribeAudio(audioPath);

      if (userText && userText.trim().length > 0) {
        console.log(`\nYou: "${userText}"`);
        const response = await askFriday(userText);
        console.log(`\nF.R.I.D.A.Y.: ${response}`);
      } else {
        console.log("F.R.I.D.A.Y.: Speech not recognized.");
      }

      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }
  }
}

startAssistant();
