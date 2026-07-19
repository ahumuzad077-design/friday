// tools/recipe_save.ts
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import {
  fetchPage,
  parseJsonLdRecipe,
  llmExtractRecipe,
  htmlToText,
  loadRecipes,
  saveRecipes,
  formatRecipe,
} from "../src/recipes.ts";

export default {
  description:
    "Clip and save a recipe. Give it a URL (parses the site's structured recipe data, falls back to AI extraction) or raw recipe text (pasted, dictated, or from a photo transcription). Normalizes into a clean format: title, ingredients, steps, times, category. Saved recipes power recipe_find and meal_plan. Use whenever the user shares a recipe link or asks to save a recipe.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL of the recipe page to clip.",
      },
      text: {
        type: "string",
        description:
          "Raw recipe text to normalize and save, when there is no URL.",
      },
      category: {
        type: "string",
        description:
          "Override category: breakfast, lunch, dinner, dessert, baking, snack, drink, side, sauce, other.",
      },
      notes: {
        type: "string",
        description: "User notes to attach, e.g. 'mom's version, double the garlic'.",
      },
    },
    required: [],
  },
  async execute(
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    const url = typeof input.url === "string" ? input.url.trim() : "";
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!url && !text) {
      return {
        content: "error: provide either url or text",
        isError: true,
      };
    }

    try {
      let recipe = null;
      let via = "";

      if (url) {
        const html = await fetchPage(url, ctx.signal);
        recipe = parseJsonLdRecipe(html, url);
        via = "structured data";
        if (!recipe) {
          const { recipe: extracted } = await llmExtractRecipe(
            htmlToText(html),
            url,
            ctx.signal,
          );
          recipe = extracted;
          via = "AI extraction";
        }
      } else {
        const { recipe: extracted } = await llmExtractRecipe(
          text,
          "",
          ctx.signal,
        );
        recipe = extracted;
        via = "AI extraction";
      }

      if (!recipe) {
        return {
          content: url
            ? `Could not find a recipe on that page (tried structured data and AI extraction). If the page is paywalled or JS-only, paste the recipe text instead.`
            : "That text does not contain a coherent recipe.",
          isError: false,
        };
      }

      if (typeof input.category === "string" && input.category.trim()) {
        recipe.category = input.category.trim().toLowerCase();
      }
      if (typeof input.notes === "string" && input.notes.trim()) {
        recipe.notes = input.notes.trim();
      }

      const recipes = loadRecipes();
      const duplicate = recipes.find(
        (r) =>
          r.title.toLowerCase() === recipe!.title.toLowerCase() ||
          (url && r.source_url === url),
      );
      if (duplicate) {
        return {
          content: `Already saved as "${duplicate.title}" (id: ${duplicate.id}). Not saved again.`,
          isError: false,
        };
      }

      recipes.push(recipe);
      saveRecipes(recipes);

      return {
        content: `Saved via ${via} (id: ${recipe.id}):\n\n${formatRecipe(recipe, true)}`,
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
