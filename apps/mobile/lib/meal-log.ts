import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebase } from './firebase';
import type { MealParseResult } from '@pact/types';

type LogMealInput = {
  uid: string;
  groupId: string;
  parsed: MealParseResult;
  photo: { blob: Blob; mediaType: string };
};

export type LogMealResult = {
  mealId: string;
  photoUrl: string;
  storagePath: string;
};

const EXT_FROM_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Mirror of apps/web/src/lib/meal-log.ts — uploads to mealPhotos/{uid}/{mealId}
 * and writes the meal doc into groups/{groupId}/meals/{mealId}. The web copy
 * is the source of truth for the schema; keep them in sync when fields change.
 */
export async function logMeal(input: LogMealInput): Promise<LogMealResult> {
  const { db, storage } = getFirebase();

  const mealRef = doc(collection(db, 'groups', input.groupId, 'meals'));
  const mealId = mealRef.id;

  const ext = EXT_FROM_TYPE[input.photo.mediaType] ?? 'jpg';
  const path = `mealPhotos/${input.uid}/${mealId}.${ext}`;
  const objectRef = storageRef(storage, path);

  await uploadBytes(objectRef, input.photo.blob, {
    contentType: input.photo.mediaType,
    cacheControl: 'public, max-age=31536000, immutable',
  });
  const photoUrl = await getDownloadURL(objectRef);

  await setDoc(mealRef, {
    id: mealId,
    memberId: input.uid,
    groupId: input.groupId,
    loggedAt: serverTimestamp(),
    photoUrl,
    storagePath: path,
    items: input.parsed.items,
    totals: input.parsed.totals,
    notes: input.parsed.notes ?? null,
    source: 'vision',
    edited: false,
  });

  return { mealId, photoUrl, storagePath: path };
}
