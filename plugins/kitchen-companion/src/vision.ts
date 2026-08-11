// src/vision.ts
// Fridge and pantry photo scanning. Identifies visible food items and
// proposes recipes makeable right now, in a single vision call.

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveVisionProvider, extractText, parseJsonObject } from "./llm.ts";
import { getConfig } from "./storage.ts";

const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export interface ScannedItem {
  name: string;
  quantity: string;
  category: string;
  confidence: "high" | "medium" | "low";
  freshness: string;
  suggested_expiry_days: number | null;
}

export interface RecipeIdea {
  title: string;
  uses: string[];
  missing_or_assumed: string[];
  time_minutes: number | null;
  brief: string;
}

export interface FridgeScan {
  has_food: boolean;
  items: ScannedItem[];
  recipe_ideas: RecipeIdea[];
  notes: string;
}

const SYSTEM_PROMPT = `You are an expert chef and kitchen inventory assistant. You look at photos of fridges, freezers, pantries, or groceries and identify what food is there, then propose recipes the person can cook right now.

Respond with ONLY a JSON object (no markdown fences, no prose before or after) matching this exact shape:

{
  "has_food": boolean,
  "items": [
    {
      "name": string,
      "quantity": string,
      "category": string,
      "confidence": "high" | "medium" | "low",
      "freshness": string,
      "suggested_expiry_days": number | null
    }
  ],
  "recipe_ideas": [
    {
      "title": string,
      "uses": [string],
      "missing_or_assumed": [string],
      "time_minutes": number | null,
      "brief": string
    }
  ],
  "notes": string
}

Rules:
- If the photo contains no identifiable food, set has_food to false and leave items and recipe_ideas empty.
- Only list items you can actually see or confidently infer from packaging. Do not invent items.
- "quantity" is a human estimate like "about 6", "half a jar", "1 carton".
- "category" is one of: produce, dairy, meat, seafood, grains, condiments, beverages, leftovers, frozen, baked, snacks, other.
- "freshness" is a short visible-evidence note ("crisp", "starting to wilt", "unopened"). Empty string if unknowable.
- "suggested_expiry_days" is a realistic days-until-use-by estimate for this item as seen (wilting greens get fewer days). null for shelf-stable items.
- Propose exactly 3 recipe_ideas, ranked most-makeable first. Prefer ideas that use items that look closest to going bad.
- "uses" lists the visible items each idea needs. "missing_or_assumed" lists anything the idea assumes beyond the photo and common staples (salt, pepper, oil, butter, flour, sugar).
- "brief" is a 2 or 3 sentence description of how to make it, plain language.
- If extra pantry context is provided in the prompt, recipe ideas may also draw on those items.`;

export interface LoadedImage {
  data: string;
  mediaType: string;
  sizeBytes: number;
}

export function loadImage(photoPath: string): LoadedImage {
  const resolved = path.resolve(photoPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`photo not found at ${resolved}`);
  }
  const ext = path.extname(resolved).toLowerCase();
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) {
    throw new Error(
      `unsupported image type "${ext}". Supported: ${Object.keys(MEDIA_TYPES).join(", ")}`,
    );
  }
  const config = getConfig<{ maxImageBytes?: number }>();
  const maxBytes = config?.maxImageBytes ?? 10 * 1024 * 1024;
  const stat = fs.statSync(resolved);
  if (stat.size > maxBytes) {
    throw new Error(
      `image is ${(stat.size / 1024 / 1024).toFixed(1)} MB, over the ${(maxBytes / 1024 / 1024).toFixed(0)} MB limit. Resize it first.`,
    );
  }
  return {
    data: fs.readFileSync(resolved).toString("base64"),
    mediaType,
    sizeBytes: stat.size,
  };
}

export async function scanFridge(
  image: LoadedImage,
  userContext: string,
  pantryContext: string,
  signal?: AbortSignal,
): Promise<{ scan: FridgeScan | null; rawText: string; model: string }> {
  const { provider } = await resolveVisionProvider();

  const promptParts = ["Identify the food in this photo and propose recipes."];
  if (userContext) promptParts.push(`Owner's context: ${userContext}`);
  if (pantryContext) {
    promptParts.push(
      `Also already in their pantry (may be used by recipe ideas): ${pantryContext}`,
    );
  }

  const response = await provider.sendMessage(
    [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.data,
            },
          },
          { type: "text", text: promptParts.join("\n") },
        ],
      },
    ],
    { systemPrompt: SYSTEM_PROMPT, signal },
  );

  const rawText = extractText(
    response.content as Array<{ type: string; text?: string }>,
  );
  const scan = parseJsonObject<FridgeScan>(rawText);
  return {
    scan: scan && typeof scan.has_food === "boolean" ? scan : null,
    rawText,
    model: response.model,
  };
}
