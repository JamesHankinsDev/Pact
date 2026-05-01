'use client';

import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebase } from './firebase';
import type { MealParseResult } from '@pact/types';

type LogMealInput = {
  uid: string;
  groupId: string;
  parsed: MealParseResult;
  /** Present only on photo-driven logs. Text-described meals omit this. */
  photo?: { blob: Blob; mediaType: string };
  /** The user's original description text, when this is a text-described log. */
  description?: string;
  /** How the meal was logged. Defaults to 'vision' for back-compat. */
  source?: 'vision' | 'description' | 'manual';
};

export type LogMealResult = {
  mealId: string;
  photoUrl: string | null;
  storagePath: string | null;
};

const EXT_FROM_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Save a meal log to Firestore. Photo upload is optional — text-described
 * meals (where the user typed what they ate) skip Storage entirely and
 * write the doc with photoUrl: null.
 *
 * Storage path (when a photo is present):
 *   mealPhotos/{uid}/{mealId}.{ext}  — 24h GCS lifecycle delete
 * Firestore path:
 *   groups/{groupId}/meals/{mealId}
 */
export async function logMeal(input: LogMealInput): Promise<LogMealResult> {
  const { db, storage } = getFirebase();

  const mealRef = doc(collection(db, 'groups', input.groupId, 'meals'));
  const mealId = mealRef.id;

  let photoUrl: string | null = null;
  let storagePath: string | null = null;

  if (input.photo) {
    const ext = EXT_FROM_TYPE[input.photo.mediaType] ?? 'jpg';
    storagePath = `mealPhotos/${input.uid}/${mealId}.${ext}`;
    const objectRef = storageRef(storage, storagePath);
    await uploadBytes(objectRef, input.photo.blob, {
      contentType: input.photo.mediaType,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    photoUrl = await getDownloadURL(objectRef);
  }

  await setDoc(mealRef, {
    id: mealId,
    memberId: input.uid,
    groupId: input.groupId,
    loggedAt: serverTimestamp(),
    photoUrl,
    storagePath,
    items: input.parsed.items,
    totals: input.parsed.totals,
    caloriesLow: input.parsed.caloriesLow ?? null,
    caloriesHigh: input.parsed.caloriesHigh ?? null,
    notes: input.parsed.notes ?? null,
    description: input.description ?? null,
    source: input.source ?? 'vision',
    edited: false,
  });

  return { mealId, photoUrl, storagePath };
}
