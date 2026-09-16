#!/usr/bin/env node
import readline from "node:readline";

const base = (process.env.FRIDAY_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("Set FRIDAY_URL to your Railway public URL first.");
  console.error('PowerShell: $env:FRIDAY_URL="https://YOUR-SERVICE.up.railway.app"');
  process.exit(1);
}

async function ask(message) {
  const response = await fetch(`${base}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return JSON.parse(text);
}

const oneShot = process.argv.slice(2).join(" ").trim();
if (oneShot) {
  const result = await ask(oneShot);
  console.log(result.reply ?? JSON.stringify(result, null, 2));
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "You> " });
console.log("F.R.I.D.A.Y. V3 chat. Type 'exit' to quit.");
rl.prompt();
rl.on("line", async (line) => {
  const message = line.trim();
  if (!message) return rl.prompt();
  if (message.toLowerCase() === "exit") return rl.close();
  try {
    const result = await ask(message);
    console.log(`\nFRIDAY> ${result.reply ?? JSON.stringify(result)}\n`);
  } catch (error) {
    console.error(`\nFRIDAY ERROR> ${error.message}\n`);
  }
  rl.prompt();
});
