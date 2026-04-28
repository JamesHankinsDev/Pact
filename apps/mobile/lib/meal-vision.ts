import { getFirebase } from './firebase';
import type { MealParseResult } from '@pact/types';

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export async function parseMealPhoto(
  imageBase64: string,
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
): Promise<MealParseResult> {
  const { auth } = getFirebase();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not signed in');

  const res = await fetch(`${API_BASE}/api/vision/meal`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ imageBase64, imageMediaType }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as MealParseResult;
}
