'use client';

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { Macros, MealParseItem } from '@pact/types';

/**
 * Richer meal record carrying everything we render in the detail view —
 * description text, source (vision / description / manual), storagePath.
 * The dashboard's slimmer MealRecord stays unchanged.
 */
export type MealDetailRecord = {
  id: string;
  memberId: string;
  groupId: string;
  loggedAt: number;
  photoUrl: string | null;
  storagePath: string | null;
  totals: Macros;
  caloriesLow: number | null;
  caloriesHigh: number | null;
  items: MealParseItem[];
  notes: string | null;
  description: string | null;
  source: 'vision' | 'description' | 'manual';
  edited: boolean;
};

type MealDoc = {
  memberId: string;
  groupId: string;
  loggedAt?: Timestamp;
  photoUrl?: string | null;
  storagePath?: string | null;
  totals?: Macros;
  caloriesLow?: number | null;
  caloriesHigh?: number | null;
  items?: MealParseItem[];
  notes?: string | null;
  description?: string | null;
  source?: 'vision' | 'description' | 'manual';
  edited?: boolean;
};

function fromSnap(id: string, raw: MealDoc): MealDetailRecord {
  return {
    id,
    memberId: raw.memberId,
    groupId: raw.groupId,
    loggedAt: raw.loggedAt?.toMillis() ?? 0,
    photoUrl: raw.photoUrl ?? null,
    storagePath: raw.storagePath ?? null,
    totals: raw.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    caloriesLow: raw.caloriesLow ?? null,
    caloriesHigh: raw.caloriesHigh ?? null,
    items: raw.items ?? [],
    notes: raw.notes ?? null,
    description: raw.description ?? null,
    source: raw.source ?? 'vision',
    edited: raw.edited ?? false,
  };
}

const USER_MEALS_HARD_LIMIT = 200;

/**
 * Load this user's meals across the whole group history, newest first.
 * We fetch group-scoped meals with the single-field loggedAt index that
 * already powers the dashboard, then filter to memberId in memory — keeps
 * us from needing a composite (memberId, loggedAt) index for now.
 */
export async function loadUserMeals(
  groupId: string,
  uid: string,
): Promise<MealDetailRecord[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(
      collection(db, 'groups', groupId, 'meals'),
      orderBy('loggedAt', 'desc'),
      limit(USER_MEALS_HARD_LIMIT),
    ),
  );
  return snap.docs
    .map((d) => fromSnap(d.id, d.data() as MealDoc))
    .filter((m) => m.memberId === uid);
}

/** Load a single meal by id under the given group. */
export async function loadMeal(
  groupId: string,
  mealId: string,
): Promise<MealDetailRecord | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'groups', groupId, 'meals', mealId));
  if (!snap.exists()) return null;
  return fromSnap(snap.id, snap.data() as MealDoc);
}

export type MealEditPatch = {
  items: MealParseItem[];
  totals: Macros;
  caloriesLow: number | null;
  caloriesHigh: number | null;
  notes: string | null;
  description: string | null;
};

/**
 * Save user edits to a meal — items, totals, notes, description.
 * Marks the meal as `edited` so we can show the "edited" badge.
 * Server-side rules ensure only the meal's author can update.
 */
export async function updateMeal(
  groupId: string,
  mealId: string,
  patch: MealEditPatch,
): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, 'groups', groupId, 'meals', mealId), {
    items: patch.items,
    totals: patch.totals,
    caloriesLow: patch.caloriesLow,
    caloriesHigh: patch.caloriesHigh,
    notes: patch.notes,
    description: patch.description,
    edited: true,
    updatedAt: serverTimestamp(),
  });
}

/** Load the most recent N meals for a user (used for previous-day comparisons, etc). */
export async function loadRecentUserMeals(
  groupId: string,
  uid: string,
  sinceMs: number,
): Promise<MealDetailRecord[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(
      collection(db, 'groups', groupId, 'meals'),
      where('loggedAt', '>=', Timestamp.fromMillis(sinceMs)),
      orderBy('loggedAt', 'desc'),
    ),
  );
  return snap.docs
    .map((d) => fromSnap(d.id, d.data() as MealDoc))
    .filter((m) => m.memberId === uid);
}

