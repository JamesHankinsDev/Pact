'use client';

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { setCurrentGroup } from './user-profile';
import { currentISOWeek } from './iso-week';
import type { PactCommitment } from '@pact/types';

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

  await setCurrentGroup(input.uid, groupId);
  return { groupId, inviteCode };
}
