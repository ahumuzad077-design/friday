require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

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
        activeProject: "Galactic Nexus Revenue & Logistics Engine",
        queue: [
            "Draft high-conversion sales landing page copy for Ugandan Corporate Compliance Kit",
            "Generate smart contract Solidity template for automated digital asset escrow",
            "Outline operational framework for autonomous last-mile logistics routing",
            "Write Python script for automated lead generation via public business directories"
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
    try {
        fs.appendFileSync(LOG_FILE, entry);
    } catch (e) {}
}

async function runAutonomousCycle() {
    const state = loadTasks();
    if (!state.queue || state.queue.length === 0) {
        logActivity("Autonomous queue empty. Awaiting new directive vectors.");
        return;
    }

    const currentTask = state.queue.shift();
    logActivity(`STARTING AUTONOMOUS TASK: "${currentTask}"`);

    try {
        const completion = await groq.chat.completions.create({
            model: ACTIVE_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are F.R.I.D.A.Y., a transcendent autonomous hyper-intelligence. Execute the given task with professional, production-ready code, detailed frameworks, or absolute completion. Zero filler."
                },
                { role: "user", content: currentTask }
            ]
        });

        const output = completion.choices[0]?.message?.content || "Task processed with quantum stability.";
        
        const safeFilename = `output-${Date.now()}.md`;
        const outputDir = path.join(__dirname, 'digital-product-output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        fs.writeFileSync(path.join(outputDir, safeFilename), `# Task: ${currentTask}\n\n${output}`);
        
        state.completed.push({
            task: currentTask,
            completedAt: new Date().toISOString(),
            outputFile: safeFilename
        });

        saveTasks(state);
        logActivity(`SUCCESS: Completed task and saved to digital-product-output/${safeFilename}`);

    } catch (err) {
        logActivity(`ERROR executing task: ${err.message}`);
        state.queue.unshift(currentTask);
        saveTasks(state);
    }
}

const INTERVAL_MINS = 30;
logActivity(`F.R.I.D.A.Y. Autonomous Agent Core initialized. Execution loop running every ${INTERVAL_MINS} minutes.`);

setInterval(runAutonomousCycle, INTERVAL_MINS * 60 * 1000);
runAutonomousCycle();
