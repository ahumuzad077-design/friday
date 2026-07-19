// src/recipes.ts
// Recipe clipping and normalization. Strategy: fetch the URL, try
// schema.org/Recipe JSON-LD first (most recipe sites ship it), fall back
// to LLM extraction from the page text. Manual text goes straight to LLM.

import {
  readJson,
  writeJson,
  newId,
  todayISO,
  RECIPES_FILE,
  type Recipe,
  type RecipeIngredient,
} from "./storage.ts";
import { textJsonCall } from "./llm.ts";

export function loadRecipes(): Recipe[] {
  return readJson<Recipe[]>(RECIPES_FILE, []);
}

export function saveRecipes(recipes: Recipe[]): void {
  writeJson(RECIPES_FILE, recipes);
}

// ---------- URL fetching ----------

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function fetchPage(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: signal ?? AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

// ---------- JSON-LD extraction ----------

type JsonLdNode = Record<string, unknown>;

function collectLdNodes(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const re =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const queue: unknown[] = [parsed];
      while (queue.length > 0) {
        const node = queue.shift();
        if (Array.isArray(node)) {
          queue.push(...node);
        } else if (node && typeof node === "object") {
          const obj = node as JsonLdNode;
          nodes.push(obj);
          if (Array.isArray(obj["@graph"])) queue.push(...(obj["@graph"] as unknown[]));
        }
      }
    } catch {
      // malformed block, skip
    }
  }
  return nodes;
}

function isRecipeNode(node: JsonLdNode): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase() === "recipe";
  if (Array.isArray(t)) {
    return t.some((x) => typeof x === "string" && x.toLowerCase() === "recipe");
  }
  return false;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).join(", ");
  if (v && typeof v === "object") {
    const obj = v as JsonLdNode;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj["@value"] === "string") return (obj["@value"] as string).trim();
  }
  return "";
}

/** ISO 8601 duration (PT1H30M) to minutes. */
function durationToMinutes(v: unknown): number | null {
  const s = asString(v);
  if (!s) return null;
  const m = s.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const mins =
    (Number(m[1]) || 0) * 1440 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  return mins > 0 ? mins : null;
}

function stripHtmlTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInstructions(v: unknown): string[] {
  const steps: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      const clean = stripHtmlTags(node);
      if (clean) steps.push(clean);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      const obj = node as JsonLdNode;
      if (typeof obj.text === "string") {
        const clean = stripHtmlTags(obj.text);
        if (clean) steps.push(clean);
      } else if (Array.isArray(obj.itemListElement)) {
        walk(obj.itemListElement);
      }
    }
  };
  walk(v);
  return steps;
}

export function parseJsonLdRecipe(html: string, url: string): Recipe | null {
  const node = collectLdNodes(html).find(isRecipeNode);
  if (!node) return null;

  const ingredientsRaw = node.recipeIngredient ?? node.ingredients;
  const ingredients: RecipeIngredient[] = (
    Array.isArray(ingredientsRaw) ? ingredientsRaw : []
  )
    .map((i) => stripHtmlTags(asString(i)))
    .filter(Boolean)
    .map((raw) => ({ raw }));

  const steps = extractInstructions(node.recipeInstructions);
  const title = asString(node.name);
  if (!title || ingredients.length === 0) return null;

  const category = asString(node.recipeCategory).toLowerCase() || "other";
  const keywords = asString(node.keywords);
  const prep = durationToMinutes(node.prepTime);
  const cook = durationToMinutes(node.cookTime);
  const total = durationToMinutes(node.totalTime) ?? (prep !== null || cook !== null ? (prep ?? 0) + (cook ?? 0) : null);

  return {
    id: newId("rcp"),
    title,
    source_url: url,
    category,
    tags: keywords ? keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 8) : [],
    servings: asString(node.recipeYield),
    prep_min: prep,
    cook_min: cook,
    total_min: total,
    ingredients,
    steps,
    saved_at: todayISO(),
    notes: "",
  };
}

