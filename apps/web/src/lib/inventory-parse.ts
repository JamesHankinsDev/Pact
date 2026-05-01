import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from './anthropic';
import type { ReceiptParseResult } from '@pact/types';

const SYSTEM_PROMPT = `You convert a user's spoken or typed list of fridge / pantry items into a structured inventory.

This is for an onboarding flow where someone is standing in their kitchen rattling off what they have. Be tolerant of natural language and disfluencies ("uhh", "okay so", "and a", repeated phrases).

## Output rules

You MUST call the \`report_inventory\` tool. Each item gets:
- **name**: Title-cased canonical name. Singular form ("Onion" not "onions"). Group obvious synonyms ("scallions"/"green onions" → "Green onion").
- **quantity**: a number.
- **unit**: a short string. See conventions below.
- **estCost**: leave undefined unless the user explicitly states a price.

## Quantity & unit conventions

- "two pounds of chicken thighs" → quantity 2, unit "lb"
- "three cans of black beans" → quantity 3, unit "can"
- "a dozen eggs" → quantity 12, unit "ea"
- "a bag of rice" → quantity 1, unit "bag"
- "half a gallon of milk" → quantity 0.5, unit "gal"
- "about a pound" → quantity 1, unit "lb" (note the rough estimate in the meal-side notes if relevant; here just record the number).
- "some onions" / "a few" → quantity 2, unit "ea" (default to 2 for vague plural; 1 for vague singular).
- "leftover rice" / "half an onion" → quantity 0.5 with appropriate unit.
- If no unit is stated and the item is a countable thing (apple, egg, pepper), use "ea". If it's a continuous thing (milk, oil, flour), prefer "lb" or "gal" or "oz" based on best guess.

## Consolidation

If the user mentions the same thing twice ("two onions… and another onion"), combine them into one row with the summed quantity.

## Defaults

- The user may add price mentions ("about ten bucks of chicken"). Do NOT extrapolate per-item costs from those — leave estCost undefined unless they tag a specific item.
- Skip filler ("um", "let's see", "okay"). Don't include them as items.
- If the input has nothing food-like, return an empty items array.

## Output

Always set \`store\` to "Dictated" so downstream UI knows the source. Don't set \`subtotal\` or \`total\` — those are receipt-only fields.`;

const REPORT_INVENTORY_TOOL: Anthropic.Tool = {
  name: 'report_inventory',
  description: 'Report parsed inventory items from spoken / typed text.',
  input_schema: {
    type: 'object',
    properties: {
      store: {
        type: 'string',
        description: 'Always set to "Dictated" for this flow.',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string' },
            estCost: { type: 'number' },
          },
          required: ['name', 'quantity', 'unit'],
        },
      },
      notes: {
        type: 'string',
        description: 'Anything the user should know about the parse (ambiguities, rough guesses).',
      },
    },
    required: ['store', 'items'],
  },
};

export async function parseInventoryFromText(text: string): Promise<ReceiptParseResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Description is empty');

  const client = getAnthropicClient();
  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [REPORT_INVENTORY_TOOL],
    tool_choice: { type: 'auto' },
    messages: [
      {
        role: 'user',
        content: `The user described what's in their fridge / pantry. Parse into report_inventory.\n\n"""\n${trimmed}\n"""`,
      },
    ],
  });

  const message = await stream.finalMessage();
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'report_inventory') {
      return block.input as ReceiptParseResult;
    }
  }
  throw new Error('Model did not call the report_inventory tool');
}
