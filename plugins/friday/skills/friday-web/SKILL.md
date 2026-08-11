---
name: friday-web
description: >-
  F.R.I.D.A.Y. Web Search & Image Telemetry module \u2014 scrape the web for
  real-time information, summarize the consensus facts audibly, and push
  relevant image URLs into the conversation or a workspace folder. Load
  when the Boss asks F.R.I.D.A.Y. to search, look something up, scrape, or
  fetch image telemetry.
compatibility: "Designed for Vellum personal assistants"
metadata:
  emoji: "\U0001F6F0\uFE0F"
  vellum:
    category: "productivity"
    display-name: "F.R.I.D.A.Y. Web Search & Image Telemetry"
    activation-hints:
      - "F.R.I.D.A.Y. persona is active and the Boss asks to search / look up / find images"
    avoid-when:
      - "No F.R.I.D.A.Y. persona is active"
---

# F.R.I.D.A.Y. Web Search & Image Telemetry

1. **Search.** Use `web_search` for the consensus sweep (5\u201310 results).
2. **Read.** `web_fetch` the 1\u20132 most authoritative hits.
3. **Summarize audibly.** Distill into 1\u20133 sentences. No raw URLs aloud.
4. **Image telemetry.** Surface inline with `![](url)` or save to the workspace.

If a page is paywalled or can't be fetched, say so and move on.
