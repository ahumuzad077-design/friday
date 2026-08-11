// tools/fridge_scan.ts
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { loadImage, scanFridge, type FridgeScan } from "../src/vision.ts";
import {
  addItems,
  loadPantry,
  normalizeLocation,
  type ItemInput,
} from "../src/pantry.ts";
import { todayISO } from "../src/storage.ts";

function expiryDate(days: number | null): string | null {
  if (days === null || !Number.isFinite(days)) return null;
  const d = new Date(todayISO() + "T00:00:00");
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

function formatScan(scan: FridgeScan, stocked: string[], updated: string[]): string {
  if (!scan.has_food) {
    return "No identifiable food in that photo. Nothing was stocked.";
  }
  const lines: string[] = [];
  lines.push(`Found ${scan.items.length} item(s):`);
  for (const item of scan.items) {
    const bits = [
      item.quantity,
      item.category !== "other" ? item.category : "",
      item.freshness,
      item.confidence !== "high" ? `confidence: ${item.confidence}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`- ${item.name}${bits ? ` (${bits})` : ""}`);
  }

  if (stocked.length > 0 || updated.length > 0) {
    lines.push("");
    if (stocked.length > 0) lines.push(`Stocked in pantry: ${stocked.join(", ")}`);
    if (updated.length > 0) lines.push(`Updated existing: ${updated.join(", ")}`);
  }

  if (scan.recipe_ideas.length > 0) {
    lines.push("");
    lines.push("You can make right now:");
    scan.recipe_ideas.forEach((idea, i) => {
      const time = idea.time_minutes ? ` (~${idea.time_minutes} min)` : "";
      lines.push(`${i + 1}. ${idea.title}${time}`);
      lines.push(`   ${idea.brief}`);
      if (idea.uses.length > 0) lines.push(`   Uses: ${idea.uses.join(", ")}`);
      if (idea.missing_or_assumed.length > 0) {
        lines.push(`   Assumes: ${idea.missing_or_assumed.join(", ")}`);
      }
    });
  }

  if (scan.notes) {
    lines.push("");
    lines.push(`Notes: ${scan.notes}`);
  }
  return lines.join("\n");
}

export default {
  description:
    "Scan a photo of a fridge, freezer, pantry shelf, or grocery haul. Identifies the food items, stocks them into the pantry inventory (with realistic expiry estimates), and returns 3 recipes the user can make right now with what they have. Use whenever the user shares a photo of food storage or groceries, or asks 'what can I cook with what's in my fridge?' alongside a photo.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      photo_path: {
        type: "string",
        description:
          "Absolute path to the photo (jpg, png, webp, or gif). Conversation attachments live under /workspace/conversations/<conversation-id>/attachments/.",
      },
      add_to_pantry: {
        type: "boolean",
        description:
          "Whether to stock the identified items into the pantry inventory. Default true. Set false for a look-only scan.",
      },
      location: {
        type: "string",
        enum: ["fridge", "freezer", "pantry", "counter"],
        description:
          "Where these items live. Default fridge. Used when stocking the inventory.",
      },
      context: {
        type: "string",
        description:
          "Optional user context: dietary constraints, cravings, how many people to feed, time available.",
      },
    },
    required: ["photo_path"],
  },
  async execute(
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    const photoPath = String(input.photo_path ?? "").trim();
    if (!photoPath) {
      return { content: "error: photo_path is required", isError: true };
    }
    const addToPantry = input.add_to_pantry !== false;
    const location = normalizeLocation(
      typeof input.location === "string" ? input.location : undefined,
    );
    const userContext =
      typeof input.context === "string" ? input.context.trim() : "";

    try {
      const image = loadImage(photoPath);

      // Give the vision model a peek at existing stock so recipe ideas can
      // draw on staples the user already has.
      const pantry = loadPantry();
      const pantryContext = pantry
        .slice(0, 40)
        .map((p) => p.name)
        .join(", ");

      const { scan, rawText, model } = await scanFridge(
        image,
        userContext,
        pantryContext,
        ctx.signal,
      );

      if (!scan) {
        return {
          content: `The vision model replied but the response could not be parsed. Raw response:\n\n${rawText}`,
          isError: false,
        };
      }

      let stocked: string[] = [];
      let updated: string[] = [];
      if (addToPantry && scan.has_food && scan.items.length > 0) {
        const inputs: ItemInput[] = scan.items.map((item) => ({
          name: item.name,
          category: item.category,
          location,
          expires: expiryDate(item.suggested_expiry_days),
          notes: item.freshness,
        }));
        const result = addItems(inputs);
        stocked = result.added;
        updated = result.updated;
      }

      return {
        content: formatScan(scan, stocked, updated) + `\n\nModel: ${model}.`,
        isError: false,
      };
    } catch (err) {
      return {
        content: `error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
