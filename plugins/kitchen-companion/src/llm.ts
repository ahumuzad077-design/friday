// src/llm.ts
// Provider resolution and response parsing shared by fridge scanning,
// recipe extraction, and meal planning. Routes through the workspace's
// configured inference credentials via getConfiguredProvider.

import {
  getConfiguredProvider,
  getModelProfiles,
  doesSupportVision,
} from "@vellumai/plugin-api";
import type { Provider } from "@vellumai/plugin-api";
import { getConfig } from "./storage.ts";

/**
 * Resolve a vision-capable provider. Order:
 * 1. config.visionProfile when set,
 * 2. the active profile when it supports vision,
 * 3. the first non-disabled profile that supports vision.
 *
 * Always pin an explicit vision-capable profile with forceOverrideProfile.
 * Without it the override layers below any per-call-site pin the workspace
 * has (for example a cheap text-only profile on the inference call site),
 * and the pinned non-vision model wins.
 */
export async function resolveVisionProvider(): Promise<{
  provider: Provider;
  profileKey: string | null;
}> {
  const config = getConfig<{ visionProfile?: string | null }>();

  if (config?.visionProfile) {
    const provider = await getConfiguredProvider("inference", {
      overrideProfile: config.visionProfile,
      forceOverrideProfile: true,
    });
    if (provider) return { provider, profileKey: config.visionProfile };
  }

  const profiles = await Promise.resolve(getModelProfiles());
  const active = profiles.find((p) => p.isActive && !p.isDisabled);
  const candidates = [
    ...(active ? [active] : []),
    ...profiles.filter((p) => !p.isDisabled && p.key !== active?.key),
  ];

  for (const p of candidates) {
    if (!(await Promise.resolve(doesSupportVision(p)))) continue;
    const provider = await getConfiguredProvider("inference", {
      overrideProfile: p.key,
      forceOverrideProfile: true,
    });
    if (provider) return { provider, profileKey: p.key };
  }

  throw new Error(
    "no vision-capable inference profile is configured. Enable a profile whose model can process images, or set visionProfile in the plugin's config.json.",
  );
}

/** Resolve a plain text provider (no vision requirement). */
export async function resolveTextProvider(): Promise<Provider> {
  const provider = await getConfiguredProvider("inference");
  if (!provider) {
    throw new Error("no inference provider is configured.");
  }
  return provider;
}

export function extractText(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

/** Pull the outermost JSON object out of a model response. */
export function parseJsonObject<T>(raw: string): T | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** One-shot text completion returning parsed JSON plus the raw text. */
export async function textJsonCall<T>(
  systemPrompt: string,
  userText: string,
  signal?: AbortSignal,
): Promise<{ parsed: T | null; rawText: string; model: string }> {
  const provider = await resolveTextProvider();
  const response = await provider.sendMessage(
    [{ role: "user", content: [{ type: "text", text: userText }] }],
    { systemPrompt, signal },
  );
  const rawText = extractText(
    response.content as Array<{ type: string; text?: string }>,
  );
  return { parsed: parseJsonObject<T>(rawText), rawText, model: response.model };
}
