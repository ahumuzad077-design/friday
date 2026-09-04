// ===========================================================================
// F.R.I.D.A.Y. DIGITAL PRODUCT FACTORY (PORTABLE RAPID BUILDER)
// ===========================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ACTIVE_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

async function generateDigitalProduct() {
    console.clear();
    console.log('\n[F.R.I.D.A.Y. DIGITAL PRODUCT FACTORY ACTIVE]');
    console.log('Generating high-value digital asset: "Ugandan Corporate Governance & Compliance Master Template Kit"...');

    try {
        const completion = await groq.chat.completions.create({
            model: ACTIVE_MODEL,
            messages: [
                { role: "system", content: "You are an expert corporate legal consultant and digital product architect specializing in Ugandan company law and corporate governance. Generate a comprehensive, premium digital asset package ready to be sold online to entrepreneurs and small businesses." },
                { role: "user", content: "Create a complete, detailed draft for a digital product: 'Ugandan Corporate Governance & Compliance Master Template Kit'. Include board resolution templates, shareholder agreement clauses, annual compliance checklists under the Companies Act, and a step-by-step implementation guide." }
            ]
        });

        const content = completion.choices[0]?.message?.content || "Default product content generation fallback.";
        
        const outputDir = path.join(__dirname, 'digital-product-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const filePath = path.join(outputDir, 'Ugandan-Corporate-Compliance-Kit.md');
        fs.writeFileSync(filePath, content);

        console.log(`\n✓ SUCCESS! Digital product generated and saved to:`);
        console.log(`  📂 ${filePath}`);
        console.log('\nTo secure your work before losing access to this PC, run:');
        console.log('  git init && git add . && git commit -m "Save digital product factory"');
        console.log('  (Then push to your GitHub repository to access it anywhere instantly.)\n');

    } catch (error) {
        console.error('\n[Error generating product via Groq API]:', error.message);
    }
}

generateDigitalProduct();
