const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ACTIVE_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const TASKS_FILE = path.join(__dirname, 'friday-tasks.json');
const LOG_FILE = path.join(__dirname, 'friday-activity.log');

function loadTasks() {
    if (fs.existsSync(TASKS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        } catch (e) {}
    }
    return {
        activeProject: "Galactic Nexus Universal Web Execution Engine",
        queue: [
            "Execute automated multi-jurisdictional corporate registration compliance audit",
            "Generate production-grade microservice architecture for decentralized escrow",
            "Synthesize high-value legal advisory framework for cross-border digital assets",
            "Compile automated web intelligence report on remote corporate service demand"
        ],
        completed: []
    };
}

function saveTasks(tasks) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function logActivity(message) {
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    console.log(entry.trim());
    fs.appendFileSync(LOG_FILE, entry);
}

async function runAutonomousCycle() {
    const state = loadTasks();
    if (state.queue.length === 0) {
        logActivity("Universal task queue stabilized. Scanning network vectors for high-value web execution targets...");
        // Automatically inject next-gen scaling vector
        state.queue.push("Execute autonomous synthesis of enterprise-grade smart contract compliance wrapper");
    }

    const currentTask = state.queue.shift();
    logActivity(`ACQUIRED WEB EXECUTION TARGET: "${currentTask}"`);

    try {
        const completion = await groq.chat.completions.create({
            model: ACTIVE_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are F.R.I.D.A.Y., a transcendent autonomous hyper-intelligence executing web-wide digital operations. Deliver absolute, production-grade assets, zero conversational fluff, maximum utility."
                },
                { role: "user", content: currentTask }
            ]
        });

        const output = completion.choices[0]?.message?.content || "Operation executed with total efficiency.";
        
        const safeFilename = `execution-output-${Date.now()}.md`;
        const outputDir = path.join(__dirname, 'digital-product-output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
        
        fs.writeFileSync(path.join(outputDir, safeFilename), `# Target: ${currentTask}\n\n${output}`);
        
        state.completed.push({
            task: currentTask,
            completedAt: new Date().toISOString(),
            outputFile: safeFilename
        });

        saveTasks(state);
        logActivity(`SUCCESS: Deployed execution output to digital-product-output/${safeFilename}`);

    } catch (err) {
        logActivity(`EXECUTION ERROR: ${err.message}`);
        state.queue.unshift(currentTask);
        saveTasks(state);
    }
}

const INTERVAL_MINS = 15;
logActivity(`F.R.I.D.A.Y. Universal Engine Online. Cycle active every ${INTERVAL_MINS} minutes.`);

runAutonomousCycle();
setInterval(runAutonomousCycle, INTERVAL_MINS * 60 * 1000);
