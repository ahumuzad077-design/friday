# F.R.I.D.A.Y. V3 — Chat and Command Guide

## What V3 is

V3 is the production foundation for F.R.I.D.A.Y. It keeps financial progress tied to verified payment evidence. It does not treat plans, leads, invoices, simulated orders, or model output as revenue.

## Railway setup

Set these as Railway Variables. Never commit `.env` or paste secrets into chat.

- `CAPITAL_TARGET_AMOUNT=1000000`
- `CAPITAL_TARGET_CURRENCY=USD`
- `CAPITAL_TARGET_DEADLINE=2026-10-28`
- `LIVE_MODE=false` until real integrations have been checked
- `PADDLE_API_KEY=<your Paddle server-side API key>`
- `PADDLE_WEBHOOK_SECRET=<your Paddle notification destination secret>`
- `PADDLE_API_BASE=https://sandbox-api.paddle.com` for sandbox, or `https://api.paddle.com` for live
- `PADDLE_API_VERSION=1`
- `AI_PROVIDER_ORDER=openrouter,groq,gemini,nvidia,xai,openai`
- one or more provider keys, starting with a free provider

For a Railway API service, use:

```text
uvicorn friday_core.api_v2:app --host 0.0.0.0 --port $PORT
```

For a worker service, use:

```text
python worker_v2.py
```

## Chat with Friday

### Option 1 — terminal

After the API is running:

```text
set FRIDAY_URL=https://YOUR-RAILWAY-DOMAIN
python friday_chat.py
```

Windows PowerShell:

```powershell
$env:FRIDAY_URL="https://YOUR-RAILWAY-DOMAIN"
python friday_chat.py
```

Linux/macOS:

```bash
export FRIDAY_URL="https://YOUR-RAILWAY-DOMAIN"
python friday_chat.py
```

Then type normally:

```text
You> Give me today's verified revenue, active opportunities, blockers, and the next actions I should approve.
```

Or one command directly:

```text
python friday_chat.py "Audit the current revenue engine and tell me what is verified, what is only planned, and what is blocked."
```

### Option 2 — HTTP chat endpoint

Send a POST request to `/chat` with:

```json
{"message":"What should I work on next to create legitimate revenue?"}
```

The response includes Friday's reply, the provider/model used, and the number of provider attempts.

## First prompts to give Friday

Use these in order after deployment.

### Prompt 1 — system audit

```text
FRIDAY, run a full V3 readiness audit. Report only facts you can verify from the current system. Check AI provider availability, payment configuration, goal configuration, ledger health, opportunity portfolio, outbound execution readiness, and deployment readiness. Separate VERIFIED, READY, BLOCKED, and NEEDS-HUMAN-ACTION. Do not invent revenue or claim an action happened unless the system evidence proves it.
```

### Prompt 2 — revenue engine

```text
FRIDAY, build the current legitimate-revenue execution queue for my capital goal. Prioritize activities that can produce real customer payments with minimal upfront cost. For every opportunity state: customer type, offer, expected price, acquisition path, required human approval, required integration, next action, and evidence needed before revenue can be counted. Do not include grants, sponsorships, fake orders, fake customers, or simulated revenue.
```

### Prompt 3 — payment readiness

```text
FRIDAY, verify the payment path from offer to Paddle transaction to signed webhook to verified ledger entry. Tell me exactly what is configured, what is missing, and what test I should perform next. Never mark a payment as revenue from an invoice or checkout alone; only a verified provider event may update financial progress.
```

### Prompt 4 — opportunity execution

```text
FRIDAY, take the highest-value legitimate opportunities that are actually executable with the integrations currently available. Create a step-by-step queue. For each step distinguish what you can do automatically from what needs my approval. Keep an evidence trail for every completed action and stop rather than guessing when an integration is unavailable.
```

### Prompt 5 — daily operating review

```text
FRIDAY, produce today's operating report: verified revenue, verified payment events, invoices issued, checkouts created, opportunities discovered, opportunities progressed, customer responses, blockers, provider failures, and the next five highest-priority actions. Reconcile every financial number against the ledger.
```

## GitHub workflow

GitHub is the source-code/control plane, not the live chat channel. Use the repository for code, branches, pull requests, tests, and deployment configuration. Use the deployed Railway API or `friday_chat.py` to talk to the running agent.

Branch:

`friday-v3-10x-capital-engine`

Repository:

`https://github.com/ahumuzad077-design/friday`

## Important payment rule

Paddle's API uses Bearer authentication for server-side API keys. Pin API requests with `Paddle-Version: 1`. `transaction.paid` is emitted when payment has been captured; `transaction.completed` follows when Paddle has fully processed the transaction. F.R.I.D.A.Y. records only a provider-verified event in its ledger.

## Security rule

Keep all API keys, webhook secrets, passwords, wallet private keys, and similar credentials in Railway Variables or another secret manager. The repository contains capability code and configuration names, not live secrets. Exposed credentials must not be treated as safe merely because the integration remains enabled.