/** Group meals by local-day key (YYYY-MM-DD). Newest day first. */
export function groupMealsByDay(
  meals: MealDetailRecord[],
): Array<{ dayKey: string; dayStartMs: number; meals: MealDetailRecord[] }> {
  const buckets = new Map<string, MealDetailRecord[]>();
  for (const meal of meals) {
    const d = new Date(meal.loggedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const arr = buckets.get(key);
    if (arr) arr.push(meal);
    else buckets.set(key, [meal]);
  }
  return Array.from(buckets.entries())
    .map(([dayKey, dayMeals]) => {
      const first = new Date(dayMeals[0]!.loggedAt);
      const dayStartMs = new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime();
      return { dayKey, dayStartMs, meals: dayMeals };
    })
    .sort((a, b) => b.dayStartMs - a.dayStartMs);
}

export function formatDayLabel(dayStartMs: number, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (dayStartMs === today) return 'Today';
  if (dayStartMs === today - dayMs) return 'Yesterday';
  return new Date(dayStartMs).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Sum macros across a list of meals — Macros-shaped, never undefined. */
export function sumMealMacros(meals: MealDetailRecord[]): Macros {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.totals.calories,
      proteinG: acc.proteinG + m.totals.proteinG,
      carbsG: acc.carbsG + m.totals.carbsG,
      fatG: acc.fatG + m.totals.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Local-time start-of-day for a millis timestamp. */
export function dayStartMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local-time start of Monday for the ISO week containing `now`. */
export function thisWeekMondayMs(now: Date = new Date()): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = d.getDay() || 7; // Sun -> 7
  d.setDate(d.getDate() - (dow - 1));
  return d.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Per-day totals for the 7-day window starting at `weekMondayMs` (Mon → Sun). */
export type DayTotals = {
  dayStartMs: number;
  weekday: string; // "Mon", "Tue", ...
  meals: MealDetailRecord[];
  totals: Macros;
};

export function weekDayTotals(
  meals: MealDetailRecord[],
  weekMondayMs: number,
): DayTotals[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((weekday, i) => {
    const start = weekMondayMs + i * DAY_MS;
    const end = start + DAY_MS;
    const dayMeals = meals.filter((m) => m.loggedAt >= start && m.loggedAt < end);
    return {
      dayStartMs: start,
      weekday,
      meals: dayMeals,
      totals: sumMealMacros(dayMeals),
    };
  });
}

/** Aggregate per-week totals, newest week first, for the last `weeks` weeks. */
export type WeekTotals = {
  weekStartMs: number;
  meals: MealDetailRecord[];
  totals: Macros;
  /** Days within the week that had at least one meal logged. */
  daysLogged: number;
};

export function lastNWeekTotals(meals: MealDetailRecord[], weeks: number, now: Date = new Date()): WeekTotals[] {
  const thisMonday = thisWeekMondayMs(now);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStartMs = thisMonday - i * 7 * DAY_MS;
    const weekEnd = weekStartMs + 7 * DAY_MS;
    const weekMeals = meals.filter((m) => m.loggedAt >= weekStartMs && m.loggedAt < weekEnd);
    const days = new Set(weekMeals.map((m) => dayStartMs(m.loggedAt))).size;
    return {
      weekStartMs,
      meals: weekMeals,
      totals: sumMealMacros(weekMeals),
      daysLogged: days,
    };
  });
}

/** Calorie split by macro (P*4 / C*4 / F*9), as percentages summing to ~100. */
export function macroEnergyMix(totals: Macros): { proteinPct: number; carbsPct: number; fatPct: number } {
  const pCal = totals.proteinG * 4;
  const cCal = totals.carbsG * 4;
  const fCal = totals.fatG * 9;
  const sum = pCal + cCal + fCal;
  if (sum <= 0) return { proteinPct: 0, carbsPct: 0, fatPct: 0 };
  return {
    proteinPct: (pCal / sum) * 100,
    carbsPct: (cCal / sum) * 100,
    fatPct: (fCal / sum) * 100,
  };
}

export function mealLeadText(meal: MealDetailRecord): string {
  if (meal.items.length === 0) {
    return meal.description ?? 'Logged meal';
  }
  const lead = meal.items
    .slice(0, 3)
    .map((it) => it.name)
    .join(', ');
  return meal.items.length > 3 ? `${lead}…` : lead;
}
