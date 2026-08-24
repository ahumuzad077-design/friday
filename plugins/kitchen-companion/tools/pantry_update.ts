// tools/pantry_update.ts
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { addItems, useItems, type ItemInput } from "../src/pantry.ts";

export default {
  description:
    "Add, use up, or remove pantry items. Use 'add' when the user buys groceries or mentions new food, 'use' when they cook with or eat something (decrements quantity, removes at zero), and 'remove' to delete items outright (thrown out, expired). Accepts a batch of items in one call. Expiry dates power the expiring-soon alerts.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "use", "remove"],
        description: "What to do with the listed items.",
      },
      items: {
        type: "array",
        description: "The items to add, use, or remove.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Item name, e.g. 'chicken thighs', 'greek yogurt'.",
            },
            quantity: {
              type: "number",
              description:
                "Numeric amount, e.g. 6 (eggs) or 0.5 (kg). For 'use', how much was consumed.",
            },
            unit: {
              type: "string",
              description: "Unit for the quantity, e.g. 'pcs', 'kg', 'cups', 'jar'.",
            },
            category: {
              type: "string",
              description:
                "One of: produce, dairy, meat, seafood, grains, condiments, beverages, leftovers, frozen, baked, snacks, other.",
            },
            location: {
              type: "string",
              enum: ["fridge", "freezer", "pantry", "counter"],
              description: "Where the item lives. Default fridge.",
            },
            expires: {
              type: "string",
              description:
                "Expiry or use-by date, YYYY-MM-DD. Estimate realistically when the user doesn't say (fresh greens a few days, meat 2-3 days, condiments months).",
            },
            notes: {
              type: "string",
              description: "Optional note, e.g. 'opened', 'half used'.",
            },
          },
          required: ["name"],
        },
      },
    },
    required: ["action", "items"],
  },
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    const action = String(input.action ?? "").trim();
    const items = Array.isArray(input.items)
      ? (input.items as ItemInput[]).filter(
          (i) => i && typeof i.name === "string" && i.name.trim(),
        )
      : [];
    if (items.length === 0) {
      return { content: "error: items must be a non-empty array", isError: true };
    }

    try {
      if (action === "add") {
        const { added, updated } = addItems(items);
        const parts: string[] = [];
        if (added.length > 0) parts.push(`Added: ${added.join(", ")}`);
        if (updated.length > 0) parts.push(`Updated: ${updated.join(", ")}`);
        return {
          content: parts.join("\n") || "Nothing to add.",
          isError: false,
        };
      }
      if (action === "use" || action === "remove") {
        const { used, removed, notFound } = useItems(items, action === "remove");
        const parts: string[] = [];
        if (used.length > 0) parts.push(`Used: ${used.join(", ")}`);
        if (removed.length > 0)
          parts.push(`Removed from pantry: ${removed.join(", ")}`);
        if (notFound.length > 0)
          parts.push(`Not found in pantry: ${notFound.join(", ")}`);
        return {
          content: parts.join("\n") || "Nothing changed.",
          isError: false,
        };
      }
      return {
        content: `error: unknown action "${action}". Use add, use, or remove.`,
        isError: true,
      };
    } catch (err) {
      return {
        content: `error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
