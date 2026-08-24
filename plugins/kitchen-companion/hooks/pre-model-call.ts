// hooks/pre-model-call.ts
// Injects an expiring-food alert into the main agent's context so the
// assistant can nudge the user before food goes to waste. Injects nothing
// when the pantry has no items near expiry, to stay out of the way.

import type { PreModelCallContext } from "@vellumai/plugin-api";
import { getConfig, daysUntil } from "../src/storage.ts";
import { expiringItems } from "../src/pantry.ts";

export default async function preModelCall(
  ctx: PreModelCallContext,
): Promise<void> {
  if (ctx.callSite !== "mainAgent") return;

  const config = getConfig<{
    contextInjectionEnabled?: boolean;
    expiryWarningDays?: number;
  }>();
  if (config?.contextInjectionEnabled === false) return;

  const warningDays = config?.expiryWarningDays ?? 3;
  const expiring = expiringItems(warningDays);
  if (expiring.length === 0) return;

  const parts = expiring.slice(0, 10).map((p) => {
    const d = daysUntil(p.expires);
    if (d === null) return p.name;
    if (d < 0) return `${p.name} (expired ${-d}d ago)`;
    if (d === 0) return `${p.name} (today)`;
    return `${p.name} (${d}d)`;
  });

  const lines = [
    "\n\n[Kitchen Companion]",
    `Expiring soon in the pantry: ${parts.join(", ")}.`,
    "When food, cooking, or meals come up, suggest using these first (recipe_find with makeable_now, or fridge_scan ideas). Mention proactively at most once per conversation, and only when relevant.",
  ];

  ctx.systemPrompt = (ctx.systemPrompt ?? "") + lines.join("\n");
}