// ---------- LLM fallback extraction ----------

interface LlmRecipe {
  found: boolean;
  title: string;
  category: string;
  tags: string[];
  servings: string;
  prep_min: number | null;
  cook_min: number | null;
  total_min: number | null;
  ingredients: string[];
  steps: string[];
}

const EXTRACT_PROMPT = `You extract recipes from messy webpage text or user-provided notes into clean structured data.

Respond with ONLY a JSON object (no markdown fences, no prose) in this shape:

{
  "found": boolean,
  "title": string,
  "category": string,
  "tags": [string],
  "servings": string,
  "prep_min": number | null,
  "cook_min": number | null,
  "total_min": number | null,
  "ingredients": [string],
  "steps": [string]
}

Rules:
- If no coherent recipe is present, set found to false.
- "category" is one of: breakfast, lunch, dinner, dessert, baking, snack, drink, side, sauce, other.
- "ingredients" entries keep quantity and unit in the line, e.g. "2 cups all-purpose flour".
- "steps" are complete numbered-order instructions, one action per entry.
- Keep the recipe's original quantities. Do not invent ingredients or steps that are not in the text.
- Up to 6 short lowercase tags.`;

export function htmlToText(html: string): string {
  return stripHtmlTags(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " "),
  );
}

export async function llmExtractRecipe(
  text: string,
  sourceUrl: string,
  signal?: AbortSignal,
): Promise<{ recipe: Recipe | null; rawText: string }> {
  const clipped = text.slice(0, 24_000);
  const { parsed, rawText } = await textJsonCall<LlmRecipe>(
    EXTRACT_PROMPT,
    `Extract the recipe from this content:\n\n${clipped}`,
    signal,
  );
  if (!parsed || !parsed.found || !parsed.title || parsed.ingredients.length === 0) {
    return { recipe: null, rawText };
  }
  return {
    recipe: {
      id: newId("rcp"),
      title: parsed.title,
      source_url: sourceUrl,
      category: parsed.category || "other",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
      servings: parsed.servings || "",
      prep_min: parsed.prep_min ?? null,
      cook_min: parsed.cook_min ?? null,
      total_min: parsed.total_min ?? null,
      ingredients: parsed.ingredients.map((raw) => ({ raw })),
      steps: parsed.steps,
      saved_at: todayISO(),
      notes: "",
    },
    rawText,
  };
}

// ---------- search ----------

export function searchRecipes(
  recipes: Recipe[],
  query: string,
  category: string,
): Recipe[] {
  const q = query.toLowerCase().trim();
  const cat = category.toLowerCase().trim();
  return recipes.filter((r) => {
    if (cat && r.category.toLowerCase() !== cat) return false;
    if (!q) return true;
    const haystack = [
      r.title,
      r.category,
      r.tags.join(" "),
      r.ingredients.map((i) => i.raw).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((token) => haystack.includes(token));
  });
}

export function formatRecipe(r: Recipe, full: boolean): string {
  const lines: string[] = [];
  const time = r.total_min ? ` (${r.total_min} min)` : "";
  lines.push(`${r.title}${time}`);
  const meta = [
    r.category !== "other" ? r.category : "",
    r.servings ? `serves ${r.servings}` : "",
    r.tags.length > 0 ? r.tags.join(", ") : "",
  ]
    .filter(Boolean)
    .join(" | ");
  if (meta) lines.push(meta);
  if (r.source_url) lines.push(`source: ${r.source_url}`);
  if (full) {
    lines.push("");
    lines.push("Ingredients:");
    for (const i of r.ingredients) lines.push(`- ${i.raw}`);
    lines.push("");
    lines.push("Steps:");
    r.steps.forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    if (r.notes) {
      lines.push("");
      lines.push(`Notes: ${r.notes}`);
    }
  }
  return lines.join("\n");
}
