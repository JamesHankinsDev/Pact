'use client';

import {
  Timestamp,
  collection,
  doc,
  serverTimestamp,
  setDoc,
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
    loggedAt: serverTimestamp(),
  });

  return { workoutId };
}

export function workoutFromSnap(d: { id: string; data: () => unknown }): WorkoutRecord {
  const raw = d.data() as {
    memberId?: string;
    date?: string;
    title?: string;
    tag?: ExerciseTag;
    totalSets?: number;
    durationMin?: number | null;
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
  };
}
