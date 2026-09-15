# F.R.I.D.A.Y. V2 — Build Prompt

Build F.R.I.D.A.Y. V2 as a production-ready autonomous business intelligence and execution platform.

## Non-negotiable truthfulness rule
Never simulate, fabricate, estimate-as-fact, or display fictional cash, revenue, orders, customers, profits, payments, trades, or transaction confirmations. If an event has not been confirmed by a real provider, its value must be `0` or clearly labeled as a forecast/target. Forecasts and targets must never appear in the actual cash/revenue ledger.

## Current-state correction
The existing V2 engine previously split a weekly revenue target into fictional dropshipping and trading revenue and logged those values as if processed. That has been removed. The V2 runtime must remain analysis-only until real integrations are implemented and independently confirmed.

## Core system
Build these modules:
1. Opportunity discovery and market research.
2. Product/service opportunity scoring.
3. Lead discovery using permitted, compliant sources.
4. Marketing/content generation.
5. Sales pipeline and CRM.
6. Real payment integration, only when credentials and provider confirmations exist.
7. Real order/invoice tracking.
8. Analytics dashboard separating actuals from forecasts and targets.
9. AI planning and task orchestration.
10. Long-term memory and audit logs.
11. Monitoring, health checks, retries, and error reporting.
12. Human approval gates for consequential actions.

## Financial ledger
Maintain separate fields/tables for:
- confirmed_revenue
- confirmed_expenses
- confirmed_profit
- forecast_revenue
- target_revenue
- pending_revenue

Only provider-confirmed transactions may enter confirmed financial fields. Every transaction needs a provider reference, timestamp, currency, amount, status, and source. Never use a hard-coded fallback price or revenue number and call it real.

## Trading
Market data may be collected for research. Do not execute trades, move funds, or claim trading profits unless a real, authorized exchange integration is deliberately configured and the transaction is confirmed by the provider. Default mode is `PAPERLESS_ANALYSIS_ONLY` / no execution.

## Security
- Keep secrets out of source code and Git history.
- Load credentials from secure environment/deployment secrets.
- Validate all required environment variables at startup.
- Never print API keys, private keys, passwords, access tokens, or wallet secrets.
- Add authentication and authorization before exposing sensitive operations.
- Add rate limiting and request validation to public endpoints.

## Reliability
- Fail closed when required credentials or provider confirmations are missing.
- Do not silently substitute fake market or financial values after an API failure.
- Add structured logs with correlation IDs.
- Make database writes atomic where appropriate.
- Add graceful shutdown handling.
- Add automated tests for financial invariants and error paths.
- Add `/health` and `/ready` endpoints.

## Revenue goal
The long-term ambition is to build a system capable of scaling to substantial legitimate revenue. Do not promise or manufacture results. Start with measurable milestones such as first real customer, first $100, first $1,000, then scale only when unit economics and demand support it. The $10,000/week and $25M/month figures are strategic aspirations, not guaranteed outcomes.

## Definition of done
The system is not complete merely because it runs. It must:
- start without uncaught errors;
- pass tests;
- distinguish actual money from targets/forecasts;
- never report fictional cash as real;
- protect credentials;
- expose only authorized actions;
- record auditable evidence for real transactions;
- recover cleanly from provider/database failures;
- provide a clear dashboard of what actually happened.

Before each release, run dependency checks, tests, linting, and a financial-integrity test suite. If any check fails, stop the release and fix the problem rather than masking it.
