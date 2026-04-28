import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { memberPalette } from '@pact/design-tokens';
import { getFirebase } from './firebase';

export type UserProfile = {
  uid: string;
  displayName: string;
  initials: string;
  photoURL: string | null;
  color: string;
  email: string | null;
  phoneNumber: string | null;
  currentGroupId: string | null;
  createdAt: number;
};

function initialsFor(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? fallback;
  return first.toUpperCase();
}

function pickColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % memberPalette.length;
  return memberPalette[idx]!;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function ensureUserProfile(authUser: User): Promise<UserProfile> {
  const existing = await getUserProfile(authUser.uid);
  if (existing) return existing;

  const fallback = (authUser.email ?? authUser.phoneNumber ?? 'P').slice(0, 1).toUpperCase();
  const profile: UserProfile = {
    uid: authUser.uid,
    displayName: authUser.displayName ?? authUser.email ?? authUser.phoneNumber ?? 'New member',
    initials: initialsFor(authUser.displayName, fallback),
    photoURL: authUser.photoURL,
    color: pickColor(authUser.uid),
    email: authUser.email,
    phoneNumber: authUser.phoneNumber,
    currentGroupId: null,
    createdAt: Date.now(),
  };

  const { db } = getFirebase();
  await setDoc(doc(db, 'users', authUser.uid), {
    ...profile,
    createdAt: serverTimestamp(),
  });
  return profile;
}

export async function setCurrentGroup(uid: string, groupId: string): Promise<void> {
  const { db } = getFirebase();
  await setDoc(doc(db, 'users', uid), { currentGroupId: groupId }, { merge: true });
}
