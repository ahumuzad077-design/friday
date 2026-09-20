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
  /providers                      AI provider health/cooldowns
  /mission                        Mission queue and targets
  /opportunities                  Current opportunity portfolio
  /autopilot                      Autopilot status
  /ledger                         Recent verified ledger events
  /dashboard                      Compact progress dashboard
  /capacity                       Current operating capacity (no old mission)
  /new-mission <target> <deadline> Replace active mission for this V3 process
  /discover                       Run discovery (needs control token)
  /run                            Run one autopilot cycle (needs control token)
  /invoice <opp> <amount> <desc>  Create an invoice (needs control token)
  /pipeline <opp> <json>          Create a revenue pipeline (needs control token)
  /advance <opp> <stage> <json>   Advance a pipeline (needs control token)
  /paid <opp> <json>              Mark payment verified (needs control token)
  /browser <url>                  Inspect a website (needs control token)
  /shopify                       Shopify products/publications
  /jobs                            Recent invited jobs
  /job <url> [instruction]          Add a job link
  /job-status <job-id>              Show an invited job
  /job-run <job-id>                 Prepare the job for execution (needs control token)
  /commercial                     Commercial capability coverage
  /commercial-run                Run all commercial handlers (needs control token)
  /commercial <strategy>          Run one commercial handler (needs control token)
  /audit                          Evidence-only audit
  /audit-run                      Evidence audit + execute authorized low-risk cycle
  /sales-status                    Sales/outreach status
  /sales-run                       Run live outreach (needs control token)
  /email-status                    Resend email configuration
  /email-test <email>              Send one controlled test email (needs control token)
  /launch <strategy> <amount> <description>  Create offer + checkout (needs control token)
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
  if (lower === "/providers") return printJson(await get("/providers"));
  if (lower === "/mission") return printJson(await get("/mission"));
  if (lower === "/opportunities") return printJson(await get("/opportunities"));
  if (lower === "/autopilot") return printJson(await get("/autopilot"));
  if (lower === "/ledger") return printJson(await get("/ledger/recent?limit=50"));
  if (lower === "/dashboard") return dashboard();

  if (lower === "/capacity") {
    return printJson(await get("/capacity"));
  }

  if (lower.startsWith("/new-mission ")) {
    const parts = trimmed.split(/\\s+/);
    if (parts.length < 3) {
      throw new Error("Usage: /new-mission <target-usd> <deadline-YYYY-MM-DD> [objective]");
    }
    const target = Number(parts[1]);
    const deadline = parts[2];
    const objective = parts.slice(3).join(" ");
    return printJson(await post("/mission/new", {
      target,
      currency: "USD",
      deadline,
      name: "Terminal Mission",
      objective,
    }, false));
  }

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

  if (lower === "/jobs") {
    return printJson(await get("/jobs?limit=50"));
  }

  if (lower.startsWith("/job-status ")) {
    const jobId = trimmed.slice(12).trim();
    if (!jobId) throw new Error("Usage: /job-status <job-id>");
    return printJson(await get(`/jobs/${encodeURIComponent(jobId)}`));
  }

  if (lower.startsWith("/job ")) {
    const rest = trimmed.slice(5).trim();
    const urlMatch = rest.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) throw new Error("Usage: /job <url> [instruction]");
    const url = urlMatch[0].replace(/[.,!?;]+$/, "");
    const instruction = rest.slice((urlMatch.index ?? 0) + urlMatch[0].length).trim();
    return printJson(await post("/jobs/intake", { url, instruction }, false));
  }

  if (lower.startsWith("/job-run ")) {
    const jobId = trimmed.slice(9).trim();
    if (!jobId) throw new Error("Usage: /job-run <job-id>");
    return printJson(await post(`/jobs/${encodeURIComponent(jobId)}/execute`, undefined, true));
  }

  if (lower === "/sales-status") {
    return printJson(await get("/sales/status"));
  }

  if (lower === "/sales-run") {
    return printJson(await post("/sales/run", undefined, true));
  }

  if (lower === "/email-status") {
    return printJson(await get("/email/status"));
  }

  if (lower.startsWith("/email-test ")) {
    const recipient = trimmed.slice(12).trim();
    if (!recipient || !recipient.includes("@")) throw new Error("Usage: /email-test <email>");
    const key = `terminal-test-${Date.now()}`;
    const html = "<p>F.R.I.D.A.Y. V3 email test.</p><p>This confirms the Resend delivery path is configured and reachable.</p>";
    return printJson(await post("/email/send", {
      recipient,
      subject: "F.R.I.D.A.Y. V3 Email Test",
      html,
      idempotency_key: key,
    }, true));
  }

  if (lower === "/check") {
    return printJson(await get("/system-check"));
  }

  if (lower === "/commercial") {
    return printJson(await get("/commercial/capabilities"));
  }

  if (lower === "/commercial-run") {
    return printJson(await post("/commercial/run-all", undefined, true));
  }

  if (lower === "/audit") {
    return printJson(await get("/audit"));
  }

  if (lower === "/audit-run") {
    return printJson(await post("/audit/run", undefined, true));
  }

  if (lower.startsWith("/commercial ")) {
    const strategy = trimmed.slice(12).trim();
    if (!strategy) throw new Error("Usage: /commercial <strategy>");
    return printJson(await post("/commercial/execute", {
      strategy,
      opportunity_id: "manual-terminal",
    }, true));
  }

  if (lower.startsWith("/launch ")) {
    const match = trimmed.match(/^\/launch\s+(\S+)\s+(\S+)\s+(.+)$/i);
    if (!match) throw new Error("Usage: /launch <strategy> <amount> <description>");
    return printJson(await post("/commercial/launch", {
      strategy: match[1],
      opportunity_id: "manual-launch",
      amount: Number(match[2]),
      description: match[3],
    }, true));
  }

  try {
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
  } catch (error) {
    try {
      const status = await get("/status");
      const mission = await get("/mission");
      const goal = status.goal || {};
      const auto = status.autopilot || {};
      const commercial = status.commercial_execution || {};
      const providers = status.providers || [];
      console.log("\nF.R.I.D.A.Y. > AI providers are temporarily unavailable, but V3 command mode is online.");
      console.log(`Verified revenue: ${goal.verified_progress ?? 0} ${goal.currency ?? "USD"}`);
      console.log(`Target: ${goal.target ?? "unknown"} ${goal.currency ?? ""}`);
      console.log(`Autopilot: ${auto.running ? "RUNNING" : "STOPPED"} | cycles: ${auto.cycles ?? 0}`);
      console.log(`Commercial handlers: ${commercial.capability_count ?? 0}`);
      console.log(`Providers available: ${providers.filter(p => p.available).map(p => p.provider).join(", ") || "none"}`);
      console.log(`Mission queue: ${(mission.queue || []).length} item(s)`);
      console.log("Use /dashboard, /mission, /providers, /commercial, or /check while the AI layer recovers.\n");
    } catch (fallbackError) {
      console.log(`FRIDAY ERROR > ${error.message}`);
      console.log(`Fallback status check failed > ${fallbackError.message}\n`);
    }
  }
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
