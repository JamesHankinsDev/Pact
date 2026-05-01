'use client';

import { Timestamp, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';

export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type GoalDirection = 'lose' | 'maintain' | 'gain';

export type BodyProfile = {
  sex: Sex;
  birthYear: number;
  heightIn: number;
  weightLb: number;
  activityLevel: ActivityLevel;
  goalDirection: GoalDirection;
  /** Pounds per week toward goal — 0 for maintain, 0.5–2 for lose/gain. */
  goalLbPerWeek: number;
  notes: string;
  updatedAt: number;
};

export type Range = { min: number; target: number; max: number };

export type NutritionGoals = {
  caloriesDaily: Range;
  proteinG: Range;
  carbsG: Range;
  fatG: Range;
  rationale: string;
  aiSuggested: boolean;
  updatedAt: number;
};

const PRIVATE = 'private';
const BODY_DOC = 'body';
const GOALS_DOC = 'nutritionGoals';

function fromTs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return 0;
}

export async function loadBodyProfile(uid: string): Promise<BodyProfile | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'users', uid, PRIVATE, BODY_DOC));
  if (!snap.exists()) return null;
  const raw = snap.data() as Omit<BodyProfile, 'updatedAt'> & { updatedAt?: unknown };
  return { ...raw, updatedAt: fromTs(raw.updatedAt) };
}

export async function saveBodyProfile(
  uid: string,
  data: Omit<BodyProfile, 'updatedAt'>,
): Promise<void> {
  const { db } = getFirebase();
  await setDoc(doc(db, 'users', uid, PRIVATE, BODY_DOC), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function loadNutritionGoals(uid: string): Promise<NutritionGoals | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'users', uid, PRIVATE, GOALS_DOC));
  if (!snap.exists()) return null;
  const raw = snap.data() as Omit<NutritionGoals, 'updatedAt'> & { updatedAt?: unknown };
  return { ...raw, updatedAt: fromTs(raw.updatedAt) };
}

export async function saveNutritionGoals(
  uid: string,
  data: Omit<NutritionGoals, 'updatedAt'>,
): Promise<void> {
  const { db } = getFirebase();
  await setDoc(doc(db, 'users', uid, PRIVATE, GOALS_DOC), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export const ACTIVITY_LEVELS: Array<{ value: ActivityLevel; label: string; sub: string }> = [
  { value: 'sedentary',   label: 'Sedentary',   sub: 'Desk job, little exercise' },
  { value: 'light',       label: 'Light',       sub: '1–3 workouts/week' },
  { value: 'moderate',    label: 'Moderate',    sub: '3–5 workouts/week' },
  { value: 'active',      label: 'Active',      sub: '6–7 workouts/week' },
  { value: 'very-active', label: 'Very active', sub: 'Athlete · twice-daily training' },
];
