# F.R.I.D.A.Y. v2 deployment

## Zero-budget-first mode

Set `LIVE_MODE=false` until the integration tests and payment webhook are configured. At least one LLM provider should be configured. OpenRouter can use `openrouter/free`; Gemini is optional and can remain blank. OpenAI is optional and should not be required for the system to boot.

## Railway services

Use two services from the same repository:

### API service

Install `requirements-v2.txt` and start:

```bash
uvicorn friday_core.api_v2:app --host 0.0.0.0 --port $PORT
```

Expose the public domain for the API service. Configure the Paddle webhook URL as:

```text
https://YOUR_DOMAIN/payments/paddle/webhook
```

### Worker service

Start:

```bash
python worker_v2.py
```

The worker should be an always-on service, not a cron job. It plans/reconciles work; payment webhooks are handled by the API service.

## Payment setup

1. Create a Paddle API key with only the permissions required by the integration.
2. Create a Paddle notification destination for the webhook endpoint.
3. Put the notification destination secret in `PADDLE_WEBHOOK_SECRET`.
4. Put the API key in `PADDLE_API_KEY`.
5. Configure Paddle price IDs for products/services before creating checkouts.

Paddle webhook signatures are checked against the raw request body. F.R.I.D.A.Y. accepts only verified `transaction.paid` or `transaction.completed` events into the revenue ledger.

## Database evolution

The current v2 prototype uses SQLite for simple zero-cost deployment. For production scale, attach Railway Postgres and Redis and migrate the ledger/invoice/task stores to Postgres plus a Redis queue. This follows Railway's recommended API + worker + Postgres + Redis architecture for long-running agents.

## Financial truth rules

- A plan is not revenue.
- An invoice is not revenue.
- A checkout click is not revenue.
- An order created is not revenue.
- Only independently verified payment evidence can create a `VERIFIED` revenue event.
- Simulated/test events must never update verified progress.
- Wallet/private-key operations remain outside the autonomous goal loop.
