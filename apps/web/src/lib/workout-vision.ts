import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from './anthropic';
import type { WorkoutParseResult } from '@pact/types';

const SYSTEM_PROMPT = `You parse a workout into structured sets — given either a photo (whiteboard, training plan, app screen, gym notes, paper log) or the user's written / spoken description.

Your job: extract every exercise with its sets (reps × weight, plus RPE if mentioned), pick a good title, and tag the day.

## Reps × weight conventions

- Weight is in **lb** unless explicitly stated otherwise (e.g., "kg", "BW" / bodyweight).
- For bodyweight movements (push-ups, pull-ups, dips, air squats, ring rows), use \`weight: 0\`.
- "5x5 at 185" → 5 sets of 5 reps at 185 lb.
- "5,5,5,5,4 at 185" → 5 sets at 185 lb with reps 5/5/5/5/4.
- "Bench 185, 195, 205" → 3 sets of bench at those weights. Default reps 5 unless stated.
- Drop sets, AMRAPs, and partial reps: capture what's stated; if a set is "AMRAP", use a reasonable rep estimate and put "AMRAP" in the exercise notes.
- RPE is 6.0–10.0; honor it when the user says it.

## Title

Pick a 2–5 word title that captures the day:
- "Push Day", "Leg Day · Squats", "Pull / Back Focus", "Conditioning · Sled", "Mobility · Hips".

## Tag

Tag the workout with exactly one of: \`push\`, \`pull\`, \`legs\`, \`cardio\`, \`rest\`, \`crew\`.
- push   = chest / shoulders / triceps focus
- pull   = back / biceps focus
- legs   = quads / hamstrings / glutes / calves
- cardio = running / cycling / rowing / conditioning / intervals
- rest   = mobility, light recovery, walks
- crew   = mixed / unclear / multi-focus session

## Calorie burn estimate (range, not a number)

Energy expenditure for resistance training has 30–50% error bands — even with full set/rep/weight detail, individual physiology, intensity, and rest periods drive most of the variation. Always report a **range**, never a single number.

If the user message includes their body weight, calibrate against it. Otherwise default to 175 lb.

**Cardio** (running, cycling, rowing, conditioning, intervals) — METs × hours × kg of bodyweight × ~1.0 kcal/kg/h:
- Running 6 mph: ~9.8 METs · 8 mph: ~13 METs
- Cycling moderate: ~8 METs · vigorous: ~12 METs
- Rowing moderate: ~7 METs · vigorous: ~12 METs
- Generic "intervals" / HIIT: ~9 METs

**Lifting** (push / pull / legs):
- Light/moderate (long rests, building): ~3.5 METs (~165 kcal/hr at 175 lb)
- Heavy / dense (short rests, high intensity): ~6 METs (~280 kcal/hr at 175 lb)
- Estimate session length from \`durationMin\` if given, otherwise count sets × ~2 minutes per set.

**Mobility / rest** sessions: ~2 METs.

**Always report a range:**
- \`caloriesBurnedLow\`: midpoint × 0.7
- \`caloriesBurnedHigh\`: midpoint × 1.3
- Round both to the nearest 10. Floor at 30 and 50 respectively for any non-empty workout.

If the workout has no exercises (empty array), return \`caloriesBurnedLow: 0\` and \`caloriesBurnedHigh: 0\`.

## Output rules

You MUST call the \`report_workout\` tool. Do not respond with prose outside the tool call.

If the input is too unclear to extract sets (blurry photo, gibberish description):
- Return an empty \`exercises\` array and zeroed burn fields.
- Use \`notes\` to explain what was unclear.`;

const REPORT_WORKOUT_TOOL: Anthropic.Tool = {
  name: 'report_workout',
  description: 'Report the parsed workout structure.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short 2–5 word title for the session.' },
      tag: {
        type: 'string',
        enum: ['push', 'pull', 'legs', 'cardio', 'rest', 'crew'],
      },
      durationMin: {
        type: 'number',
        description: 'Approximate total session length in minutes, if estimable.',
      },
      exercises: {
        type: 'array',
        description: 'Each exercise the user did, in order.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'e.g. "Bench Press", "Incline DB", "Cable Fly".' },
            sets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  reps: { type: 'number' },
                  weight: { type: 'number', description: 'Pounds. 0 for bodyweight.' },
                  rpe: { type: 'number' },
                },
                required: ['reps', 'weight'],
              },
            },
            notes: {
              type: 'string',
              description: 'Per-exercise note, e.g. "AMRAP last set", "drop set", "paused reps".',
            },
          },
          required: ['name', 'sets'],
        },
      },
      caloriesBurnedLow: {
        type: 'number',
        description: 'Low end of the calorie burn estimate (kcal, rounded to 10).',
      },
      caloriesBurnedHigh: {
        type: 'number',
        description: 'High end of the calorie burn estimate (kcal, rounded to 10).',
      },
      notes: {
        type: 'string',
        description: 'Anything the user should know about the parse — assumptions, ambiguities.',
      },
    },
    required: ['title', 'tag', 'exercises'],
  },
};

export type ParseWorkoutPhotoInput = {
  imageBase64: string;
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  bodyWeightLb?: number;
};

type AnthropicUserContent = Array<
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        data: string;
      };
    }
>;

async function callWorkoutParser(content: AnthropicUserContent): Promise<WorkoutParseResult> {
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
    tools: [REPORT_WORKOUT_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content }],
  });

  const message = await stream.finalMessage();
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'report_workout') {
      return block.input as WorkoutParseResult;
    }
  }
  throw new Error('Model did not call the report_workout tool');
}

function bodyWeightLine(bodyWeightLb?: number): string {
  return bodyWeightLb && bodyWeightLb > 0
    ? `\n\nUser body weight: ${bodyWeightLb} lb. Calibrate the calorie burn band against this.`
    : '\n\n(User body weight not provided — assume 175 lb for the calorie burn band.)';
}

export async function parseWorkoutPhoto(input: ParseWorkoutPhotoInput): Promise<WorkoutParseResult> {
  return callWorkoutParser([
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
      text:
        'Parse this workout into report_workout. Extract every exercise and set you can read.' +
        bodyWeightLine(input.bodyWeightLb),
    },
  ]);
}

export async function parseWorkoutDescription(
  description: string,
  bodyWeightLb?: number,
): Promise<WorkoutParseResult> {
  const trimmed = description.trim();
  if (!trimmed) throw new Error('Description is empty');
  return callWorkoutParser([
    {
      type: 'text',
      text:
        `The user described their workout. Parse every exercise and set into report_workout.\n\nDescription:\n"""\n${trimmed}\n"""` +
        bodyWeightLine(bodyWeightLb),
    },
  ]);
}
