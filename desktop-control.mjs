#!/usr/bin/env node
/**
 * F.R.I.D.A.Y. V3 local desktop bridge.
 *
 * The cloud agent runs on Railway and cannot directly control a user's PC.
 * This local bridge opens normal web URLs and fetches cloud mission status.
 * It deliberately does not execute shell commands supplied by the model.
 */
import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SITES = {
  friday: "https://friday-production-0162.up.railway.app/status",
  railway: "https://railway.app/",
  github: "https://github.com/",
  paddle: "https://www.paddle.com/",
  google: "https://www.google.com/",
  youtube: "https://www.youtube.com/",
  shopify: "https://www.shopify.com/",
};

function resolveUrl(target) {
  const value = target.trim();
  if (!value) throw new Error("website or search target is required");
  const key = value.toLowerCase();
  if (SITES[key]) return SITES[key];
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export async function openWebsite(target) {
  const url = resolveUrl(target);
  if (process.platform === "win32") {
    await execFileAsync("cmd.exe", ["/c", "start", "", url]);
  } else if (process.platform === "darwin") {
    await execFileAsync("open", [url]);
  } else {
    await execFileAsync("xdg-open", [url]);
  }
  return url;
}

export async function cloudStatus(base, attempts = 3) {
  const errors = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${base}/status`, {
        signal: AbortSignal.timeout(8000),
        headers: { accept: "application/json" },
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${response.status}: ${text}`);
      return JSON.parse(text);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw new Error(`cloud status unavailable after ${attempts} attempts: ${errors.at(-1)}`);
}

function statusLines(status) {
  const goal = status.goal || {};
  const currency = goal.currency || "USD";
  const configuredProviders = (status.providers || []).filter((p) => p.configured);
  return [
    `Target: ${currency} ${Number(goal.target || 0).toLocaleString()}`,
    `Verified revenue: ${currency} ${Number(goal.verified_progress || 0).toLocaleString()}`,
    `Remaining: ${currency} ${Number(goal.remaining || 0).toLocaleString()}`,
    `Deadline: ${goal.deadline || "not set"}`,
    `Live mode: ${status.live_mode ? "ON" : "OFF"}`,
    `Paddle API: ${status.paddle_api_configured ? "configured" : "not configured"}`,
    `Paddle webhook: ${status.paddle_webhook_configured ? "configured" : "not configured"}`,
    `AI providers: ${configuredProviders.length ? configuredProviders.map((p) => `${p.provider}${p.available ? "(available)" : "(cooldown)"}`).join(", ") : "none configured"}`,
  ];
}

export async function desktopCommand(message, base) {
  const original = message.trim();
  const command = original.replace(/^(my\s+)?desktop\s*/i, "").trim();

  if (!/^(my\s+)?desktop\b/i.test(original)) return null;

  if (/^(status|progress|report)$/i.test(command)) {
    const status = await cloudStatus(base);
    return ["DESKTOP> Cloud F.R.I.D.A.Y. status", ...statusLines(status)].join("\n");
  }

  const match = command.match(/^open\s+(.+)$/i);
  if (match) {
    // Open the requested site even if the cloud status endpoint is temporarily unavailable.
    const url = await openWebsite(match[1]);
    try {
      const status = await cloudStatus(base);
      return [
        `DESKTOP> Opened ${url}`,
        ...statusLines(status).filter((line) => !line.startsWith("Deadline:")),
      ].join("\n");
    } catch (error) {
      return [
        `DESKTOP> Opened ${url}`,
        "Cloud status: temporarily unavailable",
        `Reason: ${error instanceof Error ? error.message : String(error)}`,
      ].join("\n");
    }
  }

  throw new Error("Desktop commands: 'desktop open <website>' or 'desktop status'");
}
