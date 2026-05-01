import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAuthHeader } from '@/lib/firebase-admin';
import { parseWorkoutDescription } from '@/lib/workout-vision';

export const runtime = 'nodejs';

const MAX_DESCRIPTION_LEN = 6000;

type RequestBody = { description?: string; bodyWeightLb?: number };

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

  const description = (body.description ?? '').trim();
  if (!description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION_LEN) {
    return NextResponse.json(
      { error: `description too long (max ${MAX_DESCRIPTION_LEN} chars)` },
      { status: 413 },
    );
  }

  const bodyWeightLb =
    typeof body.bodyWeightLb === 'number' && body.bodyWeightLb > 0 ? body.bodyWeightLb : undefined;

  try {
    const result = await parseWorkoutDescription(description, bodyWeightLb);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      const status = err.status >= 500 ? 502 : err.status;
      return NextResponse.json({ error: 'Workout parse error' }, { status });
    }
    console.error('parseWorkoutDescription failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
