#!/usr/bin/env node
/**
 * F.R.I.D.A.Y. V3 local desktop bridge.
 *
 * The cloud agent runs on Railway and cannot directly control a user's PC.
 * This small local bridge opens normal web URLs and fetches cloud mission
 * status. It deliberately does not execute shell commands supplied by the
 * model.
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

export async function cloudStatus(base) {
  const response = await fetch(`${base}/status`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return JSON.parse(text);
}

export async function desktopCommand(message, base) {
  const original = message.trim();
  const command = original.replace(/^(my\s+)?desktop\s*/i, "").trim();

  if (!/^(my\s+)?desktop\b/i.test(original)) return null;

  if (/^(status|progress|report)$/i.test(command)) {
    const status = await cloudStatus(base);
    const goal = status.goal || {};
    return [
      "DESKTOP> Cloud F.R.I.D.A.Y. status",
      `Target: ${goal.currency || "USD"} ${Number(goal.target || 0).toLocaleString()}`,
      `Verified revenue: ${goal.currency || "USD"} ${Number(goal.verified_progress || 0).toLocaleString()}`,
      `Remaining: ${goal.currency || "USD"} ${Number(goal.remaining || 0).toLocaleString()}`,
      `Deadline: ${goal.deadline || "not set"}`,
      `Live mode: ${status.live_mode ? "ON" : "OFF"}`,
      `Paddle API: ${status.paddle_api_configured ? "configured" : "not configured"}`,
      `Paddle webhook: ${status.paddle_webhook_configured ? "configured" : "not configured"}`,
    ].join("\n");
  }

  const match = command.match(/^open\s+(.+)$/i);
  if (match) {
    const url = await openWebsite(match[1]);
    const status = await cloudStatus(base);
    const goal = status.goal || {};
    return [
      `DESKTOP> Opened ${url}`,
      `Verified revenue: ${goal.currency || "USD"} ${Number(goal.verified_progress || 0).toLocaleString()}`,
      `Remaining: ${goal.currency || "USD"} ${Number(goal.remaining || 0).toLocaleString()}`,
      `Paddle API: ${status.paddle_api_configured ? "configured" : "not configured"}`,
    ].join("\n");
  }

  throw new Error("Desktop commands: 'desktop open <website>' or 'desktop status'");
}
