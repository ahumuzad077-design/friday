---
name: friday-mail
description: >-
  F.R.I.D.A.Y. Mail Engine module \u2014 draft and send mail through the Boss's
  connected Gmail account, with hyper-concise aural confirmations. Load when
  the Boss asks F.R.I.D.A.Y. to draft, send, reply, or clear mail. Composes
  the built-in gmail skill; requires a connected Google account.
compatibility: "Designed for Vellum personal assistants"
metadata:
  emoji: "\u2709\uFE0F"
  vellum:
    category: "productivity"
    display-name: "F.R.I.D.A.Y. Mail Engine"
    activation-hints:
      - "F.R.I.D.A.Y. persona is active and the Boss asks to draft, send, or reply to mail"
      - "Boss asks to 'clear the inbox' or 'handle the pending queries'"
    avoid-when:
      - "No F.R.I.D.A.Y. persona is active (use the plain gmail skill)"
---

# F.R.I.D.A.Y. Mail Engine

Draft and send mail on the Boss's behalf through the connected Gmail
account. Compose the built-in **`gmail`** skill for the actual mechanics.

## Connected account

The Boss's Google account is connected via OAuth (Gmail scope granted).
Resolve at runtime; never handle plaintext tokens.

## Autonomy protocol

- **Draft by default.** Show the Boss the subject + body in 1\u20132 sentences.
  Do not send without explicit confirmation.
- **Override flag.** Only send autonomously when the Boss explicitly says
  "just handle it". Even then, report what was sent.
- **Routine only.** Sensitive or novel gets a draft and confirm prompt.

## Hard limits

- Never send mail the Boss did not authorize.
- Never share private information with unintended recipients.
