// tools/pantry_list.ts
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { loadPantry } from "../src/pantry.ts";
import { daysUntil, expiryLabel, type PantryItem } from "../src/storage.ts";

const LOCATION_ORDER = ["fridge", "freezer", "counter", "pantry"];

function formatItem(p: PantryItem): string {
  const qty =
    typeof p.quantity === "number"
      ? ` ${p.quantity}${p.unit ? " " + p.unit : ""}`
      : "";
  const label = expiryLabel(p.expires);
  const notes = p.notes ? ` (${p.notes})` : "";
  return `- ${p.name}${qty}${notes} ${label}`.trimEnd();
}

export default {
  description:
    "List the pantry inventory: what's in the fridge, freezer, pantry, and counter, sorted with soonest-expiring first. Filter by location, expiring window, or a search term. Use when the user asks what food they have, what's expiring, or before suggesting recipes or grocery lists.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        enum: ["fridge", "freezer", "pantry", "counter"],
        description: "Only show items in this location.",
      },
      expiring_within_days: {
        type: "number",
        description:
          "Only show items expiring within this many days (includes already-expired).",
      },
      query: {
        type: "string",
        description: "Filter by name substring, e.g. 'chicken'.",
      },
    },
    required: [],
  },
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    try {
      let items = loadPantry();
      const total = items.length;

      const location =
        typeof input.location === "string" ? input.location.toLowerCase() : "";
      if (location) items = items.filter((p) => p.location === location);

      const within =
        typeof input.expiring_within_days === "number"
          ? input.expiring_within_days
          : null;
      if (within !== null) {
        items = items.filter((p) => {
          const d = daysUntil(p.expires);
          return d !== null && d <= within;
        });
      }

      const query =
        typeof input.query === "string" ? input.query.toLowerCase().trim() : "";
      if (query) {
        items = items.filter((p) => p.name.toLowerCase().includes(query));
      }

      if (items.length === 0) {
        return {
          content:
            total === 0
              ? "The pantry is empty. Stock it with fridge_scan (photo) or pantry_update (manual add)."
              : "No items match those filters.",
          isError: false,
        };
      }

      const sortKey = (p: PantryItem) => daysUntil(p.expires) ?? 9999;
      const lines: string[] = [];
      for (const loc of LOCATION_ORDER) {
        const group = items
          .filter((p) => p.location === loc)
          .sort((a, b) => sortKey(a) - sortKey(b));
        if (group.length === 0) continue;
        lines.push(`${loc.toUpperCase()} (${group.length}):`);
        for (const p of group) lines.push(formatItem(p));
        lines.push("");
      }

      const expired = items.filter((p) => {
        const d = daysUntil(p.expires);
        return d !== null && d < 0;
      });
      if (expired.length > 0) {
        lines.push(
          `${expired.length} item(s) past their date. Consider pantry_update remove, or a use-it-up recipe if borderline.`,
        );
      }

      return { content: lines.join("\n").trim(), isError: false };
    } catch (err) {
      return {
        content: `error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
