// tools/meal_plan.ts
import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { textJsonCall } from "../src/llm.ts";
import { loadPantry } from "../src/pantry.ts";
import { loadRecipes } from "../src/recipes.ts";
import {
  readJson,
  writeJson,
  newId,
  todayISO,
  daysUntil,
  PLANS_FILE,
  type MealPlan,
} from "../src/storage.ts";

interface PlannedMeal {
  meal: string;
  title: string;
  from_saved: string | null;
  uses_pantry: string[];
  needs: string[];
  brief: string;
}

interface PlannedDay {
  day: string;
  meals: PlannedMeal[];
}

interface LlmPlan {
  days: PlannedDay[];
  grocery_list: string[];
  notes: string;
}

const PLAN_PROMPT = `You are a practical meal planner. Given a pantry inventory (with expiry info), a list of saved recipes, and the user's preferences, produce a realistic meal plan.

Respond with ONLY a JSON object (no markdown fences, no prose):

{
  "days": [
    {
      "day": string,
      "meals": [
        {
          "meal": string,
          "title": string,
          "from_saved": string | null,
          "uses_pantry": [string],
          "needs": [string],
          "brief": string
        }
      ]
    }
  ],
  "grocery_list": [string],
  "notes": string
}

Rules:
- Prioritize pantry items that expire soonest. Food waste is the enemy.
- Prefer the user's saved recipes when they fit; set from_saved to the recipe title. For new ideas set from_saved to null.
- "uses_pantry" lists pantry items each meal consumes. "needs" lists ingredients to buy for that meal.
- "grocery_list" is the consolidated shopping list across the whole plan, deduplicated, grouped sensibly (produce together, etc.), realistic quantities.
- Keep meals achievable for a weeknight: mostly under 45 minutes unless the user asks otherwise.
- "brief" is 1 or 2 sentences on the approach. No fluff.
- Respect all stated dietary preferences and constraints.
- "notes" is at most 2 sentences: batch-cooking or leftover tips if genuinely useful, otherwise empty string.`;

export default {
  description:
    "Generate a meal plan from the pantry and saved recipes, prioritizing food that expires soonest, plus a consolidated grocery list for what's missing. Use when the user asks to plan meals for the week, do meal prep, or figure out a grocery run. The plan is saved so it can be referred back to.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      days: {
        type: "number",
        description: "How many days to plan. Default 5.",
      },
      meals_per_day: {
        type: "array",
        items: { type: "string" },
        description:
          "Which meals to plan each day, e.g. [\"dinner\"] or [\"lunch\", \"dinner\"]. Default [\"dinner\"].",
      },
      preferences: {
        type: "string",
        description:
          "Diet, cuisine cravings, calorie targets, people to feed, time constraints. Pass everything the user said.",
      },
      start_day: {
        type: "string",
        description: "Day the plan starts, e.g. 'Monday'. Default tomorrow.",
      },
    },
    required: [],
  },
  async execute(
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    const days =
      typeof input.days === "number" && input.days > 0
        ? Math.min(Math.floor(input.days), 14)
        : 5;
    const meals =
      Array.isArray(input.meals_per_day) && input.meals_per_day.length > 0
        ? (input.meals_per_day as string[]).map(String)
        : ["dinner"];
    const preferences =
      typeof input.preferences === "string" ? input.preferences.trim() : "";
    const startDay =
      typeof input.start_day === "string" ? input.start_day.trim() : "";

    try {
      const pantry = loadPantry();
      const recipes = loadRecipes();

      const pantryLines = pantry.map((p) => {
        const d = daysUntil(p.expires);
        const exp =
          d === null ? "" : d < 0 ? " (EXPIRED)" : ` (expires in ${d}d)`;
        const qty =
          typeof p.quantity === "number" ? ` x${p.quantity}${p.unit ? p.unit : ""}` : "";
        return `- ${p.name}${qty} [${p.location}]${exp}`;
      });
      const recipeLines = recipes.map(
        (r) =>
          `- "${r.title}" [${r.category}] ingredients: ${r.ingredients.map((i) => i.raw).join(", ")}`,
      );

      const userText = [
        `Plan ${days} day(s), meals each day: ${meals.join(", ")}.`,
        startDay ? `Start on ${startDay}.` : "Start tomorrow.",
        preferences ? `Preferences and constraints: ${preferences}` : "",
        "",
        pantry.length > 0
          ? `PANTRY (${pantry.length} items):\n${pantryLines.join("\n")}`
          : "PANTRY: empty.",
        "",
        recipes.length > 0
          ? `SAVED RECIPES (${recipes.length}):\n${recipeLines.join("\n")}`
          : "SAVED RECIPES: none.",
      ]
        .filter((s) => s !== "")
        .join("\n");

      const { parsed, rawText, model } = await textJsonCall<LlmPlan>(
        PLAN_PROMPT,
        userText,
        ctx.signal,
      );

      if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
        return {
          content: `The planner replied but the response could not be parsed. Raw response:\n\n${rawText}`,
          isError: false,
        };
      }

      const plans = readJson<MealPlan[]>(PLANS_FILE, []);
      const plan: MealPlan = {
        id: newId("plan"),
        created: todayISO(),
        days: parsed.days,
        grocery_list: parsed.grocery_list ?? [],
        preferences,
      };
      plans.push(plan);
      writeJson(PLANS_FILE, plans);

      const lines: string[] = [];
      for (const day of parsed.days) {
        lines.push(`${day.day}:`);
        for (const m of day.meals ?? []) {
          const saved = m.from_saved ? ` [saved: ${m.from_saved}]` : "";
          lines.push(`  ${m.meal}: ${m.title}${saved}`);
          lines.push(`    ${m.brief}`);
          if (m.uses_pantry?.length > 0)
            lines.push(`    uses: ${m.uses_pantry.join(", ")}`);
          if (m.needs?.length > 0) lines.push(`    buy: ${m.needs.join(", ")}`);
        }
        lines.push("");
      }
      if (plan.grocery_list.length > 0) {
        lines.push("GROCERY LIST:");
        for (const g of plan.grocery_list) lines.push(`- ${g}`);
      } else {
        lines.push("No shopping needed, the pantry covers the whole plan.");
      }
      if (parsed.notes) {
        lines.push("");
        lines.push(parsed.notes);
      }
      lines.push("");
      lines.push(`Plan saved (id: ${plan.id}). Model: ${model}.`);

      return { content: lines.join("\n"), isError: false };
    } catch (err) {
      return {
        content: `error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
