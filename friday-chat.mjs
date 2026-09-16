#!/usr/bin/env node
import readline from "node:readline";
import { desktopCommand } from "./desktop-control.mjs";

// Default to the current V3 Railway service so the CLI works immediately.
// Override with FRIDAY_URL when using another deployment.
const base = (process.env.FRIDAY_URL || "https://friday-production-0162.up.railway.app").replace(/\/$/, "");

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

async function runMessage(message) {
  const desktop = await desktopCommand(message, base);
  if (desktop !== null) return desktop;
  const result = await ask(message);
  return result.reply ?? JSON.stringify(result, null, 2);
}

const oneShot = process.argv.slice(2).join(" ").trim();
if (oneShot) {
  try {
    console.log(await runMessage(oneShot));
  } catch (error) {
    console.error(`FRIDAY ERROR> ${error.message}`);
    process.exitCode = 1;
  }
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "You> " });
console.log("F.R.I.D.A.Y. V3 chat. Connected to the V3 Railway service.");
console.log("Desktop commands: 'my desktop open <website>' or 'my desktop status'.");
console.log(`Cloud URL: ${base}`);
rl.prompt();
rl.on("line", async (line) => {
  const message = line.trim();
  if (!message) return rl.prompt();
  if (message.toLowerCase() === "exit") return rl.close();
  try {
    console.log(`\nFRIDAY> ${await runMessage(message)}\n`);
  } catch (error) {
    console.error(`\nFRIDAY ERROR> ${error.message}\n`);
  }
  rl.prompt();
});
