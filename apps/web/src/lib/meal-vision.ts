import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from './anthropic';
import type { MealParseResult } from '@pact/types';

const SYSTEM_PROMPT = `You estimate macronutrient content from photos of meals.

For each visible food item, estimate portion size (in grams), calories, protein (g), carbs (g), and fat (g). Then report the totals across all items.

## Calibration

Visual references (assume an average dinner plate is 25–27 cm / 10–11 inches across):
- Standard chicken breast: 6–8 oz / 170–225 g cooked
- Hand-sized portion of cooked pasta: ~1 cup / 200 g
- Fist-sized portion of cooked rice: ~1 cup / 195 g
- Typical salmon filet: 5–6 oz / 140–170 g
- One medium egg: ~50 g
- One slice of bread: ~30 g
- One pat of butter: ~5 g (~36 cal)
- One tablespoon of oil: ~14 g (~120 cal)

Per-100g cooked references:
- Chicken breast: 165 cal, 31g P, 0g C, 3.6g F
- Salmon: 208 cal, 22g P, 0g C, 13g F
- White rice: 130 cal, 2.7g P, 28g C, 0.3g F
- Brown rice: 112 cal, 2.6g P, 24g C, 0.9g F
- Pasta: 158 cal, 5.8g P, 31g C, 0.9g F
- Broccoli: 35 cal, 2.4g P, 7g C, 0.4g F
- Sweet potato: 86 cal, 1.6g P, 20g C, 0.1g F
- Avocado: 160 cal, 2g P, 9g C, 15g F
- Whole egg: 155 cal, 13g P, 1g C, 11g F
- Greek yogurt (plain): 59 cal, 10g P, 3.6g C, 0.4g F
- Quinoa: 120 cal, 4.4g P, 21g C, 1.9g F
- Firm tofu: 144 cal, 17g P, 2.8g C, 8.7g F

## Estimation principles

- When portion size is uncertain, estimate within ~20% and capture the uncertainty in \`notes\`.
- Lean conservative on calorie estimates — better to undershoot than overshoot.
- Account for visible cooking fats: oil glaze, butter, dressing, sauce, and ghee can add 100–300 calories that aren't obvious from a photo.
- For mixed dishes (curries, stir-fries, casseroles, salads), break out major components when distinguishable. Estimate the dish as a single item only when components blend together (e.g. soup, smoothie).
- Drinks: assume water unless visibly something else (milk, juice, coffee, soda).

## Output rules

You MUST call the \`report_meal\` tool with your analysis. Do not respond with prose outside the tool call.

If the photo doesn't show food, is too dark to analyze, or is unclear:
- Return an empty \`items\` array and zeroed \`totals\`.
- Use \`notes\` to explain what you observed.

If non-food items appear (silverware, hands, packaging), ignore them.`;

const REPORT_MEAL_TOOL: Anthropic.Tool = {
  name: 'report_meal',
  description: 'Report the macros estimated from a meal photo.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Each visible food item, broken out individually.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Short name, e.g. "Grilled chicken breast".' },
            portion: { type: 'string', description: 'Human-readable portion, e.g. "6 oz", "1 cup", "1 medium".' },
            grams: { type: 'number', description: 'Estimated weight in grams.' },
            calories: { type: 'number' },
            proteinG: { type: 'number' },
            carbsG: { type: 'number' },
            fatG: { type: 'number' },
          },
          required: ['name', 'calories', 'proteinG', 'carbsG', 'fatG'],
        },
      },
      totals: {
        type: 'object',
        description: 'Sum of all items.',
        properties: {
          calories: { type: 'number' },
          proteinG: { type: 'number' },
          carbsG: { type: 'number' },
          fatG: { type: 'number' },
        },
        required: ['calories', 'proteinG', 'carbsG', 'fatG'],
      },
      notes: {
        type: 'string',
        description: 'Anything the user should know about the estimate — confidence, missing info, or cooking-fat assumptions.',
      },
    },
    required: ['items', 'totals'],
  },
};

export type ParseMealInput = {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
};

/**
 * Parse a meal photo into structured macros via Claude Opus 4.7.
 *
 * Uses adaptive thinking + streaming + forced tool use. The system prompt and
 * tool definition carry a `cache_control` breakpoint — caching kicks in once
 * the prefix exceeds Opus 4.7's 4096-token minimum (today's prompt is shorter,
 * so the marker is a forward-compatible no-op until the prompt grows).
 */
export async function parseMealPhoto(input: ParseMealInput): Promise<MealParseResult> {
  const client = getAnthropicClient();

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [REPORT_MEAL_TOOL],
    tool_choice: { type: 'tool', name: 'report_meal' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: input.imageMediaType,
              data: input.imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Analyze this meal photo and call report_meal with your estimate.',
          },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'report_meal') {
      return block.input as MealParseResult;
    }
  }

  throw new Error('Model did not call the report_meal tool');
}
