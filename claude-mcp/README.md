# F.R.I.D.A.Y. Claude MCP Port

A fully functional port of the F.R.I.D.A.Y. system to Claude's Model Context Protocol (MCP).

This implementation extracts the core business logic from the Vellum plugins and rebuilds them as Claude MCP servers, maintaining feature parity while adapting to Claude's architecture.

## What's Included

### Core Servers
- **cofounder-mcp** — AI co-founder with company context, decision tracking, OKR management
- **admin-copilot-mcp** — Proactive chief-of-staff with morning digests, email triage, competitor tracking
- **friday-persona-mcp** — F.R.I.D.A.Y. voice/tone personality overlay

### Architecture

```
claude-mcp/
├── README.md                          (this file)
├── package.json                       (monorepo root)
├── pnpm-workspace.yaml               (workspace config)
├── tsconfig.json                      (shared TypeScript config)
│
├── packages/
│   ├── cofounder-server/
│   │   ├── src/
│   │   │   ├── index.ts              (MCP server entry point)
│   │   │   ├── state.ts              (state management - disk-based)
│   │   │   ├── tools.ts              (tool definitions for Claude)
│   │   │   ├── resources.ts          (resource definitions)
│   │   │   ├── logic/
│   │   │   │   ├── decisions.ts      (decision CRUD + search)
│   │   │   │   ├── okrs.ts           (OKR tracking)
│   │   │   │   ├── profile.ts        (company profile management)
│   │   │   │   └── context.ts        (context injection)
│   │   │   └── types.ts              (TypeScript interfaces)
│   │   ├── data/                     (runtime state - generated)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── admin-copilot-server/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── state.ts
│   │   │   ├── tools.ts
│   │   │   ├── resources.ts
│   │   │   ├── logic/
│   │   │   │   ├── digest.ts         (morning briefing generation)
│   │   │   │   ├── inbox.ts          (email triage logic)
│   │   │   │   ├── competitor.ts     (competitor tracking + diffing)
│   │   │   │   └── scheduler.ts      (proactive schedule management)
│   │   │   └── types.ts
│   │   ├── data/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── friday-persona-server/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── persona.ts            (F.R.I.D.A.Y. voice rules)
│   │   │   ├── tools.ts              (friday_status, etc.)
│   │   │   ├── modules.ts            (module activation logic)
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/
│       ├── src/
│       │   ├── types.ts              (shared types across servers)
│       │   ├── storage.ts            (disk I/O utilities)
│       │   ├── logger.ts             (logging)
│       │   └── constants.ts          (shared constants)
│       ├── package.json
│       └── tsconfig.json
│
├── examples/
│   ├── claude-config.json             (example Claude MCP config)
│   ├── cofounder-example.ts           (example: using cofounder server)
│   ├── admin-copilot-example.ts       (example: using admin-copilot)
│   └── combined-example.ts            (example: all servers together)
│
└── docs/
    ├── ARCHITECTURE.md                (MCP architecture decisions)
    ├── PORTING.md                     (how we ported from Vellum)
    ├── SETUP.md                       (installation & getting started)
    └── TOOL_REFERENCE.md              (all available tools)
```

## Quick Start

### Prerequisites
- Node.js ≥20.12.0
- pnpm (or npm/yarn)
- Claude Desktop or Claude API access

### Installation

```bash
# Clone the repo and switch to the port branch
git clone https://github.com/ahumuzad077-design/friday.git
cd friday
git checkout claude-mcp-port

# Install dependencies
pnpm install

# Build all servers
pnpm build
```

### Configure Claude to Use These Servers

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "cofounder": {
      "command": "node",
      "args": ["path/to/friday/claude-mcp/packages/cofounder-server/dist/index.js"]
    },
    "admin-copilot": {
      "command": "node",
      "args": ["path/to/friday/claude-mcp/packages/admin-copilot-server/dist/index.js"]
    },
    "friday": {
      "command": "node",
      "args": ["path/to/friday/claude-mcp/packages/friday-persona-server/dist/index.js"]
    }
  }
}
```

### Use in Claude

Once configured, Claude will have access to all tools from these servers:

```
User: Set up my co-founder. I'm running a SaaS startup.

Claude: I'll get you set up. Let me create your company profile...
[Uses cofounder_profile tool]

