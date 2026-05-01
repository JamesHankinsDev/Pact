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
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { ExerciseTag } from '@pact/types';

export type WorkoutRecord = {
  id: string;
  memberId: string;
  loggedAt: number;
  date: string;
  title: string;
  tag: ExerciseTag;
  totalSets: number;
  durationMin: number | null;
  caloriesBurnedLow: number | null;
  caloriesBurnedHigh: number | null;
};

/** Full workout doc, including the per-exercise + per-set breakdown. */
export type WorkoutDetail = WorkoutRecord & {
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{ reps: number; weight: number; rpe?: number }>;
    notes?: string;
  }>;
  edited?: boolean;
};

type SaveWorkoutInput = {
  uid: string;
  groupId: string;
  title: string;
  tag: ExerciseTag;
  durationMin?: number;
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{ weight: number; reps: number; rpe?: number }>;
  }>;
  caloriesBurnedLow?: number;
  caloriesBurnedHigh?: number;
};

export async function saveWorkoutSession(input: SaveWorkoutInput): Promise<{ workoutId: string }> {
  const { db } = getFirebase();
  const ref = doc(collection(db, 'groups', input.groupId, 'workouts'));
  const workoutId = ref.id;

  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const totalSets = input.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  await setDoc(ref, {
    id: workoutId,
    memberId: input.uid,
    groupId: input.groupId,
    date,
    title: input.title,
    tag: input.tag,
    exercises: input.exercises,
    totalSets,
    durationMin: input.durationMin ?? null,
    caloriesBurnedLow: input.caloriesBurnedLow ?? null,
    caloriesBurnedHigh: input.caloriesBurnedHigh ?? null,
    loggedAt: serverTimestamp(),
  });

  return { workoutId };
}

/** Load this user's workouts in the given group, since `sinceMs`. Newest first. */
export async function loadRecentUserWorkouts(
  groupId: string,
  uid: string,
  sinceMs: number,
): Promise<WorkoutRecord[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(
      collection(db, 'groups', groupId, 'workouts'),
      where('loggedAt', '>=', Timestamp.fromMillis(sinceMs)),
      orderBy('loggedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => workoutFromSnap(d)).filter((w) => w.memberId === uid);
}

const USER_WORKOUTS_HARD_LIMIT = 200;

/**
 * Load this user's workouts across the whole group history, newest first.
 * Mirrors loadUserMeals — fetches with the loggedAt single-field index and
 * filters to memberId in memory.
 */
export async function loadUserWorkouts(
  groupId: string,
  uid: string,
): Promise<WorkoutRecord[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(
      collection(db, 'groups', groupId, 'workouts'),
      orderBy('loggedAt', 'desc'),
      limit(USER_WORKOUTS_HARD_LIMIT),
    ),
  );
  return snap.docs.map((d) => workoutFromSnap(d)).filter((w) => w.memberId === uid);
}

function workoutDetailFromSnap(d: { id: string; data: () => unknown }): WorkoutDetail {
  const base = workoutFromSnap(d);
  const raw = d.data() as {
    exercises?: Array<{
      id?: string;
      name?: string;
      notes?: string;
      sets?: Array<{ reps?: number; weight?: number; rpe?: number }>;
    }>;
    edited?: boolean;
  };
  return {
    ...base,
    edited: raw.edited ?? false,
    exercises: (raw.exercises ?? []).map((ex, i) => ({
      id: ex.id ?? `ex-${i}`,
      name: ex.name ?? `Exercise ${i + 1}`,
      notes: ex.notes,
      sets: (ex.sets ?? []).map((s) => ({
        reps: s.reps ?? 0,
        weight: s.weight ?? 0,
        ...(s.rpe != null ? { rpe: s.rpe } : {}),
      })),
    })),
  };
}

/**
 * Same query window as loadRecentUserWorkouts but parses the full
 * exercises + sets so the caller can compute volume (weight × reps).
 */
export async function loadRecentUserWorkoutsDetailed(
  groupId: string,
  uid: string,
  sinceMs: number,
): Promise<WorkoutDetail[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(
      collection(db, 'groups', groupId, 'workouts'),
      where('loggedAt', '>=', Timestamp.fromMillis(sinceMs)),
      orderBy('loggedAt', 'desc'),
    ),
  );
  return snap.docs
    .map((d) => workoutDetailFromSnap(d))
    .filter((w) => w.memberId === uid);
}

