'use client';

import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { ReceiptParseResult } from '@pact/types';

type SaveReceiptInput = {
  uid: string;
  groupId: string;
  parsed: ReceiptParseResult;
};

export type SaveReceiptResult = {
  receiptId: string;
  count: number;
};

/**
 * Write each parsed receipt item as its own inventory doc under
 * groups/{groupId}/inventory. All items from one receipt share a receiptId
 * so we can group them in the UI later (e.g. "added from Whole Foods,
 * Tuesday"). No deduplication against existing inventory yet — that's a
 * follow-up; for now duplicate names just stack.
 */
export async function saveReceipt(input: SaveReceiptInput): Promise<SaveReceiptResult> {
  const { db } = getFirebase();
  const receiptId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const batch = writeBatch(db);
  for (const item of input.parsed.items) {
    const ref = doc(collection(db, 'groups', input.groupId, 'inventory'));
    batch.set(ref, {
      id: ref.id,
      groupId: input.groupId,
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
