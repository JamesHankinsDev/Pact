'use client';

import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { GroupMemberDoc } from './groups';

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

/** Load the current group + its member display snapshots for the dashboard. */
export async function loadDashboardData(groupId: string): Promise<DashboardData> {
  const { db } = getFirebase();

  const groupSnap = await getDoc(doc(db, 'groups', groupId));
  if (!groupSnap.exists()) throw new Error('Group not found');
  const g = groupSnap.data() as Omit<DashboardGroup, 'id'>;
  const group: DashboardGroup = { id: groupId, ...g };

  const membersSnap = await getDocs(
    query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc')),
  );
  const members: GroupMemberDoc[] = membersSnap.docs.map((d) => d.data() as GroupMemberDoc);

  return { group, members };
}

/** Format an ISO week ("2026-W17") into a human-readable Mon–Sun range. */
export function formatWeekRange(isoWeek: string, locale = 'en-US'): { label: string; range: string } {
  const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return { label: isoWeek, range: '' };
  const year = parseInt(m[1]!, 10);
  const week = parseInt(m[2]!, 10);

  // ISO week: week 1 contains the year's first Thursday. Find Monday of week N.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return {
    label: `Week ${week}`,
    range: `${fmt(monday)} – ${fmt(sunday)}`,
  };
}

/** Get the day-of-month for each Mon–Sun of an ISO week. */
export function weekDayNumbers(isoWeek: string): number[] {
  const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return [];
  const year = parseInt(m[1]!, 10);
  const week = parseInt(m[2]!, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.getUTCDate();
  });
}

/** Today's index within the ISO week (0=Mon ... 6=Sun), or -1 if `isoWeek` isn't this week. */
export function todayIndexInWeek(isoWeek: string, now: Date = new Date()): number {
  const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return -1;
  const year = parseInt(m[1]!, 10);
  const week = parseInt(m[2]!, 10);

  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = today.getUTCDay() || 7;
  const thisWeekThu = new Date(today);
  thisWeekThu.setUTCDate(today.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(thisWeekThu.getUTCFullYear(), 0, 1));
  const thisWeekNum = Math.ceil(((thisWeekThu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  if (year !== thisWeekThu.getUTCFullYear() || week !== thisWeekNum) return -1;
  return dayNum - 1; // Mon=0
}