/** Total volume in lbs (sum of weight × reps across all sets). */
export function workoutVolume(w: WorkoutDetail): number {
  return w.exercises.reduce(
    (acc, ex) => acc + ex.sets.reduce((a, s) => a + s.weight * s.reps, 0),
    0,
  );
}

export function sumWorkoutVolumes(ws: WorkoutDetail[]): number {
  return ws.reduce((acc, w) => acc + workoutVolume(w), 0);
}

const WORKOUT_DAY_MS = 24 * 60 * 60 * 1000;

export type DayWorkoutTotals = {
  dayStartMs: number;
  weekday: string;
  workouts: WorkoutDetail[];
  sets: number;
  volume: number;
  durationMin: number;
};

export function weekDayWorkoutTotals(
  workouts: WorkoutDetail[],
  weekMondayMs: number,
): DayWorkoutTotals[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((weekday, i) => {
    const start = weekMondayMs + i * WORKOUT_DAY_MS;
    const end = start + WORKOUT_DAY_MS;
    const day = workouts.filter((w) => w.loggedAt >= start && w.loggedAt < end);
    return {
      dayStartMs: start,
      weekday,
      workouts: day,
      sets: day.reduce((a, w) => a + w.totalSets, 0),
      volume: day.reduce((a, w) => a + workoutVolume(w), 0),
      durationMin: day.reduce((a, w) => a + (w.durationMin ?? 0), 0),
    };
  });
}

export type WeekWorkoutTotals = {
  weekStartMs: number;
  workouts: WorkoutDetail[];
  sets: number;
  volume: number;
  daysTrained: number;
};

export function lastNWeekWorkoutTotals(
  workouts: WorkoutDetail[],
  weeks: number,
  thisMondayMs: number,
): WeekWorkoutTotals[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStartMs = thisMondayMs - i * 7 * WORKOUT_DAY_MS;
    const weekEnd = weekStartMs + 7 * WORKOUT_DAY_MS;
    const weekWorkouts = workouts.filter((w) => w.loggedAt >= weekStartMs && w.loggedAt < weekEnd);
    const days = new Set(
      weekWorkouts.map((w) => {
        const d = new Date(w.loggedAt);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }),
    ).size;
    return {
      weekStartMs,
      workouts: weekWorkouts,
      sets: weekWorkouts.reduce((a, w) => a + w.totalSets, 0),
      volume: weekWorkouts.reduce((a, w) => a + workoutVolume(w), 0),
      daysTrained: days,
    };
  });
}

/** Load a single workout doc with its exercises + sets breakdown. */
export async function loadWorkout(
  groupId: string,
  workoutId: string,
): Promise<WorkoutDetail | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'groups', groupId, 'workouts', workoutId));
  if (!snap.exists()) return null;
  return workoutDetailFromSnap(snap);
}

export type WorkoutEditPatch = {
  title: string;
  tag: ExerciseTag;
  durationMin: number | null;
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{ reps: number; weight: number; rpe?: number }>;
    notes?: string;
  }>;
};

/**
 * Save user edits to a workout. Marks the workout as `edited` and recomputes
 * `totalSets` from the new exercises array. Only the author can update
 * (Firestore rules enforce).
 */
export async function updateWorkout(
  groupId: string,
  workoutId: string,
  patch: WorkoutEditPatch,
): Promise<void> {
  const { db } = getFirebase();
  const totalSets = patch.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  await updateDoc(doc(db, 'groups', groupId, 'workouts', workoutId), {
    title: patch.title,
    tag: patch.tag,
    durationMin: patch.durationMin,
    exercises: patch.exercises,
    totalSets,
    edited: true,
    updatedAt: serverTimestamp(),
  });
}

export function workoutFromSnap(d: { id: string; data: () => unknown }): WorkoutRecord {
  const raw = d.data() as {
    memberId?: string;
    date?: string;
    title?: string;
    tag?: ExerciseTag;
    totalSets?: number;
    durationMin?: number | null;
    caloriesBurnedLow?: number | null;
    caloriesBurnedHigh?: number | null;
    loggedAt?: Timestamp;
  };
  return {
    id: d.id,
    memberId: raw.memberId ?? '',
    loggedAt: raw.loggedAt?.toMillis() ?? 0,
    date: raw.date ?? '',
    title: raw.title ?? 'Workout',
    tag: raw.tag ?? 'push',
    totalSets: raw.totalSets ?? 0,
    durationMin: raw.durationMin ?? null,
    caloriesBurnedLow: raw.caloriesBurnedLow ?? null,
    caloriesBurnedHigh: raw.caloriesBurnedHigh ?? null,
  };
}
