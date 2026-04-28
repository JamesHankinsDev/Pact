import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { getFirebase } from './firebase';

export type GroupMemberDoc = {
  uid: string;
  name: string;
  initials: string;
  color: string;
  joinedAt: number;
};

export type DashboardGroup = {
  id: string;
  name: string;
  inviteCode: string;
  memberUids: string[];
  currentWeek: string;
};

export type DashboardData = {
  group: DashboardGroup;
  members: GroupMemberDoc[];
};

export async function loadDashboardData(groupId: string): Promise<DashboardData> {
  const { db } = getFirebase();

  const groupSnap = await getDoc(doc(db, 'groups', groupId));
  if (!groupSnap.exists()) throw new Error('Group not found');
  const g = groupSnap.data() as Omit<DashboardGroup, 'id'>;
  const group: DashboardGroup = { id: groupId, ...g };

  const membersSnap = await getDocs(
    query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc')),
  );
  const members = membersSnap.docs.map((d) => d.data() as GroupMemberDoc);

  return { group, members };
}

export function todayDayOfMonth(): number {
  return new Date().getDate();
}

export function todayWeekdayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}
