// src/storage.ts
// JSON-backed storage for pantry inventory, saved recipes, and meal plans.
// Works both in-process (init hook sets the data dir) and in a sandbox
// subprocess (falls back to <pluginDir>/data), same pattern as plant-doctor.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_DATA_DIR = path.join(PLUGIN_DIR, "data");
const CONFIG_PATH = path.join(PLUGIN_DIR, "config.json");

let dataDir = "";
let pluginConfig: unknown = null;
let configLoaded = false;

export function setDataDir(dir: string): void {
  dataDir = dir;
}

export function getDataDir(): string {
  return dataDir || DEFAULT_DATA_DIR;
}

export function setConfig(config: unknown): void {
  pluginConfig = config;
  configLoaded = true;
}

export function getConfig<T = Record<string, unknown>>(): T {
  if (!configLoaded) {
    try {
      pluginConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      pluginConfig = null;
    }
    configLoaded = true;
  }
  return (pluginConfig ?? {}) as T;
}

export const PANTRY_FILE = "pantry.json";
export const RECIPES_FILE = "recipes.json";
export const PLANS_FILE = "meal-plans.json";

export interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity: number | null;
  unit: string;
  location: "fridge" | "freezer" | "pantry" | "counter";
  added: string;
  expires: string | null;
  notes: string;
}

export interface RecipeIngredient {
  raw: string;
  item?: string;
}

export interface Recipe {
  id: string;
  title: string;
  source_url: string;
  category: string;
  tags: string[];
  servings: string;
  prep_min: number | null;
  cook_min: number | null;
  total_min: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  saved_at: string;
  notes: string;
}

export interface MealPlan {
  id: string;
  created: string;
  days: unknown[];
  grocery_list: string[];
  preferences: string;
}

export function readJson<T>(filename: string, fallback: T): T {
  const filepath = path.join(getDataDir(), filename);
  if (!fs.existsSync(filepath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(filename: string, data: unknown): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2));
}

export function ensureJson(filename: string, fallback: unknown): void {
  const dir = getDataDir();
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(fallback, null, 2));
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/s$/, "");
}

/** Days until an ISO date. Negative means past. Null when no date. */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(todayISO() + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function expiryLabel(isoDate: string | null): string {
  const d = daysUntil(isoDate);
  if (d === null) return "";
  if (d < 0) return `[EXPIRED ${-d}d ago]`;
  if (d === 0) return "[expires TODAY]";
  if (d === 1) return "[expires tomorrow]";
  return `[${d}d left]`;
}
