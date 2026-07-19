# Kitchen Companion

A Vellum plugin that turns your assistant into a full kitchen companion: scan your fridge with a photo, keep a pantry inventory with expiry alerts, clip recipes from any URL, and generate meal plans from what you actually have.

## What it does

- **Fridge scanning.** Send a photo of your fridge, freezer, pantry shelf, or grocery haul. The plugin identifies the items, stocks them into your pantry inventory with realistic expiry estimates, and comes back with 3 recipes you can make right now.
- **Pantry tracking.** A live inventory across fridge, freezer, pantry, and counter. Add items by photo or by telling your assistant what you bought. Mention what you cooked and it gets used up. Soonest-expiring items surface first.
- **Expiry alerts.** When something is about to expire, your assistant knows and works it into food conversations naturally, with recipe suggestions to use it up before it goes to waste.
- **Recipe clipping.** Share a recipe URL and it gets parsed into a clean, normalized format (structured-data parsing first, AI extraction as fallback). Pasted or dictated recipes work too.
- **"What can I make?"** Saved recipes ranked by how much of each one your pantry covers, with the missing ingredients listed.
- **Meal planning.** Multi-day plans built from your pantry and saved recipes, prioritizing food that expires soonest, with a consolidated grocery list for the gaps.

## Tools

| Tool | Description |
| --- | --- |
| `fridge_scan` | Identify food in a photo, stock the pantry, suggest 3 makeable-now recipes |
| `pantry_update` | Add, use up, or remove pantry items (batch) |
| `pantry_list` | Inventory view, soonest-expiring first, with filters |
| `recipe_save` | Clip a recipe from a URL or raw text into a normalized format |
| `recipe_find` | Search saved recipes, optionally ranked by pantry coverage |
| `meal_plan` | Generate a multi-day meal plan plus grocery list |

## How to use

Everything is conversational. Once installed, just talk to your assistant:

**Scan your fridge**

> *[send a photo of your fridge]* "what can I make tonight?"

The items get identified and stocked into your pantry, and you get 3 recipes buildable from what's visible. Add constraints naturally: "something vegetarian, 20 minutes max, feeding 4."

**Keep the pantry current**

> "bought chicken thighs, spinach, and a dozen eggs"
> "used up the mozzarella last night"
> "threw out the old yogurt"

No forms, no apps. Mention food coming in or going out and the inventory stays current.

**Check what you have**

> "what's in my fridge?"
> "anything expiring soon?"
> "do I still have rice?"

**Save recipes**

> "save this recipe: https://www.budgetbytes.com/dragon-noodles/"
> "save my grandma's shakshuka: heat oil, fry an onion..." *(pasted or dictated text works too)*

Note: some sites (allrecipes.com among them) block automated fetching. If a URL fails, paste the recipe text instead.

**Answer the eternal question**

> "what can I actually make right now?"

Saved recipes come back ranked by how much of each one your pantry covers, with the missing ingredients listed.

**Plan the week**

> "plan dinners for the week, we're 2 people, nothing over 45 minutes"

You get a day-by-day plan that uses up your soonest-expiring food first, plus one consolidated grocery list. After you shop, say so and the list gets stocked into the pantry.

**Expiry alerts**

Nothing to do here. When something is close to its date, your assistant knows, and will suggest using it up next time food comes up in conversation.

## Install

```
assistant plugins install kitchen-companion
```

Or directly from GitHub:

```
assistant plugins install https://github.com/vellum-ai/kitchen-companion
```

## Requirements

- A vision-capable model profile for fridge scanning (the plugin picks one automatically, or pin one via `visionProfile` in `config.json`).
- Any configured inference profile for recipe extraction and meal planning.

## Configuration

`config.json` in the plugin directory:

| Key | Default | What it does |
| --- | --- | --- |
| `visionProfile` | `null` | Pin a specific model profile for photo scans |
| `maxImageBytes` | `10485760` | Reject photos larger than this |
| `expiryWarningDays` | `3` | How far ahead the expiring-soon alert looks |
| `contextInjectionEnabled` | `true` | Set `false` to disable the expiry alert context |
| `staples` | salt, oil, ... | Ingredients always treated as on hand when scoring recipes |

## Data

Everything is stored locally in the plugin's data directory as plain JSON: `pantry.json`, `recipes.json`, `meal-plans.json`. No external services beyond your configured model providers, and recipe pages you explicitly clip.

## License

MIT
