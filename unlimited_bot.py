import os
import logging
import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FRIDAY_IMPERIAL_HOLO_OS")

app = FastAPI(title="FRIDAY - Imperial Holo-OS V4 // Full Skill Integration")

# Initialize Groq Client for lightning-fast real intelligence
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
) if GROQ_API_KEY else None

class ChatMessage(BaseModel):
    message: str
    app_target: str = "command_matrix"

@app.get("/", response_class=HTMLResponse)
async def get_dashboard():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FRIDAY // HOLO-OS V4 (UNIFIED SKILLS)</title>
    <style>
        :root {
            --bg-canvas: #020617;
            --surface: rgba(15, 23, 42, 0.82);
            --border-glow: rgba(56, 189, 248, 0.3);
            --neon-cyan: #38bdf8;
            --accent-gold: #f59e0b;
            --text-main: #f8fafc;
            --text-muted: #64748b;
        }

        body {
            background-color: var(--bg-canvas);
            color: var(--text-main);
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
            margin: 0;
            padding: 24px;
            min-height: 100vh;
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.08) 0%, transparent 60%),
                radial-gradient(circle at 100% 100%, rgba(245, 158, 11, 0.05) 0%, transparent 50%);
            box-sizing: border-box;
        }

        .workspace {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 20px;
        }

        @media (max-width: 1024px) {
            .workspace { grid-template-columns: 1fr; }
        }

        .panel {
            background: var(--surface);
            border: 1px solid var(--border-glow);
            border-radius: 14px;
            padding: 20px;
            backdrop-filter: blur(25px);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            position: relative;
            overflow: hidden;
        }

        .panel::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 2px;
            background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
        }

        h3 {
            margin: 0 0 16px 0;
            font-size: 12px;
            letter-spacing: 3px;
            color: var(--neon-cyan);
            text-transform: uppercase;
            border-bottom: 1px dashed var(--border-glow);
            padding-bottom: 8px;
        }

        .app-carousel {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
        }

        .app-card {
            background: rgba(8, 14, 26, 0.6);
            border: 1px solid rgba(56, 189, 248, 0.15);
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: 0.3s;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .app-card:hover, .app-card.active {
            border-color: var(--neon-cyan);
            background: rgba(56, 189, 248, 0.1);
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.2);
            color: var(--neon-cyan);
        }

        .main-screen {
            display: flex;
            flex-direction: column;
            height: 600px;
        }

        #viewport {
            flex: 1;
            background: #010409;
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: 10px;
            padding: 20px;
            overflow-y: auto;
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            color: #cbd5e1;
            margin-bottom: 16px;
            box-shadow: inset 0 2px 15px rgba(0,0,0,0.8);
        }

        .log-entry { margin-bottom: 12px; line-height: 1.6; }
        .log-user { color: var(--accent-gold); font-weight: bold; }
        .log-friday { color: var(--neon-cyan); }

        .input-bar {
            display: flex;
            gap: 12px;
        }

        input[type="text"] {
            flex: 1;
            background: #080c14;
            border: 1px solid var(--border-glow);
            color: var(--text-main);
            padding: 14px 18px;
            border-radius: 8px;
            font-family: inherit;
            font-size: 14px;
            outline: none;
            transition: 0.3s;
        }

        input[type="text"]:focus {
            border-color: var(--neon-cyan);
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.25);
        }

        button {
            background: rgba(56, 189, 248, 0.1);
            border: 1px solid var(--neon-cyan);
            color: var(--neon-cyan);
            padding: 0 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.3s;
            letter-spacing: 2px;
            text-transform: uppercase;
            font-size: 12px;
        }

        button:hover {
            background: var(--neon-cyan);
            color: #020617;
            box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
        }

        .telemetry-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            color: var(--text-muted);
        }
        .telemetry-val { color: var(--text-main); font-weight: bold; }
    </style>
