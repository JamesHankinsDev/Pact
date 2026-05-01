import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAuthHeader } from '@/lib/firebase-admin';
import { suggestMealPlan, type InventoryItemForPlan } from '@/lib/meal-plan';

export const runtime = 'nodejs';

const MAX_INVENTORY = 200;
const MAX_NOTES_LEN = 1000;

type RequestBody = {
  inventory?: InventoryItemForPlan[];
  caloriesTarget?: number;
  proteinTargetG?: number;
  notes?: string;
};

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

  if (!Array.isArray(body.inventory)) {
    return NextResponse.json({ error: 'inventory array required' }, { status: 400 });
  }
  if (body.inventory.length > MAX_INVENTORY) {
    return NextResponse.json({ error: `inventory too large (max ${MAX_INVENTORY})` }, { status: 413 });
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

  const inventory: InventoryItemForPlan[] = body.inventory
    .filter((it) => it && typeof it.name === 'string' && it.name.trim().length > 0)
    .map((it) => ({
      name: String(it.name).slice(0, 80),
      quantity: typeof it.quantity === 'number' ? it.quantity : undefined,
      unit: typeof it.unit === 'string' ? it.unit.slice(0, 20) : undefined,
    }));

  try {
    const result = await suggestMealPlan({
      inventory,
      caloriesTarget: typeof body.caloriesTarget === 'number' ? body.caloriesTarget : undefined,
      proteinTargetG: typeof body.proteinTargetG === 'number' ? body.proteinTargetG : undefined,
      notes: body.notes,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      const status = err.status >= 500 ? 502 : err.status;
      return NextResponse.json({ error: 'Suggestion API error' }, { status });
    }
    console.error('suggestMealPlan failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
