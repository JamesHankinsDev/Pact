'use client';

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getFirebase } from './firebase';

/**
 * Med / supplement schedules + per-day ticks. Stored under
 * /users/{uid}/medSchedules and /users/{uid}/medTicks — strictly
 * owner-readable per Firestore rules. Crew never gets visibility.
 */

export type MedSchedule = {
  id: string;
  title: string;
  daysOfWeek: number[]; // JS day numbers (0 = Sun ... 6 = Sat)
  active: boolean;
  notes: string | null;
};

export type MedTick = {
  id: string;
  scheduleId: string;
  date: string; // YYYY-MM-DD local
};

/** Mon-first UI labels + the JS-day mapping. */
export const UI_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const UI_TO_JS: number[] = [1, 2, 3, 4, 5, 6, 0]; // Mon→1, Sun→0

export function uiIndexToJsDay(uiIdx: number): number {
  return UI_TO_JS[uiIdx]!;
}

export function todayUIIndex(now: Date = new Date()): number {
  const js = now.getDay();
  return js === 0 ? 6 : js - 1;
}

export function todayDateString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Tick ID = "{scheduleId}_{YYYY-MM-DD}" — deterministic + de-duplicating. */
function tickIdFor(scheduleId: string, date: string): string {
  return `${scheduleId}_${date}`;
}

export async function loadSchedules(uid: string): Promise<MedSchedule[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'medSchedules'), orderBy('createdAt', 'asc')),
  );
  return snap.docs.map((d) => {
    const raw = d.data() as {
      title?: string;
      daysOfWeek?: number[];
      active?: boolean;
      notes?: string | null;
    };
    return {
      id: d.id,
      title: raw.title ?? '',
      daysOfWeek: Array.isArray(raw.daysOfWeek) ? raw.daysOfWeek : [],
      active: raw.active !== false,
      notes: raw.notes ?? null,
    };
  });
}

export async function addSchedule(input: {
  uid: string;
  title: string;
  daysOfWeek: number[];
  notes?: string;
}): Promise<MedSchedule> {
  const { db } = getFirebase();
  const ref = doc(collection(db, 'users', input.uid, 'medSchedules'));
  const id = ref.id;
  await setDoc(ref, {
    id,
    title: input.title,
    daysOfWeek: input.daysOfWeek,
    active: true,
    notes: input.notes ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id, title: input.title, daysOfWeek: input.daysOfWeek, active: true, notes: input.notes ?? null };
}

export async function deleteSchedule(uid: string, scheduleId: string): Promise<void> {
  const { db } = getFirebase();
  await deleteDoc(doc(db, 'users', uid, 'medSchedules', scheduleId));
}

export async function loadTicksForDay(uid: string, date: string): Promise<MedTick[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'medTicks'), where('date', '==', date)),
  );
  return snap.docs.map((d) => {
    const raw = d.data() as { scheduleId?: string; date?: string };
    return {
      id: d.id,
      scheduleId: raw.scheduleId ?? '',
      date: raw.date ?? '',
    };
  });
}

export async function setTicked(input: {
  uid: string;
  scheduleId: string;
  date: string;
  ticked: boolean;
}): Promise<void> {
  const { db } = getFirebase();
  const ref = doc(db, 'users', input.uid, 'medTicks', tickIdFor(input.scheduleId, input.date));
  if (input.ticked) {
    await setDoc(ref, {
      id: ref.id,
      scheduleId: input.scheduleId,
      date: input.date,
      takenAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(ref);
  }
}

/**
 * One-shot count of how many of today's due schedules the user has
 * already ticked off. Useful for the dashboard quick-log card to show
 * "2/4 done today" without a full screen render.
 */
export async function todayCounts(uid: string): Promise<{ done: number; due: number }> {
  const date = todayDateString();
  const dayJs = new Date().getDay();
  const [schedules, ticks] = await Promise.all([
    loadSchedules(uid),
    loadTicksForDay(uid, date),
  ]);
  const due = schedules.filter((s) => s.active && s.daysOfWeek.includes(dayJs));
  const tickedIds = new Set(ticks.map((t) => t.scheduleId));
  return { done: due.filter((s) => tickedIds.has(s.id)).length, due: due.length };
}

export const _internal = { tickIdFor, UI_TO_JS, Timestamp };
