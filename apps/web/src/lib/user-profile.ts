'use client';

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebase } from './firebase';
import { memberPalette } from '@pact/design-tokens';

export type UserProfile = {
  uid: string;
  displayName: string;
  initials: string;
  photoURL: string | null;
  color: string;
  email: string | null;
  phoneNumber: string | null;
  currentGroupId: string | null;
  createdAt: number; // ms; serverTimestamp resolves async
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

/** Read the user doc; returns null if it doesn't exist yet. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** Ensure a user doc exists for this auth user; creates it on first sign-in. */
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
