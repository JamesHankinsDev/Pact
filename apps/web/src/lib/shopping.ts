'use client';

import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';

export type ShoppingItem = {
  id: string;
  name: string;
  /** Human-readable quantity, e.g. "1 dozen", "1 lb". */
  quantity: string;
  estCost: number | null;
  bought: boolean;
  addedBy: string;
  addedAt: number;
  source: 'ai-suggestion' | 'manual';
  /** Optional 1-line note for AI items: "Unlocks omelettes + binders". */
  unlocks?: string;
};

export type ShoppingList = {
  items: ShoppingItem[];
  updatedAt: number;
};

// One persistent list per household. Single doc id keeps the model simple —
// no need to track "which list is active". Items are embedded in the doc;
// for ≤50 items this is well within Firestore doc-size limits and keeps
// updates atomic.
const LIST_DOC_ID = 'current';

function listRef(householdId: string) {
  const { db } = getFirebase();
  return doc(db, 'households', householdId, 'shoppingLists', LIST_DOC_ID);
}

function newItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadShoppingList(householdId: string): Promise<ShoppingList> {
  const snap = await getDoc(listRef(householdId));
  if (!snap.exists()) return { items: [], updatedAt: 0 };
  const raw = snap.data() as { items?: ShoppingItem[]; updatedAt?: Timestamp };
  return {
    items: raw.items ?? [],
    updatedAt: raw.updatedAt?.toMillis?.() ?? 0,
  };
}

export type NewShoppingItemInput = {
  name: string;
  quantity: string;
  estCost?: number | null;
  source: 'ai-suggestion' | 'manual';
  unlocks?: string;
};

/** Append items to the household list. De-duplicates against existing items by lowercased name. */
export async function addShoppingItems(
  householdId: string,
  uid: string,
  items: NewShoppingItemInput[],
): Promise<{ addedCount: number; skippedCount: number }> {
  if (items.length === 0) return { addedCount: 0, skippedCount: 0 };
  const list = await loadShoppingList(householdId);
  const existingNames = new Set(list.items.map((it) => it.name.trim().toLowerCase()));
  const now = Date.now();

  let skipped = 0;
  const fresh: ShoppingItem[] = [];
  for (const incoming of items) {
    const key = incoming.name.trim().toLowerCase();
    if (!key || existingNames.has(key)) {
      skipped += 1;
      continue;
    }
    existingNames.add(key);
    fresh.push({
      id: newItemId(),
      name: incoming.name.trim(),
      quantity: incoming.quantity.trim() || '1',
      estCost: incoming.estCost ?? null,
      bought: false,
      addedBy: uid,
      addedAt: now,
      source: incoming.source,
      ...(incoming.unlocks ? { unlocks: incoming.unlocks } : {}),
    });
  }

  if (fresh.length === 0) return { addedCount: 0, skippedCount: skipped };

  const next = [...list.items, ...fresh];
  await setDoc(listRef(householdId), { items: next, updatedAt: serverTimestamp() });
  return { addedCount: fresh.length, skippedCount: skipped };
}

export async function toggleShoppingItem(householdId: string, itemId: string): Promise<void> {
  const list = await loadShoppingList(householdId);
  const next = list.items.map((it) => (it.id === itemId ? { ...it, bought: !it.bought } : it));
  await setDoc(listRef(householdId), { items: next, updatedAt: serverTimestamp() });
}

export async function removeShoppingItem(householdId: string, itemId: string): Promise<void> {
  const list = await loadShoppingList(householdId);
  const next = list.items.filter((it) => it.id !== itemId);
  await setDoc(listRef(householdId), { items: next, updatedAt: serverTimestamp() });
}

export async function clearBoughtItems(householdId: string): Promise<{ cleared: number }> {
  const list = await loadShoppingList(householdId);
  const next = list.items.filter((it) => !it.bought);
  const cleared = list.items.length - next.length;
  if (cleared === 0) return { cleared: 0 };
  await setDoc(listRef(householdId), { items: next, updatedAt: serverTimestamp() });
  return { cleared };
}
