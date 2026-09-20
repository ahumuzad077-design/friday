# ORBITA

ORBITA is the fundraising and business-operations module of F.R.I.D.A.Y.

## Runtime

- Node.js 20+
- npm
- No Python runtime required for ORBITA
- Native Node HTTP server
- JSON persistence for the initial prototype

## Current capabilities

- ORBITA health/status API
- Investor CRM records
- Task tracking
- Persistent activity log
- Background heartbeat worker
- Approval queue for legally binding or high-impact actions
- Public-offer lock defaults to disabled

## Run

```bash
cd orbita
npm test
npm start
```

The API defaults to port 3010.

## Safety gates

ORBITA does not autonomously sign contracts, issue/transfer shares, make major financial transfers, or launch a public securities offer. Those actions become approval requests.

## Next build stages

1. Durable production database
2. Friday command-router integration
3. Investor discovery/research adapters
4. Email adapter
5. Calendar/meeting adapter
6. Scheduled follow-up engine
7. Railway worker/service deployment
8. Observability and audit reporting
