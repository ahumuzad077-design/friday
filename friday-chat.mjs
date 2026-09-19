#!/usr/bin/env node
import readline from "node:readline";

const BASE = (process.env.FRIDAY_URL || "https://friday-production-0162.up.railway.app").replace(/\/$/, "");
const TOKEN = (process.env.FRIDAY_CONTROL_TOKEN || "").trim();

function headers(json = false) {
  const h = {};
  if (json) h["content-type"] = "application/json";
  if (TOKEN) h["X-FRIDAY-CONTROL-TOKEN"] = TOKEN;
  return h;
}

async function request(path, options = {}) {
  const response = await fetch(BASE + path, options);
  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    data = body;
  }
  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`${response.status}: ${detail}`);
  }
  return data;
}

async function get(path) {
  return request(path, { headers: headers() });
}

async function post(path, body = undefined, protectedRoute = false) {
  if (protectedRoute && !TOKEN) {
    throw new Error("FRIDAY_CONTROL_TOKEN is not set locally. The protected command was not sent.");
  }
  return request(path, {
    method: "POST",
    headers: headers(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printHelp() {
  console.log(`
F.R.I.D.A.Y. V3 10× — command terminal

Type normally to chat with F.R.I.D.A.Y.
Natural language commands are sent to the live V3 /chat endpoint.

Quick commands:
  /health                         Service health
  /status                         Full V3 status
  /mission                        Mission queue and targets
  /opportunities                  Current opportunity portfolio
  /autopilot                      Autopilot status
  /ledger                         Recent verified ledger events
  /dashboard                      Compact progress dashboard
  /discover                       Run discovery (needs control token)
  /run                            Run one autopilot cycle (needs control token)
  /invoice <opp> <amount> <desc>  Create an invoice (needs control token)
  /pipeline <opp> <json>          Create a revenue pipeline (needs control token)
  /advance <opp> <stage> <json>   Advance a pipeline (needs control token)
  /paid <opp> <json>              Mark payment verified (needs control token)
  /browser <url>                  Inspect a website (needs control token)
  /shopify                       Shopify products/publications
  /commercial                     Commercial capability coverage
  /commercial-run                Run all commercial handlers (needs control token)
  /commercial <strategy>          Run one commercial handler (needs control token)
  /clear                          Clear terminal
  /help                           Show this help
  /exit                           Quit

Examples:
  F.R.I.D.A.Y., what are you working on?
  Find the highest-value ready opportunities.
  Start the revenue engine now.
  What revenue is actually verified?
`);
}

async function dashboard() {
  const [status, mission, autopilot, ledger] = await Promise.all([
    get("/status"),
    get("/mission"),
    get("/autopilot"),
    get("/ledger/recent?limit=10"),
  ]);

  const goal = status.goal || {};
  const target = goal.target ?? status.mission_target?.amount ?? "unknown";
  const currency = goal.currency ?? status.mission_target?.currency ?? "";
  const progress = goal.verified_progress ?? status.mission_target?.verified_progress ?? 0;

  console.log("\n=== F.R.I.D.A.Y. V3 10× DASHBOARD ===");
  console.log(`Cloud:              ${BASE}`);
  console.log(`Engine:             ${status.engine_version ?? "unknown"}`);
  console.log(`Live mode:          ${status.live_mode}`);
  console.log(`Target:             ${target} ${currency}`);
  console.log(`Verified revenue:   ${progress} ${currency}`);
  console.log(`Autopilot running:  ${autopilot.running}`);
  console.log(`Autopilot cycles:   ${autopilot.cycles}`);
  console.log(`Ready packets:      ${(mission.work_packets || []).filter(x => x.status === "READY").length}`);
  console.log(`Ledger events:      ${Array.isArray(ledger) ? ledger.length : "unknown"} recent`);
  if (autopilot.last_error) console.log(`Last error:         ${autopilot.last_error}`);
  console.log("");
}

async function command(line) {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return;

  if (lower === "/help") return printHelp();
  if (lower === "/health") return printJson(await get("/health"));
  if (lower === "/status") return printJson(await get("/status"));
  if (lower === "/mission") return printJson(await get("/mission"));
  if (lower === "/opportunities") return printJson(await get("/opportunities"));
  if (lower === "/autopilot") return printJson(await get("/autopilot"));
  if (lower === "/ledger") return printJson(await get("/ledger/recent?limit=50"));
  if (lower === "/dashboard") return dashboard();

  if (lower === "/discover") {
    return printJson(await post("/discovery/run", undefined, true));
  }

  if (lower === "/run") {
    return printJson(await post("/autopilot/run", undefined, true));
  }

  if (lower.startsWith("/invoice ")) {
    const parts = trimmed.slice(9).trim().split(/\s+/);
    if (parts.length < 3) throw new Error("Usage: /invoice <opportunity_id> <amount> <description>");
    const [opportunity_id, amount, ...descriptionParts] = parts;
    return printJson(await post("/invoices", {
      opportunity_id,
      amount: Number(amount),
      currency: "USD",
      description: descriptionParts.join(" "),
    }, true));
  }

  if (lower.startsWith("/pipeline ")) {
    const match = trimmed.match(/^\/pipeline\s+(\S+)\s+(.+)$/i);
    if (!match) throw new Error("Usage: /pipeline <opportunity_id> <json-offer>");
    return printJson(await post("/pipeline", {
      opportunity_id: match[1],
      offer: JSON.parse(match[2]),
    }, true));
  }

  if (lower.startsWith("/advance ")) {
    const match = trimmed.match(/^\/advance\s+(\S+)\s+(\S+)\s+(.+)$/i);
    if (!match) throw new Error("Usage: /advance <opportunity_id> <stage> <json-evidence>");
    return printJson(await post(`/pipeline/${encodeURIComponent(match[1])}/advance`, {
      stage: match[2],
      evidence: JSON.parse(match[3]),
    }, true));
  }

  if (lower.startsWith("/paid ")) {
    const match = trimmed.match(/^\/paid\s+(\S+)\s+(.+)$/i);
    if (!match) throw new Error("Usage: /paid <opportunity_id> <json-evidence>");
    return printJson(await post(`/pipeline/${encodeURIComponent(match[1])}/payment-verified`, {
      evidence: JSON.parse(match[2]),
    }, true));
  }

  if (lower.startsWith("/browser ")) {
    const url = trimmed.slice(9).trim();
    if (!url) throw new Error("Usage: /browser <url>");
    return printJson(await post(`/browser/inspect?url=${encodeURIComponent(url)}`, undefined, true));
  }

  if (lower === "/shopify") {
    const [products, publications] = await Promise.all([
      get("/shopify/products"),
      get("/shopify/publications"),
    ]);
    return printJson({ products, publications });
  }

  if (lower === "/commercial") {
    return printJson(await get("/commercial/capabilities"));
  }

  if (lower === "/commercial-run") {
    return printJson(await post("/commercial/run-all", undefined, true));
  }

  if (lower.startsWith("/commercial ")) {
    const strategy = trimmed.slice(12).trim();
    if (!strategy) throw new Error("Usage: /commercial <strategy>");
    return printJson(await post("/commercial/execute", {
      strategy,
      opportunity_id: "manual-terminal",
    }, true));
  }

  const result = await post("/chat", { message: trimmed });
  console.log(`\nF.R.I.D.A.Y. > ${result.reply ?? JSON.stringify(result, null, 2)}`);
  if (result.provider || result.model) {
    console.log(`Provider: ${result.provider ?? "unknown"} | Model: ${result.model ?? "unknown"} | Attempts: ${result.attempts ?? "?"}`);
  }
  if (result.execution) {
    console.log("Execution:");
    printJson(result.execution);
  }
  console.log("");
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║          F.R.I.D.A.Y. V3 — 10×             ║");
  console.log("║             COMMAND TERMINAL                ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`Connected to: ${BASE}`);
  console.log("Type /help for commands. Type /exit to quit.\n");

  try {
    await command("/dashboard");
  } catch (error) {
    console.error(`Startup check failed: ${error.message}\n`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "YOU > ",
  });

  rl.prompt();

  let pasteBuffer = [];
  let pasteTimer = null;
  let processing = Promise.resolve();

  const processBatch = () => {
    const batch = pasteBuffer.join("\n").trim();
    pasteBuffer = [];
    pasteTimer = null;
    if (!batch) {
      rl.prompt();
      return;
    }

    processing = processing.then(async () => {
      if (batch.toLowerCase() === "/exit" || batch.toLowerCase() === "exit") {
        rl.close();
        return;
      }
      try {
        await command(batch);
      } catch (error) {
        console.error(`FRIDAY ERROR > ${error.message}\n`);
      }
      rl.prompt();
    });
  };

  rl.on("line", (line) => {
    const text = line.trim();

    // readline fires once per pasted line. Buffer lines arriving together so a
    // long pasted prompt is sent to F.R.I.D.A.Y. as one message.
    if (pasteTimer) clearTimeout(pasteTimer);

    if (!text && pasteBuffer.length === 0) {
      rl.prompt();
      return;
    }

    pasteBuffer.push(text);

    // A short debounce preserves normal interactive typing while grouping
    // multi-line paste operations into one request.
    pasteTimer = setTimeout(processBatch, 120);
  });

  rl.on("close", () => {
    if (pasteTimer) clearTimeout(pasteTimer);
    console.log("\nF.R.I.D.A.Y. session closed.");
  });
}

main().catch((error) => {
  console.error(`FRIDAY FATAL > ${error.message}`);
  process.exit(1);
});
