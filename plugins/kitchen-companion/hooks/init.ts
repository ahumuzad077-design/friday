// hooks/init.ts
import type { InitContext } from "@vellumai/plugin-api";
import {
  setDataDir,
  setConfig,
  ensureJson,
  PANTRY_FILE,
  RECIPES_FILE,
  PLANS_FILE,
} from "../src/storage.ts";

export default async function init(ctx: InitContext): Promise<void> {
  setDataDir(ctx.pluginStorageDir);
  setConfig(ctx.config);
  ensureJson(PANTRY_FILE, []);
  ensureJson(RECIPES_FILE, []);
  ensureJson(PLANS_FILE, []);
  ctx.logger?.info?.("kitchen-companion: initialized");
}
