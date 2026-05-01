import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from './anthropic';

export type InventoryItemForPlan = {
  name: string;
  quantity?: number;
  unit?: string;
};

export type MealPlanRequest = {
  inventory: InventoryItemForPlan[];
  /** Daily calorie target (after deficit/surplus). Optional. */
  caloriesTarget?: number;
  /** Daily protein target in grams. Optional. */
  proteinTargetG?: number;
  /** Free-text preferences / restrictions / training context. Optional. */
  notes?: string;
};

export type SuggestedMeal = {
  name: string;
  usesFromInventory: string[];
  alsoNeedsCommon: string[];
  estimatedMacros: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  prepNote: string;
};

export type SuggestedShoppingItem = {
  name: string;
  quantity: string;
  estCost?: number;
  unlocks: string;
};

export type MealPlanResult = {
  rationale: string;
  meals: SuggestedMeal[];
  shoppingList: SuggestedShoppingItem[];
};

const SYSTEM_PROMPT = `You're a nutrition-savvy kitchen assistant. The user will share what's currently in their fridge/pantry, and you'll suggest:

1. **3–5 meals** using primarily what they already have, hitting their nutrition profile.
2. **A small, cheap shopping list (5–10 items max)** — the *minimum* additions that would unlock the most additional healthy meal options.

## Meal suggestions

For each meal:
- Use primarily inventory items. Be honest about what's missing — don't pretend they have eggs when they don't.
- It's fine to assume basic pantry staples (salt, pepper, water, basic dried herbs). List anything beyond that in \`alsoNeedsCommon\` so the user knows.
- Estimate macros for a single serving. Lean conservative on calories; honest about portion size.
- Aim for the user's protein target where possible — push toward higher protein when their target suggests it.
- Stay within ~30% of their daily calorie target / 3 if they have one (so a meal lands at ~⅓ of daily intake).
- Add a one-sentence prep note. Plain English. No "expertly seared" or other puffery.

If the user's notes include preferences (vegetarian, low-carb, dairy-free, allergies, training context), honor them strictly.

## Shopping list

Pick **5–10 items** that maximally extend their meal options for the lowest dollar spend. Prioritize:
- **Versatility** — items that show up in many meals (eggs, olive oil, onions, garlic, beans, rice, frozen vegetables).
- **Protein density** when the user's protein target is high (chicken thighs, Greek yogurt, cottage cheese, canned tuna).
- **Cheap staples first**, premium ingredients only when they significantly unlock options.
- **Don't suggest something they already have.** Read the inventory carefully.

For each shopping item:
- Suggested quantity in human terms ("1 dozen", "1 lb", "1 pint").
- A rough cost estimate in USD (\`estCost\`) when you're confident — leave undefined when very uncertain.
- A one-line \`unlocks\` field naming 2–3 specific meal types this enables.

## Rationale

Write 2–3 short sentences for \`rationale\`. Cover: what their inventory leans toward, where the gaps are, and how the suggestions/shopping list address that. No fluff.

## Output rules

You MUST call the \`report_meal_plan\` tool. Do not respond with prose outside the tool call.
If the inventory is empty, return empty arrays and put guidance in \`rationale\`.`;

const MACROS_SCHEMA = {
  type: 'object',
  properties: {
    calories: { type: 'number' },
    proteinG: { type: 'number' },
    carbsG: { type: 'number' },
    fatG: { type: 'number' },
  },
  required: ['calories', 'proteinG', 'carbsG', 'fatG'],
};

const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_meal_plan',
  description: 'Recommend meals from inventory plus a small shopping list to extend options.',
  input_schema: {
    type: 'object',
    properties: {
      rationale: { type: 'string', description: '2–3 sentence summary of the approach.' },
      meals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            usesFromInventory: {
              type: 'array',
              items: { type: 'string' },
              description: 'Inventory item names (matched to user input) that this meal uses.',
            },
            alsoNeedsCommon: {
              type: 'array',
              items: { type: 'string' },
              description: 'Common pantry items needed beyond salt/pepper/water (e.g., "olive oil").',
            },
            estimatedMacros: { ...MACROS_SCHEMA, description: 'Single-serving macros.' },
            prepNote: { type: 'string', description: 'One-line prep description.' },
          },
          required: ['name', 'usesFromInventory', 'alsoNeedsCommon', 'estimatedMacros', 'prepNote'],
        },
      },
      shoppingList: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'string', description: 'Human-readable, e.g. "1 dozen", "1 lb".' },
            estCost: { type: 'number', description: 'Rough USD cost estimate.' },
            unlocks: {
              type: 'string',
              description: '1-line note: 2–3 specific meal types this enables.',
            },
          },
          required: ['name', 'quantity', 'unlocks'],
        },
      },
    },
    required: ['rationale', 'meals', 'shoppingList'],
  },
};

function formatInventory(items: InventoryItemForPlan[]): string {
  if (items.length === 0) return '(empty)';
  return items
    .map((it) => {
      const qty = it.quantity != null && it.unit ? `${it.quantity} ${it.unit}` : it.quantity != null ? `${it.quantity}` : '';
      return qty ? `- ${it.name} (${qty})` : `- ${it.name}`;
    })
    .join('\n');
}

export async function suggestMealPlan(input: MealPlanRequest): Promise<MealPlanResult> {
  const client = getAnthropicClient();

  const userMessage = [
    'Current inventory:',
    formatInventory(input.inventory),
    '',
    'Nutrition profile:',
    input.caloriesTarget != null ? `- Daily calorie target: ${Math.round(input.caloriesTarget)} kcal` : '- Daily calorie target: (not set)',
    input.proteinTargetG != null ? `- Daily protein target: ${Math.round(input.proteinTargetG)} g` : '- Daily protein target: (not set)',
    '',
    'Preferences / notes:',
    input.notes && input.notes.trim() ? input.notes.trim() : '(none)',
  ].join('\n');

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 12000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [REPORT_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const message = await stream.finalMessage();
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'report_meal_plan') {
      return block.input as MealPlanResult;
    }
  }
  throw new Error('Model did not call the report_meal_plan tool');
}
