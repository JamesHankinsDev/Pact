'use client';

import {
  Timestamp,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebase } from './firebase';

export type WeightRecord = {
  id: string;
  memberId: string;
  loggedAt: number;     // ms
  date: string;         // YYYY-MM-DD
  weightLb: number;
  bodyFatPct: number | null;
  notes: string | null;
  photoUrl: string | null;
};

type SaveWeightInput = {
  uid: string;
  groupId: string;
  weightLb: number;
  bodyFatPct?: number | null;
  notes?: string | null;
  photo?: { blob: Blob; mediaType: string } | null;
};

const EXT_FROM_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Write a weight log to groups/{id}/weightLogs and (optionally) upload a
 * progress photo to progressPhotos/{uid}/{logId}.{ext}. Photos are
 * owner-only readable per storage.rules — crew sees the weight number
 * via the Firestore doc but never the photo.
 */
export async function saveWeightLog(input: SaveWeightInput): Promise<{ logId: string }> {
  const { db, storage } = getFirebase();
  const ref = doc(collection(db, 'groups', input.groupId, 'weightLogs'));
  const logId = ref.id;

  let photoUrl: string | null = null;
  let storagePath: string | null = null;
  if (input.photo) {
    const ext = EXT_FROM_TYPE[input.photo.mediaType] ?? 'jpg';
    storagePath = `progressPhotos/${input.uid}/${logId}.${ext}`;
    const objectRef = storageRef(storage, storagePath);
    await uploadBytes(objectRef, input.photo.blob, {
      contentType: input.photo.mediaType,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    photoUrl = await getDownloadURL(objectRef);
  }

  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  await setDoc(ref, {
    id: logId,
    memberId: input.uid,
    groupId: input.groupId,
    date,
    loggedAt: serverTimestamp(),
    weightLb: input.weightLb,
    bodyFatPct: input.bodyFatPct ?? null,
    notes: input.notes ?? null,
    photoUrl,
    storagePath,
  });

  return { logId };
}

export function weightFromSnap(d: { id: string; data: () => unknown }): WeightRecord {
  const raw = d.data() as {
    memberId?: string;
    date?: string;
    weightLb?: number;
    bodyFatPct?: number | null;
    notes?: string | null;
    photoUrl?: string | null;
    loggedAt?: Timestamp;
  };
  return {
    id: d.id,
    memberId: raw.memberId ?? '',
    loggedAt: raw.loggedAt?.toMillis() ?? 0,
    date: raw.date ?? '',
    weightLb: raw.weightLb ?? 0,
    bodyFatPct: raw.bodyFatPct ?? null,
    notes: raw.notes ?? null,
    photoUrl: raw.photoUrl ?? null,
  };
}

/**
 * Aggregate per-member weight logs into one weekly-average sample per
 * member per ISO week, capped at the most recent N weeks. Returns one
 * series per member that has at least 2 samples (less is too sparse to
 * draw a useful line).
 */
export type WeightSeries = {
  memberId: string;
  points: Array<{ weekStart: number; avgLb: number }>;
};

export function weeklyAveragesByMember(
  logs: WeightRecord[],
  weeksBack = 8,
  now: Date = new Date(),
): WeightSeries[] {
  const cutoff = startOfISOWeekMs(now) - (weeksBack - 1) * 7 * 24 * 60 * 60 * 1000;
  const buckets = new Map<string, Map<number, number[]>>();

  for (const log of logs) {
    if (log.loggedAt < cutoff) continue;
    const weekStart = startOfISOWeekMs(new Date(log.loggedAt));
    if (!buckets.has(log.memberId)) buckets.set(log.memberId, new Map());
    const inner = buckets.get(log.memberId)!;
    if (!inner.has(weekStart)) inner.set(weekStart, []);
    inner.get(weekStart)!.push(log.weightLb);
  }

  return Array.from(buckets.entries())
    .map(([memberId, byWeek]) => ({
      memberId,
      points: Array.from(byWeek.entries())
        .sort(([a], [b]) => a - b)
        .map(([weekStart, weights]) => ({
          weekStart,
          avgLb: weights.reduce((a, b) => a + b, 0) / weights.length,
        })),
    }))
    .filter((s) => s.points.length >= 2);
}

function startOfISOWeekMs(d: Date): number {
  const day = d.getDay() || 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}
