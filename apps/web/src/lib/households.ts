'use client';

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { getUserProfile, setCurrentHousehold, type UserProfile } from './user-profile';

export type HouseholdMemberDoc = {
  uid: string;
  name: string;
  initials: string;
  color: string;
  joinedAt: number;
};

export type HouseholdDoc = {
  id: string;
  name: string;
  inviteCode: string;
  memberUids: string[];
  createdAt: number;
};

const HOUSEHOLD_PREFIXES = ['HOME', 'NEST', 'HEARTH', 'PANTRY', 'KITCH', 'FRIDGE', 'ROOST', 'OAKHOME'];

function newInviteCode(): string {
  const prefix = HOUSEHOLD_PREFIXES[Math.floor(Math.random() * HOUSEHOLD_PREFIXES.length)];
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${suffix}`;
}

async function writeMemberSnapshot(uid: string, householdId: string, profile: UserProfile): Promise<void> {
  const { db } = getFirebase();
  await setDoc(doc(db, 'households', householdId, 'members', uid), {
    uid,
    name: profile.displayName,
    initials: profile.initials,
    color: profile.color,
    joinedAt: serverTimestamp(),
  });
}

type CreateHouseholdInput = {
  uid: string;
  householdName: string;
};

export type CreatedHousehold = {
  householdId: string;
  inviteCode: string;
};

export async function createHousehold(input: CreateHouseholdInput): Promise<CreatedHousehold> {
  const { db } = getFirebase();

  let inviteCode = newInviteCode();
  let householdId = '';

  await runTransaction(db, async (tx) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const snap = await tx.get(doc(db, 'householdInviteCodes', inviteCode));
      if (!snap.exists()) break;
      inviteCode = newInviteCode();
    }

    const householdRef = doc(collection(db, 'households'));
    householdId = householdRef.id;
    const inviteRef = doc(db, 'householdInviteCodes', inviteCode);

    tx.set(inviteRef, {
      householdId,
      creatorUid: input.uid,
      createdAt: serverTimestamp(),
    });

    tx.set(householdRef, {
      name: input.householdName,
      inviteCode,
      memberUids: [input.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const profile = await getUserProfile(input.uid);
  if (profile) await writeMemberSnapshot(input.uid, householdId, profile);

  await setCurrentHousehold(input.uid, householdId);
  return { householdId, inviteCode };
}

export type JoinHouseholdResult = {
  householdId: string;
  householdName: string;
  alreadyMember: boolean;
};

export function normalizeHouseholdInviteCode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  const lastSlash = trimmed.lastIndexOf('/');
  const code = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  return /^[A-Z]+-[A-Z0-9]{2,}$/.test(code) ? code : null;
}

export async function joinHouseholdByCode(uid: string, codeRaw: string): Promise<JoinHouseholdResult> {
  const code = normalizeHouseholdInviteCode(codeRaw);
  if (!code) {
    throw new Error("That doesn't look like a household invite code.");
  }

  const { db } = getFirebase();
  const inviteSnap = await getDoc(doc(db, 'householdInviteCodes', code));
  if (!inviteSnap.exists()) {
    throw new Error("We don't recognize that code. Double-check it with whoever sent it.");
  }

  const { householdId } = inviteSnap.data() as { householdId: string };
  const householdRef = doc(db, 'households', householdId);

  try {
    await updateDoc(householdRef, {
      memberUids: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    const snap = await getDoc(householdRef).catch(() => null);
    if (snap?.exists()) {
      const data = snap.data() as { memberUids: string[]; name: string };
      if (data.memberUids.includes(uid)) {
        await setCurrentHousehold(uid, householdId);
        return { householdId, householdName: data.name, alreadyMember: true };
      }
    }
    if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
      throw new Error('That household is full (6 max).');
    }
    throw err;
  }

  const profile = await getUserProfile(uid);
  if (profile) await writeMemberSnapshot(uid, householdId, profile);
  await setCurrentHousehold(uid, householdId);

  const snap = await getDoc(householdRef);
  const data = snap.data() as { name?: string };
  return {
    householdId,
    householdName: data?.name ?? 'Your household',
    alreadyMember: false,
  };
}

export async function loadHousehold(householdId: string): Promise<HouseholdDoc | null> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'households', householdId));
  if (!snap.exists()) return null;
  const raw = snap.data() as Omit<HouseholdDoc, 'id' | 'createdAt'> & { createdAt?: { toMillis: () => number } };
  return {
    id: householdId,
    name: raw.name,
    inviteCode: raw.inviteCode,
    memberUids: raw.memberUids ?? [],
    createdAt: raw.createdAt?.toMillis?.() ?? 0,
  };
}

export async function loadHouseholdMembers(householdId: string): Promise<HouseholdMemberDoc[]> {
  const { db } = getFirebase();
  const snap = await getDocs(
    query(collection(db, 'households', householdId, 'members'), orderBy('joinedAt', 'asc')),
  );
  return snap.docs.map((d) => {
    const raw = d.data() as { uid?: string; name?: string; initials?: string; color?: string; joinedAt?: { toMillis: () => number } };
    return {
      uid: raw.uid ?? d.id,
      name: raw.name ?? 'Member',
      initials: raw.initials ?? '?',
      color: raw.color ?? '#daff3f',
      joinedAt: raw.joinedAt?.toMillis?.() ?? 0,
    };
  });
}
