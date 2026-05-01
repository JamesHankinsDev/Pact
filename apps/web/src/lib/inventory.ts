'use client';

import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { ReceiptParseResult } from '@pact/types';

export type InventoryRecord = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estCost: number | null;
  source: string;
  addedBy: string | null;
  addedAt: number;
};

type SaveReceiptInput = {
  uid: string;
  householdId: string;
  parsed: ReceiptParseResult;
};

export type SaveReceiptResult = {
  receiptId: string;
  count: number;
};

/**
 * Write each parsed receipt item as its own inventory doc under
 * households/{householdId}/inventory. All items from one receipt share a
 * receiptId so we can group them in the UI later. Inventory is household-
 * scoped (people you actually share a kitchen with), independent of pact.
 */
export async function saveReceipt(input: SaveReceiptInput): Promise<SaveReceiptResult> {
  const { db } = getFirebase();
  const receiptId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const batch = writeBatch(db);
  for (const item of input.parsed.items) {
    const ref = doc(collection(db, 'households', input.householdId, 'inventory'));
    batch.set(ref, {
      id: ref.id,
      householdId: input.householdId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      estCost: item.estCost ?? null,
      source: 'receipt',
      receiptId,
      addedBy: input.uid,
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  return { receiptId, count: input.parsed.items.length };
}

/** Load latest inventory items for a household, newest first. */
export async function loadHouseholdInventory(
  householdId: string,
  max = 20,
): Promise<InventoryRecord[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(
      collection(db, 'households', householdId, 'inventory'),
      orderBy('addedAt', 'desc'),
      limit(max),
    ),
  );
  return snap.docs.map((d) => {
    const raw = d.data() as {
      name?: string;
      quantity?: number;
      unit?: string;
      estCost?: number | null;
      source?: string;
      addedBy?: string;
      addedAt?: Timestamp;
    };
    return {
      id: d.id,
      name: raw.name ?? 'Unknown',
      quantity: raw.quantity ?? 0,
      unit: raw.unit ?? 'ea',
      estCost: raw.estCost ?? null,
      source: raw.source ?? 'manual',
      addedBy: raw.addedBy ?? null,
      addedAt: raw.addedAt?.toMillis() ?? 0,
    };
  });
}
