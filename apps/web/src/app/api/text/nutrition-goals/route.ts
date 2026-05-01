import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAuthHeader } from '@/lib/firebase-admin';
import {
  suggestNutritionGoals,
  type SuggestionInput,
} from '@/lib/nutrition-suggest';

export const runtime = 'nodejs';

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very-active'] as const;
const GOAL_DIRECTIONS = ['lose', 'maintain', 'gain'] as const;
const SEXES = ['male', 'female', 'other'] as const;
const MAX_NOTES_LEN = 1000;

type RequestBody = Partial<SuggestionInput>;

export async function POST(req: NextRequest) {
  try {
    await verifyAuthHeader(req.headers.get('authorization'));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.sex || !SEXES.includes(body.sex)) {
    return NextResponse.json({ error: 'sex required (male / female / other)' }, { status: 400 });
  }
  if (typeof body.age !== 'number' || body.age < 13 || body.age > 100) {
    return NextResponse.json({ error: 'age required (13–100)' }, { status: 400 });
  }
  if (typeof body.heightIn !== 'number' || body.heightIn < 36 || body.heightIn > 96) {
    return NextResponse.json({ error: 'heightIn required (36–96)' }, { status: 400 });
  }
  if (typeof body.weightLb !== 'number' || body.weightLb < 60 || body.weightLb > 600) {
    return NextResponse.json({ error: 'weightLb required (60–600)' }, { status: 400 });
  }
  if (!body.activityLevel || !ACTIVITY_LEVELS.includes(body.activityLevel)) {
    return NextResponse.json({ error: 'activityLevel required' }, { status: 400 });
  }
  if (!body.goalDirection || !GOAL_DIRECTIONS.includes(body.goalDirection)) {
    return NextResponse.json({ error: 'goalDirection required' }, { status: 400 });
  }
  if (typeof body.goalLbPerWeek !== 'number' || body.goalLbPerWeek < 0 || body.goalLbPerWeek > 3) {
    return NextResponse.json({ error: 'goalLbPerWeek required (0–3)' }, { status: 400 });
  }
  if (body.notes != null && typeof body.notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
  }
  if ((body.notes?.length ?? 0) > MAX_NOTES_LEN) {
    return NextResponse.json(
      { error: `notes too long (max ${MAX_NOTES_LEN} chars)` },
      { status: 413 },
    );
  }

  try {
    const result = await suggestNutritionGoals({
      sex: body.sex,
      age: body.age,
      heightIn: body.heightIn,
      weightLb: body.weightLb,
      activityLevel: body.activityLevel,
      goalDirection: body.goalDirection,
      goalLbPerWeek: body.goalLbPerWeek,
      notes: body.notes ?? '',
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      const status = err.status >= 500 ? 502 : err.status;
      return NextResponse.json({ error: 'Suggestion API error' }, { status });
    }
    console.error('suggestNutritionGoals failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
