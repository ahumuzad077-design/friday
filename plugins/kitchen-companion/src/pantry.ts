// src/pantry.ts
// Pantry inventory operations: add, use, remove, list, expiry math,
// and fuzzy matching of recipe ingredients against what's in stock.

import {
  readJson,
  writeJson,
  newId,
  todayISO,
  normalizeName,
  daysUntil,
  getConfig,
  PANTRY_FILE,
  type PantryItem,
} from "./storage.ts";

export function loadPantry(): PantryItem[] {
  return readJson<PantryItem[]>(PANTRY_FILE, []);
}

export function savePantry(items: PantryItem[]): void {
  writeJson(PANTRY_FILE, items);
}

export interface ItemInput {
  name: string;
  quantity?: number | null;
  unit?: string;
  category?: string;
  location?: string;
  expires?: string | null;
  notes?: string;
}

const LOCATIONS = new Set(["fridge", "freezer", "pantry", "counter"]);

export function normalizeLocation(loc: string | undefined): PantryItem["location"] {
  const l = (loc ?? "").toLowerCase().trim();
  return (LOCATIONS.has(l) ? l : "fridge") as PantryItem["location"];
}

export function findItem(
  pantry: PantryItem[],
  name: string,
): PantryItem | undefined {
  const norm = normalizeName(name);
  return (
    pantry.find((p) => normalizeName(p.name) === norm) ??
    pantry.find(
      (p) =>
        normalizeName(p.name).includes(norm) ||
        norm.includes(normalizeName(p.name)),
    )
  );
}

export interface AddResult {
  added: string[];
  updated: string[];
}

/** Add items. Same-name items in the same location merge (quantity summed when both numeric, expiry updated when given). */
export function addItems(inputs: ItemInput[]): AddResult {
  const pantry = loadPantry();
  const result: AddResult = { added: [], updated: [] };
  for (const input of inputs) {
    const name = input.name.trim();
    if (!name) continue;
    const location = normalizeLocation(input.location);
    const existing = pantry.find(
      (p) =>
        normalizeName(p.name) === normalizeName(name) &&
        p.location === location,
    );
    if (existing) {
      if (
        typeof input.quantity === "number" &&
        typeof existing.quantity === "number"
      ) {
        existing.quantity += input.quantity;
      } else if (typeof input.quantity === "number") {
        existing.quantity = input.quantity;
      }
      if (input.expires !== undefined) existing.expires = input.expires ?? null;
      if (input.unit) existing.unit = input.unit;
      if (input.notes) existing.notes = input.notes;
      result.updated.push(existing.name);
    } else {
      pantry.push({
        id: newId("itm"),
        name,
        category: input.category?.trim() || "other",
        quantity: typeof input.quantity === "number" ? input.quantity : null,
        unit: input.unit?.trim() || "",
        location,
        added: todayISO(),
        expires: input.expires ?? null,
        notes: input.notes?.trim() || "",
      });
      result.added.push(name);
    }
  }
  savePantry(pantry);
  return result;
}

export interface UseResult {
  used: string[];
  removed: string[];
  notFound: string[];
}

/** Use up items: decrement numeric quantities, remove when hitting zero or when no quantity tracked. */
export function useItems(
  inputs: ItemInput[],
  hardRemove: boolean,
): UseResult {
  const pantry = loadPantry();
  const result: UseResult = { used: [], removed: [], notFound: [] };
  for (const input of inputs) {
    const item = findItem(pantry, input.name);
    if (!item) {
      result.notFound.push(input.name);
      continue;
    }
    const qty = typeof input.quantity === "number" ? input.quantity : null;
    if (!hardRemove && qty !== null && typeof item.quantity === "number") {
      item.quantity -= qty;
      if (item.quantity > 0) {
        result.used.push(`${item.name} (${item.quantity} ${item.unit} left)`.trim());
        continue;
      }
    }
    pantry.splice(pantry.indexOf(item), 1);
    result.removed.push(item.name);
  }
  savePantry(pantry);
  return result;
}

export function expiringItems(withinDays: number): PantryItem[] {
  return loadPantry()
    .filter((p) => {
      const d = daysUntil(p.expires);
      return d !== null && d <= withinDays;
    })
    .sort((a, b) => (daysUntil(a.expires) ?? 0) - (daysUntil(b.expires) ?? 0));
}

function tokens(s: string): string[] {
  return normalizeName(s)
    .split(/[^a-z]+/)
    .map((t) => t.replace(/s$/, ""))
    .filter((t) => t.length > 2);
}

export function isStaple(ingredient: string): boolean {
  const config = getConfig<{ staples?: string[] }>();
  const staples = config?.staples ?? [];
  const ing = normalizeName(ingredient);
  return staples.some((s) => {
    const stapleNorm = normalizeName(s);
    return ing === stapleNorm || ing.includes(stapleNorm);
  });
}

/** Does the pantry plausibly cover this raw ingredient line? Token-overlap match. */
export function pantryHas(pantry: PantryItem[], ingredientRaw: string): boolean {
  const ingTokens = new Set(tokens(ingredientRaw));
  if (ingTokens.size === 0) return false;
  return pantry.some((p) => {
    const itemTokens = tokens(p.name);
    if (itemTokens.length === 0) return false;
    const hits = itemTokens.filter((t) => ingTokens.has(t)).length;
    return hits >= Math.min(itemTokens.length, 2) || hits / itemTokens.length >= 0.5;
  });
}

export interface CoverageResult {
  total: number;
  covered: number;
  staples: number;
  missing: string[];
  score: number;
}

/** Score how much of a recipe's ingredient list the pantry covers. Staples always count as available. */
export function coverage(
  pantry: PantryItem[],
  ingredientLines: string[],
): CoverageResult {
  let covered = 0;
  let staplesCount = 0;
  const missing: string[] = [];
  for (const raw of ingredientLines) {
    if (isStaple(raw)) {
      staplesCount++;
      covered++;
    } else if (pantryHas(pantry, raw)) {
      covered++;
    } else {
      missing.push(raw);
    }
  }
  const total = ingredientLines.length;
  return {
    total,
    covered,
    staples: staplesCount,
    missing,
    score: total === 0 ? 0 : covered / total,
  };
}
