'use client';

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { getUserProfile, setCurrentGroup, type UserProfile } from './user-profile';
import { currentISOWeek } from './iso-week';
import type { PactCommitment } from '@pact/types';

export type GroupMemberDoc = {
  uid: string;
  name: string;
  initials: string;
  color: string;
  joinedAt: number;
};

async function writeMemberSnapshot(
  uid: string,
  groupId: string,
  profile: UserProfile,
): Promise<void> {
  const { db } = getFirebase();
  await setDoc(doc(db, 'groups', groupId, 'members', uid), {
    uid,
    name: profile.displayName,
    initials: profile.initials,
    color: profile.color,
    joinedAt: serverTimestamp(),
  });
}

const PACT_PREFIXES = ['HAYES', 'KEMP', 'NORTH', 'OAK', 'IRON', 'PINE', 'WOLF', 'ASH'];

function newInviteCode(): string {
  const prefix = PACT_PREFIXES[Math.floor(Math.random() * PACT_PREFIXES.length)];
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${suffix}`;
}

type CreateGroupInput = {
  uid: string;
  groupName: string;
  commitments: PactCommitment;
};

export type CreatedGroup = {
  groupId: string;
  inviteCode: string;
};

/**
 * Create a group + reserve its invite code in a single transaction, then
 * write the first weekly pact and update the user's currentGroupId.
 *
 * The pact write is intentionally outside the transaction: Firestore rules
 * evaluate the pact's `isMember(groupId)` against pre-transaction state, so
 * the group doc must already be visible before the pact write succeeds.
 */
export async function createGroupAndPact(input: CreateGroupInput): Promise<CreatedGroup> {
  const { db } = getFirebase();
  const week = currentISOWeek();

  let inviteCode = newInviteCode();
  let groupId = '';

  await runTransaction(db, async (tx) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const snap = await tx.get(doc(db, 'inviteCodes', inviteCode));
      if (!snap.exists()) break;
      inviteCode = newInviteCode();
    }

    const groupRef = doc(collection(db, 'groups'));
    groupId = groupRef.id;
    const inviteRef = doc(db, 'inviteCodes', inviteCode);

    tx.set(inviteRef, {
      groupId,
      creatorUid: input.uid,
      createdAt: serverTimestamp(),
    });

    tx.set(groupRef, {
      name: input.groupName,
      inviteCode,
      memberUids: [input.uid],
      currentWeek: week,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await setDoc(doc(db, 'groups', groupId, 'pacts', week), {
    week,
    commitments: input.commitments,
    memberUids: [input.uid],
    signedAt: serverTimestamp(),
  });

  const profile = await getUserProfile(input.uid);
  if (profile) await writeMemberSnapshot(input.uid, groupId, profile);

  await setCurrentGroup(input.uid, groupId);
  return { groupId, inviteCode };
}

export type JoinResult = {
  groupId: string;
  groupName: string;
  alreadyMember: boolean;
};

/** Pull a code out of a pasted URL or accept it bare. Returns null if malformed. */
export function normalizeInviteCode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  // Last path segment handles "pact.app/join/HAYES-7K2", "https://pact.app/join/HAYES-7K2", or just "HAYES-7K2".
  const lastSlash = trimmed.lastIndexOf('/');
  const code = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  return /^[A-Z]+-[A-Z0-9]{2,}$/.test(code) ? code : null;
}

/**
 * Look up an invite code, add the user to that group's memberUids, and set it
 * as their currentGroupId. The Firestore rules cap groups at 6 members and
 * only let non-members append their own uid (no other field changes), so
 * arrayUnion + a single update is sufficient — no transaction needed.
 */
export async function joinGroupByCode(uid: string, codeRaw: string): Promise<JoinResult> {
  const code = normalizeInviteCode(codeRaw);
  if (!code) {
    throw new Error("That doesn't look like an invite code. Try the link or the code at the end.");
  }

  const { db } = getFirebase();
  const inviteSnap = await getDoc(doc(db, 'inviteCodes', code));
  if (!inviteSnap.exists()) {
    throw new Error("We don't recognize that code. Double-check it with whoever sent it.");
  }

  const { groupId } = inviteSnap.data() as { groupId: string };
  const groupRef = doc(db, 'groups', groupId);

  try {
    await updateDoc(groupRef, {
      memberUids: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // Could be: already a member (the rule's size-grew-by-1 check fails because arrayUnion is a no-op),
    // group is full (6 max), or some other permission issue. Try reading it — members can read.
    const snap = await getDoc(groupRef).catch(() => null);
    if (snap?.exists()) {
      const data = snap.data() as { memberUids: string[]; name: string };
      if (data.memberUids.includes(uid)) {
        await setCurrentGroup(uid, groupId);
        return { groupId, groupName: data.name, alreadyMember: true };
      }
    }
    if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
      throw new Error('That pact is full (6 max).');
    }
    throw err;
  }

  const profile = await getUserProfile(uid);
  if (profile) await writeMemberSnapshot(uid, groupId, profile);

  await setCurrentGroup(uid, groupId);

  // Now that we're a member, we can read the group.
  const snap = await getDoc(groupRef);
  const data = snap.data() as { name?: string };
  return { groupId, groupName: data?.name ?? 'Your pact', alreadyMember: false };
}
