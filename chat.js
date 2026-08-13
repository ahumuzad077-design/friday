require('dotenv/config');
const OpenAI = require('openai');
const { exec } = require('child_process');
const util = require('util');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);
const audioPath = path.join(__dirname, 'input.wav');

// 1. Initialize Dual Engines (Groq Cloud + Local Ollama)
const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'no_key',
  baseURL: 'https://api.groq.com/openai/v1',
});

const localClient = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

// 2. MCU Irish Accent Speech Synthesizer
function speak(text) {
  return new Promise((resolve) => {
    const safeText = text.replace(/["'\r\n]/g, " ");
    const psCommand = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      try {
        $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-IE'));
      } catch {
        try {
          $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-GB'));
        } catch {
          $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
        }
      }
      $synth.Rate = 0;
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

// 4. Record User Audio
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

// 5. Dual Transcribe (Groq Whisper Online -> Local Dictation Offline)
async function transcribeAudio(filePath) {
  try {
    // Attempt Online Groq Whisper
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

// 6. Capabilities & Tools
const tools = [
  {
    type: "function",
    function: {
      name: "getSystemStats",
      description: "Retrieves real-time CPU, RAM, and battery statistics.",
      parameters: { type: "object", properties: {} },
    },
  }
];

const conversationHistory = [
  {
    role: "system",
    content: "You are F.R.I.D.A.Y., Tony Stark's AI assistant running locally on Windows. Keep responses concise, witty, and direct.",
  },
];

// 7. Dual Reasoning Loop
async function askFriday(userInput) {
  conversationHistory.push({ role: "user", content: userInput });

  // Try Online First
  try {
    const response = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: conversationHistory,
    });
    const reply = response.choices[0].message.content;
    conversationHistory.push({ role: "assistant", content: reply });
    await speak(reply);
    return `[Online] ${reply}`;
  } catch (onlineError) {
    console.log("🌐 Online API offline/unreachable. Falling back to local Ollama engine...");
    
    // Fallback to Local Offline Ollama
    try {
      const localResponse = await localClient.chat.completions.create({
        model: "llama3.2",
        messages: conversationHistory,
      });
      const reply = localResponse.choices[0].message.content;
      conversationHistory.push({ role: "assistant", content: reply });
      await speak(reply);
      return `[Offline] ${reply}`;
    } catch (localError) {
      const errorMsg = "Both Cloud and Local Ollama engines are unreachable. Please check your connection or run 'ollama run llama3.2'.";
      await speak(errorMsg);
      return errorMsg;
    }
  }
}

// 8. Main Infinite Loop
async function startDualAssistant() {
  console.log("=================================================");
  console.log("  F.R.I.D.A.Y. Active (Online/Offline Dual Mode)");
  console.log("  Say 'Hey Friday' to trigger voice input.");
  console.log("=================================================");

  while (true) {
    const triggered = await listenForWakeWord();

    if (triggered) {
      console.log("\n✨ Wake Word Detected!");
      await speak("Boss?");

      await recordAudio(audioPath);
      console.log("⚡ Processing audio...");

      const userText = await transcribeAudio(audioPath);

      if (userText && userText.trim().length > 0) {
        console.log(`\nYou said: "${userText}"`);
        const response = await askFriday(userText);
        console.log(`\nF.R.I.D.A.Y.: ${response}`);
      } else {
        console.log("F.R.I.D.A.Y.: Speech not recognized.");
      }

      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }
  }
}

startDualAssistant();
