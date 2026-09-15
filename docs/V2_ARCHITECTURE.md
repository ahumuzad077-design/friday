# F.R.I.D.A.Y. v2 architecture

## Principle

A requested amount is an objective, not proof of income. F.R.I.D.A.Y. may plan and execute legitimate opportunities, but only independently verified payment events increase financial progress.

## Layers

1. **Goal engine** — accepts any positive target and deadline.
2. **Opportunity engine** — generates opportunities across services, sales, lead generation, ecommerce, digital products, affiliate, sponsorships, grants and enterprise work.
3. **Portfolio scorer** — ranks opportunities using expected value, probability, speed, cost and risk.
4. **Provider router** — selects available AI/reasoning providers and supports graceful fallback.
5. **Execution adapters** — perform real actions through approved APIs. These are separate from reasoning.
6. **Evidence/payment verification** — validates orders, invoices, payment webhooks, receipts, contract awards or blockchain confirmations.
7. **Revenue ledger** — records immutable-style financial events and only VERIFIED events affect goal progress.
8. **Learning layer** — measures attempts, responses, conversions, verified revenue, cost and time-to-cash by strategy.

## State model

`PLANNED -> READY -> EXECUTING -> SUBMITTED -> AWAITING_PAYMENT -> PAYMENT_DETECTED -> VERIFIED`

Failure states are `FAILED` and `CANCELLED`. A task being completed by an AI model is never equivalent to `VERIFIED` revenue.

## Scaling

The architecture is amount-agnostic. A $100 target and a $1,000,000 target use the same goal model. Larger targets should cause F.R.I.D.A.Y. to build a larger opportunity portfolio and seek larger contracts/funding opportunities, not manufacture larger progress numbers.

## Production deployment

For Railway, use a persistent API service, a separate always-on worker for long-running agent tasks, Postgres for durable state and Redis for job distribution. Scheduled cleanup/report jobs can be Railway Cron services. This matches Railway's recommended async-agent architecture.