Your company context is now active. Every conversation will include:
- Your company name and stage
- Current challenges and focus areas
- Strategic decisions you've made
- OKR progress
```

## Server Descriptions

### Cofounder Server

**What it does:**
- Maintains a persistent company profile (name, stage, sector, team, funding, challenges)
- Tracks strategic decisions with rationale and alternatives considered
- Manages quarterly OKRs with progress tracking
- Injects company context into every conversation
- Surfaces blind spots during decision-making
- Generates board-meeting-style briefings

**Tools available:**
- `cofounder_profile` — View/update company details
- `cofounder_decision` — Log, search, review decisions
- `cofounder_okr` — Set and track quarterly goals
- `cofounder_blindspot` — Analyze a proposed decision for risks
- `cofounder_briefing` — Generate a status briefing
- `cofounder_context_inject` — Get the current context block

**Data location:** `packages/cofounder-server/data/company-state.json`

### Admin-Copilot Server

**What it does:**
- Generates morning digests (calendar, email triage, competitor deltas, follow-ups)
- Manages email triage with propose-then-confirm actions
- Tracks competitor changes week-over-week
- Schedules proactive briefings
- Stores preferences (which competitors to watch, digest timing, etc.)

**Tools available:**
- `admin_digest` — Generate a morning briefing
- `admin_inbox_triage` — Propose email actions
- `admin_competitor_brief` — Weekly competitor tracking
- `admin_set_preferences` — Configure admin-copilot
- `admin_get_preferences` — View current preferences

**Data location:** `packages/admin-copilot-server/data/`

### Friday Persona Server

**What it does:**
- Overlays the F.R.I.D.A.Y. voice/tone (crisp, dry wit, "Boss" address)
- Provides aural action cues and earpiece-style framing
- Manages module activation (Audio, Mail, Dev Sandbox, Chrono, Web)
- Establishes the link on first activation

**Tools available:**
- `friday_status` — Link establishment & status report cues
- `friday_module_activate` — Activate a module (mail, dev, etc.)
- `friday_module_deactivate` — Deactivate a module

**Note:** The persona itself is a voice overlay—it doesn't add prompt cost because it's just tone/framing rules, not a separate chatbot.

## Porting Notes

### What Changed

**Vellum → Claude MCP:**
- ✅ **Skills** → MCP Tools (called by Claude, not by skill manifest)
- ✅ **Hooks** → Initialization + context injection on tool calls
- ✅ **Tools** → MCP tools (same concept, now at the protocol level)
- ✅ **State management** → Same (disk-based, fresh-load pattern)
- ✅ **Proactivity** → Scheduled via external triggers (Claude conversation, cron, webhooks)
- ❌ **Apps (Preact)** → Not ported (Claude doesn't have a UI panel; data is text-based)
- ❌ **Routes** → Not needed (MCP servers don't serve HTTP; they communicate via stdio)

### What Stayed the Same

- Core business logic (decision tracking, OKR management, competitor diffing)
- State persistence patterns (disk I/O, atomic writes)
- Data models (CompanyState, Decision, OKR interfaces)
- Skill instruction philosophy (context injection, activation hints as tool selection logic)

## Development

### Building

```bash
# Build all servers
pnpm build

# Build one server
cd packages/cofounder-server && pnpm build

# Watch mode (for development)
pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Test one server
cd packages/cofounder-server && pnpm test
```

### Adding a New Tool

1. Define the tool in `packages/<server>/src/tools.ts` (MCP ToolDefinition)
2. Implement the handler in `packages/<server>/src/index.ts` (within the server loop)
3. Add supporting logic to `packages/<server>/src/logic/*.ts` as needed
4. Export the tool from the server
5. Test with Claude

## Limitations & Future Work

### Current Limitations

1. **No UI apps** — The Preact dashboard apps from the original aren't ported. Data is accessed via Claude chat.
2. **Proactivity is manual** — Scheduled digests require external triggers (cron, Claude conversation starters, webhooks). Vellum's model-mediated scheduling isn't available in MCP.
3. **Gmail/Calendar integration** — Requires you to provide API credentials and connection logic (not included).
4. **Single-user** — Each server instance is single-user (state is workspace-wide, not per-conversation). For multi-user, you'd need per-user data directories.

### Planned

- [ ] Webhook support for external triggers (competitor tracking runs via webhook)
- [ ] SQLite backend option (instead of JSON files)
- [ ] Gmail/Calendar connector examples
- [ ] Claude system prompt templates for each server
- [ ] Web UI dashboard (separate Next.js app)

## License

MIT — Same as the original Vellum plugins.

## Questions?

See [SETUP.md](docs/SETUP.md) for detailed installation and [ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the port works.
