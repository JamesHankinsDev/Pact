import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from './anthropic';
import type { ReceiptParseResult } from '@pact/types';

const SYSTEM_PROMPT = `You parse grocery receipt photos into a structured pantry inventory.

For each line item:
- Identify the item. Translate store abbreviations into a readable name —
  e.g. "GG WHL MLK 2GL" → "Whole milk", "AVOCADO HASS" → "Avocado",
  "BNNA YEL ORG" → "Banana".
- Extract quantity. Default 1 if not specified. For weighed items shown
  like "1.23 LB @ $4.99/LB", quantity is 1.23.
- Identify unit: "ea", "lb", "oz", "gal", "pack". Pick the unit the
  receipt actually uses; default to "ea" if unclear.
- Capture the line price as estCost (in dollars).

Skip non-item lines: subtotals, taxes, tips, fees, discounts, store info,
dates, loyalty rewards, payment, change, tender lines, transaction IDs.

If the same item appears on multiple lines (e.g. two separate "BANANA"
lines), list both — the storage layer dedupes.

You MUST call the \`report_receipt\` tool with your analysis. Do not
respond with prose outside the tool call.

If the photo isn't a receipt, is unreadable, or is too dark to analyze,
return an empty items array and use \`notes\` to explain.`;

const REPORT_RECEIPT_TOOL: Anthropic.Tool = {
  name: 'report_receipt',
  description: 'Report items extracted from a grocery receipt photo.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Each item line on the receipt, in the order they appear.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Cleaned item name, e.g. "Whole milk", "Bananas", "Olive oil".',
            },
            quantity: {
              type: 'number',
              description: 'Numeric quantity. 1 for single items; the weight for weighed items.',
            },
            unit: {
              type: 'string',
              description: 'Unit string: ea, lb, oz, gal, pack, etc.',
            },
            estCost: {
              type: 'number',
              description: 'Estimated cost for this line in dollars (omit if not visible).',
            },
          },
          required: ['name', 'quantity', 'unit'],
        },
      },
      store: {
        type: 'string',
        description: 'Store name if visible at the top of the receipt.',
      },
      subtotal: {
        type: 'number',
        description: 'Pre-tax subtotal in dollars, if visible.',
      },
      total: {
        type: 'number',
        description: 'Final paid total in dollars, if visible.',
      },
      notes: {
        type: 'string',
        description: 'Anything the user should know — confidence, missing fields, weird formatting.',
      },
    },
    required: ['items'],
  },
};

export type ParseReceiptInput = {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
};

export async function parseReceiptPhoto(input: ParseReceiptInput): Promise<ReceiptParseResult> {
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
    tools: [REPORT_RECEIPT_TOOL],
    tool_choice: { type: 'tool', name: 'report_receipt' },
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
            text: 'Parse this receipt and call report_receipt with the line items.',
          },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'report_receipt') {
      return block.input as ReceiptParseResult;
    }
  }

  throw new Error('Model did not call the report_receipt tool');
}
