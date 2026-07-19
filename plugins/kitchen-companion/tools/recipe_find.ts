// tools/recipe_find.ts
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import {
  loadRecipes,
  searchRecipes,
  formatRecipe,
} from "../src/recipes.ts";
import { loadPantry, coverage } from "../src/pantry.ts";

export default {
  description:
    "Search saved recipes by keyword or category, optionally ranked by what the pantry can cover right now (makeable_now). Shows pantry coverage and the missing ingredients per recipe. Use when the user asks what to cook, wants a saved recipe back, or asks 'what can I make with what I have?' without a photo. Pass full_recipe to get complete ingredients and steps for the top match.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keywords to match against title, tags, and ingredients.",
      },
      category: {
        type: "string",
        description:
          "Filter: breakfast, lunch, dinner, dessert, baking, snack, drink, side, sauce, other.",
      },
      makeable_now: {
        type: "boolean",
        description:
          "Rank by pantry coverage and show missing ingredients. Default false.",
      },
      full_recipe: {
        type: "boolean",
        description:
          "Return full ingredients and steps for the best match instead of a summary list. Default false.",
      },
      max_results: {
        type: "number",
        description: "Max recipes to return. Default 5.",
      },
    },
    required: [],
  },
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    try {
      const all = loadRecipes();
      if (all.length === 0) {
        return {
          content:
            "No saved recipes yet. Clip some with recipe_save (URL or text), or use fridge_scan for on-the-spot ideas from a photo.",
          isError: false,
        };
      }

      const query = typeof input.query === "string" ? input.query : "";
      const category = typeof input.category === "string" ? input.category : "";
      const makeableNow = input.makeable_now === true;
      const fullRecipe = input.full_recipe === true;
      const maxResults =
        typeof input.max_results === "number" && input.max_results > 0
          ? Math.floor(input.max_results)
          : 5;

      let matches = searchRecipes(all, query, category);
      if (matches.length === 0) {
        return {
          content: `No saved recipes match "${query || category}". ${all.length} recipe(s) saved total.`,
          isError: false,
        };
      }

      if (makeableNow) {
        const pantry = loadPantry();
        const scored = matches
          .map((r) => ({
            recipe: r,
            cov: coverage(
              pantry,
              r.ingredients.map((i) => i.raw),
            ),
          }))
          .sort((a, b) => b.cov.score - a.cov.score)
          .slice(0, maxResults);

        if (fullRecipe && scored.length > 0) {
          const top = scored[0];
          const missing =
            top.cov.missing.length > 0
              ? `\n\nMissing from pantry: ${top.cov.missing.join("; ")}`
              : "\n\nPantry covers everything.";
          return {
            content: formatRecipe(top.recipe, true) + missing,
            isError: false,
          };
        }

        const lines = scored.map(({ recipe, cov }) => {
          const pct = Math.round(cov.score * 100);
          const missing =
            cov.missing.length > 0
              ? ` | missing: ${cov.missing.slice(0, 4).join("; ")}${cov.missing.length > 4 ? ` +${cov.missing.length - 4} more` : ""}`
              : " | pantry covers everything";
          return `- ${recipe.title} (id: ${recipe.id}) ${pct}% makeable${missing}`;
        });
        return {
          content: `Ranked by what the pantry covers:\n${lines.join("\n")}`,
          isError: false,
        };
      }

      matches = matches.slice(0, maxResults);
      if (fullRecipe) {
        return { content: formatRecipe(matches[0], true), isError: false };
      }
      const lines = matches.map(
        (r) =>
          `- ${formatRecipe(r, false).split("\n")[0]} [${r.category}] (id: ${r.id})`,
      );
      return {
        content: `${matches.length} match(es):\n${lines.join("\n")}`,
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