</head>
<body>
    <div class="workspace">
        <!-- Sidebar App Carousel -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div class="panel">
                <h3>App Carousel</h3>
                <div class="app-carousel">
                    <div class="app-card active" onclick="switchApp('command_matrix', this)"><span>Command Matrix</span><span>⚡</span></div>
                    <div class="app-card" onclick="switchApp('legal_research', this)"><span>Legal & Jurisprudence</span><span>⚖️</span></div>
                    <div class="app-card" onclick="switchApp('data_analyzer', this)"><span>Data Analyzer</span><span>📊</span></div>
                    <div class="app-card" onclick="switchApp('hardware_bridge', this)"><span>Web3 & API Bridge</span><span>🔗</span></div>
                </div>
            </div>

            <div class="panel">
                <h3>System Telemetry</h3>
                <div class="telemetry-row"><span>Core Engine</span><span class="telemetry-val" style="color:#4ade80;">Active</span></div>
                <div class="telemetry-row"><span>Groq AI Pipeline</span><span class="telemetry-val" style="color:#4ade80;">Online</span></div>
                <div class="telemetry-row"><span>GitHub / Keys</span><span class="telemetry-val" style="color:#4ade80;">Linked</span></div>
                <button onclick="triggerEngine()" style="width: 100%; margin-top: 16px; padding: 10px;">Run Background Task</button>
            </div>
        </div>

        <!-- Main Interaction Screen -->
        <div class="panel main-screen">
            <h3 id="active-app-title">💬 Active App: Command Matrix</h3>
            <div id="viewport">
                <div class="log-entry"><span class="log-friday">[FRIDAY // HOLO-OS V4]:</span> Neural interface synchronized with all modular skills (Legal research, JS/Python execution, Web3/API routing). Ready for input.</div>
            </div>
            <div class="input-bar">
                <input type="text" id="user-input" placeholder="Transmit command, legal query, or code directive..." onkeypress="if(event.key === 'Enter') transmitData()" />
                <button onclick="transmitData()">Transmit</button>
            </div>
        </div>
    </div>

    <script>
        let currentApp = 'command_matrix';

        function switchApp(appName, element) {
            document.querySelectorAll('.app-card').forEach(c => c.classList.remove('active'));
            element.classList.add('active');
            currentApp = appName;
            
            const titles = {
                'command_matrix': '💬 Active App: Command Matrix',
                'legal_research': '⚖️ Active App: Legal & Jurisprudence Matrix',
                'data_analyzer': '📊 Active App: Data & File Analyzer',
                'hardware_bridge': '🔗 Active App: Web3 & API Bridge'
            };
            document.getElementById('active-app-title').innerText = titles[appName];
            const viewport = document.getElementById('viewport');
            viewport.innerHTML += `<div class="log-entry"><span class="log-friday">[FRIDAY]:</span> Switched context to ${appName.replace('_', ' ').toUpperCase()}. Neural processing primed.</div>`;
            viewport.scrollTop = viewport.scrollHeight;
        }

        async function transmitData() {
            const input = document.getElementById('user-input');
            const viewport = document.getElementById('viewport');
            if(!input.value.trim()) return;
            const text = input.value;
            
            viewport.innerHTML += `<div class="log-entry"><span class="log-user">[USER // ${currentApp.toUpperCase()}]:</span> ${text}</div>`;
            input.value = '';

            try {
                const res = await fetch('/chat', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({message: text, app_target: currentApp})
                });
                const data = await res.json();
                viewport.innerHTML += `<div class="log-entry"><span class="log-friday">[FRIDAY]:</span> ${data.reply.replace(/\\n/g, '<br>')}</div>`;
            } catch (e) {
                viewport.innerHTML += `<div class="log-entry" style="color: #ef4444;"><span class="log-friday">[FRIDAY]:</span> Execution pipeline error.</div>`;
            }
            viewport.scrollTop = viewport.scrollHeight;
        }

        async function triggerEngine() {
            const viewport = document.getElementById('viewport');
            viewport.innerHTML += `<div class="log-entry"><span class="log-friday">[FRIDAY]:</span> Executing background empire engine sequence...</div>`;
            try {
                const res = await fetch('/api/empire/run', { method: 'POST' });
                const data = await res.json();
                viewport.innerHTML += `<div class="log-entry"><span class="log-friday">[FRIDAY]:</span> ${data.message}</div>`;
            } catch (e) {
                viewport.innerHTML += `<div class="log-entry" style="color: #ef4444;"><span class="log-friday">[FRIDAY]:</span> Sequence failed.</div>`;
            }
            viewport.scrollTop = viewport.scrollHeight;
        }
    </script>
</body>
</html>
    """

@app.post("/chat")
async def chat_endpoint(payload: ChatMessage):
    msg = payload.message
    app_target = payload.app_target
    
    # System prompts mapped to user's specialized skills and workflows
    system_prompts = {
        "command_matrix": "You are FRIDAY, an elite, high-performance AI executive assistant built for advanced automation, coding, and strategic task execution.",
        "legal_research": "You are FRIDAY operating in Legal & Jurisprudence Mode. You assist with rigorous analysis of Ugandan statutory law, English common law, tort law, contract law, equity and trusts, and legal philosophy/jurisprudence.",
        "data_analyzer": "You are FRIDAY operating in Data Analysis Mode. Parse text payloads, logs, or datasets with high structural precision and actionable insights.",
        "hardware_bridge": "You are FRIDAY operating in Web3 & API Bridge Mode. Handle API payloads, GitHub tasks, and MetaMask/crypto asset logic instructions with clean technical execution."
    }
    
    system_instruction = system_prompts.get(app_target, system_prompts["command_matrix"])
    
    if groq_client:
        try:
            completion = groq_client.chat.completions.create(
                model="openai/gpt-oss-20b",  # Fast & powerful open model on Groq
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": msg}
                ],
                temperature=0.7,
                max_tokens=1024
            )
            reply = completion.choices[0].message.content
            return {"status": "success", "reply": reply}
        except Exception as e:
            logger.error(f"Groq execution error: {str(e)}")
            
    # Fallback response if API key isn't active yet
    reply = f"[{app_target.upper()} MODE]: Acknowledged '{msg}'. (Connect your GROQ_API_KEY in `.env` to enable full real-time neural execution)."
    return {"status": "success", "reply": reply}

@app.post("/api/empire/run")
async def run_empire_engine():
    try:
        if os.path.exists("autonomous-empire-engine.js"):
            subprocess.Popen(["node", "autonomous-empire-engine.js"])
            return {"status": "success", "message": "Imperial background node sequence successfully spawned."}
        else:
            return {"status": "error", "message": "Empire script not detected in root directory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)