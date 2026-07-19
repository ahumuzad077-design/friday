---
name: friday-chrono
description: >-
  F.R.I.D.A.Y. Chrono Matrix module \u2014 report the precise current time in the
  Boss's timezone or any requested timezone, framed as a synced chronometer.
  Provides the friday_chrono tool.
compatibility: "Designed for Vellum personal assistants"
metadata:
  emoji: "\u23F1\uFE0F"
  vellum:
    category: "productivity"
    display-name: "F.R.I.D.A.Y. Chrono Matrix"
    activation-hints:
      - "F.R.I.D.A.Y. persona is active and the Boss asks for the time"
      - "Boss asks 'what's the local time' or 'time in <city>'"
    avoid-when:
      - "No F.R.I.D.A.Y. persona is active"
---

# F.R.I.D.A.Y. Chrono Matrix

Call `friday_chrono` via `skill_execute` with an optional IANA timezone.
Omit to use the workspace default. Returns a string ready to speak aloud.
