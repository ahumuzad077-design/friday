// ===========================================================================
// F.R.I.D.A.Y. UNIVERSAL AUTONOMOUS EXECUTION ENGINE
// ===========================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ACTIVE_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function runUniversalEngine() {
    console.clear();
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║       F.R.I.D.A.Y. UNIVERSAL COMMAND & EXECUTION HUB      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('Status: Online. Ready for any instruction (E-Commerce, Outreach, Dev, Legal, etc.)\n');

    rl.question('What are we executing today? (Type any command or task): ', async (userInstruction) => {
        if (!userInstruction || userInstruction.trim() === '') {
            console.log('No instruction provided. Exiting.');
            rl.close();
            return;
        }

        console.log('\n[Analyzing instruction and orchestrating autonomous execution...]\n');

        try {
            const completion = await groq.chat.completions.create({
                model: ACTIVE_MODEL,
                messages: [
                    { 
                        role: "system", 
                        content: "You are F.R.I.D.A.Y., an elite autonomous executive assistant. The user can give you any business, technical, operational, or outreach task (e.g., website building pipelines, client acquisition scripts, e-commerce automation, legal structuring). Analyze the user's request, break it down into an actionable execution strategy, draft necessary code or outreach templates, and provide a clear, professional operating plan." 
                    },
                    { role: "user", content: userInstruction }
                ]
            });

            const result = completion.choices[0]?.message?.content || "Execution completed with default parameters.";
            
            console.log('===========================================================');
            console.log('F.R.I.D.A.Y. EXECUTION REPORT & DELIVERABLE');
            console.log('===========================================================');
            console.log(result);
            console.log('===========================================================');

            const safeFilename = `task-${Date.now()}.txt`;
            const filePath = path.join(__dirname, safeFilename);
            fs.writeFileSync(filePath, `Instruction: ${userInstruction}\n\nTimestamp: ${new Date().toISOString()}\n\n${result}`);

            console.log(`\n✓ Deliverable automatically saved to disk: ${safeFilename}\n`);

        } catch (error) {
            console.error('\n[Execution Error]:', error.message);
        }

        rl.close();
    });
}

runUniversalEngine();
