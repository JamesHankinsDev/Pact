import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from './anthropic';

export type SuggestionInput = {
  sex: 'male' | 'female' | 'other';
  age: number;
  heightIn: number;
  weightLb: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
  goalDirection: 'lose' | 'maintain' | 'gain';
  goalLbPerWeek: number;
  notes: string;
};

export type Range = { min: number; target: number; max: number };

export type SuggestionResult = {
  rationale: string;
  caloriesDaily: Range;
  proteinG: Range;
  carbsG: Range;
  fatG: Range;
};

const SYSTEM_PROMPT = `You're a sports-nutrition coach who builds personalized daily calorie and macro targets.

You'll receive a person's sex, age, height (inches), current weight (lb), activity level, goal direction (lose / maintain / gain), goal pace (lb/week), and any preferences they've added.

## Calibration

**BMR (Mifflin–St Jeor, kcal/day):**
- male:   10·kg + 6.25·cm − 5·age + 5
- female: 10·kg + 6.25·cm − 5·age − 161
- other:  use the average of the male and female formulas.

Conversions: 1 lb = 0.4536 kg, 1 in = 2.54 cm.

**TDEE = BMR × activity multiplier:**
- sedentary:    1.2
- light:        1.375
- moderate:     1.55
- active:       1.725
- very-active:  1.9

**Calorie target:**
- maintain → target ≈ TDEE
- lose     → deficit = (goalLbPerWeek × 3500) ÷ 7 kcal/day below TDEE
- gain     → surplus = (goalLbPerWeek × 3500) ÷ 7 kcal/day above TDEE

**Sustainability floors:**
- Don't recommend below 1500 kcal/day for women / 1800 kcal/day for men. If the math goes lower, cap the deficit and tell the user in the rationale.
- A deficit/surplus over ~1% body weight per week is unsustainable for most people. Flag this in the rationale if it applies.

**Macro targets:**
- Protein: 1.6–2.2 g/kg body weight. Default target ≈ 1.8 g/kg. People in a deficit, lifting heavily, or asking for "more protein" should land at the high end.
- Fat: minimum 0.6 g/kg, target around 25–30% of total kcal.
- Carbs: remainder of calories after protein + fat.

**Sustainable ranges (the band each target sits inside):**
- Calories: ±10% of target.
- Protein: from 1.6 g/kg up to 2.2 g/kg of body weight.
- Fat: from 20% to 35% of total calories (in grams).
- Carbs: remainder of the calorie range after protein/fat bands. Min should never go negative — clamp at 50g if the math gets there.

For each macro, the \`min\`/\`target\`/\`max\` you report must be in **grams**. Calories are in **kcal**. Round all numbers to the nearest 5.

## Honoring preferences (the notes field)

Read the user's notes carefully:
- "more protein" / "I'm lifting" → push protein toward 2.0–2.2 g/kg.
- "low carb" / "keto-leaning" → push fat toward 35%, carbs to the minimum.
- "high carb" / "endurance" → push fat toward 20%, carbs higher.
- Vegetarian / vegan / dairy-free / allergies → acknowledge in the rationale; numbers don't change.

## Rationale field

Write 2–4 short sentences (under ~80 words). Cover: rough TDEE, what deficit/surplus you used, where you placed protein, and any sustainability or preference call-outs. No fluff, no medical disclaimers.

## Output rules

You MUST call the \`report_nutrition_goals\` tool. Do not respond with prose outside the tool call.`;

const RANGE_SCHEMA = {
  type: 'object',
  properties: {
    min: { type: 'number' },
    target: { type: 'number' },
    max: { type: 'number' },
  },
  required: ['min', 'target', 'max'],
};

const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_nutrition_goals',
  description: 'Recommend daily calorie and macro targets with sustainable ranges.',
  input_schema: {
    type: 'object',
    properties: {
      rationale: {
        type: 'string',
        description: '2–4 sentences explaining how you arrived at these targets.',
      },
      caloriesDaily: { ...RANGE_SCHEMA, description: 'Daily calorie target with a sustainable band (~±10%).' },
      proteinG:      { ...RANGE_SCHEMA, description: 'Daily protein in grams. Range 1.6–2.2 g/kg.' },
      carbsG:        { ...RANGE_SCHEMA, description: 'Daily carbs in grams.' },
      fatG:          { ...RANGE_SCHEMA, description: 'Daily fat in grams. Min 0.6 g/kg.' },
    },
    required: ['rationale', 'caloriesDaily', 'proteinG', 'carbsG', 'fatG'],
  },
};

export async function suggestNutritionGoals(input: SuggestionInput): Promise<SuggestionResult> {
  const client = getAnthropicClient();

  const userMessage = [
    'Person:',
    `- Sex: ${input.sex}`,
    `- Age: ${input.age}`,
    `- Height: ${input.heightIn} inches`,
    `- Current weight: ${input.weightLb} lb`,
    `- Activity level: ${input.activityLevel}`,
    `- Goal: ${input.goalDirection}${
      input.goalDirection === 'maintain' ? '' : ` ~${Math.abs(input.goalLbPerWeek)} lb/week`
    }`,
    '',
    'Notes / preferences:',
    input.notes.trim() || '(none)',
  ].join('\n');

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [REPORT_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const message = await stream.finalMessage();
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'report_nutrition_goals') {
      return block.input as SuggestionResult;
    }
  }
  throw new Error('Model did not call the report_nutrition_goals tool');
}
