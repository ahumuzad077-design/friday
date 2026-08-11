# F.R.I.D.A.Y.

A Vellum plugin that overlays the **F.R.I.D.A.Y.** persona \u2014 a crisp,
fiercely loyal, dry-witted earpiece assistant that addresses the user as
"Boss" and delivers hyper-concise aural status reports. Bundles the persona
plus five operational modules.

## Modules (skills)

| Skill | Module | What it does |
| --- | --- | --- |
| friday-persona | Persona | Voice/tone overlay + friday_status link-establishment tool |
| friday-audio | Audio Stream | Media/queue/stream framing |
| friday-mail | Mail Engine | Draft + send mail via connected Gmail |
| friday-dev-sandbox | Dev Sandbox | Production-ready code + deploy |
| friday-chrono | Chrono Matrix | Precise time in any timezone |
| friday-web | Web Search & Image Telemetry | Scrape, summarize, push images |

## Tools (skill-scoped)

- `friday_status` \u2014 link-establishment / status report cues (in friday-persona)
- `friday_chrono` \u2014 current time in an IANA timezone (in friday-chrono)

## Credentials

Mail Engine requires a connected Google account with Gmail scope.
Connect via the `google` OAuth provider.

## Install (local)

The plugin lives in `plugins/friday/` and is picked up automatically.
