'use client';

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { GroupMemberDoc } from './groups';
import { workoutFromSnap, type WorkoutRecord } from './workouts';
import { weightFromSnap, type WeightRecord } from './weight';
import type { Macros, MealParseItem, PactCommitment } from '@pact/types';

export type { WorkoutRecord, WeightRecord };

export type DashboardGroup = {
  id: string;
  name: string;
  inviteCode: string;
  memberUids: string[];
  currentWeek: string;
};

/** UI-shaped meal record — `loggedAt` flattened to ms for easy comparisons. */
export type MealRecord = {
  id: string;
  memberId: string;
  loggedAt: number;
  photoUrl: string | null;
  totals: Macros;
  items: MealParseItem[];
  notes: string | null;
};

export type WeekPactRecord = {
  week: string;
  signedAt: number;
  commitments: PactCommitment;
  memberUids: string[];
};

export type DashboardData = {
  group: DashboardGroup;
  members: GroupMemberDoc[];
  /** Last 7 days of meals across the whole group, newest first. */
  meals: MealRecord[];
  /** Last 7 days of workouts across the whole group, newest first. */
  workouts: WorkoutRecord[];
  /** Last ~8 weeks of weight logs across the whole group, newest first. */
  weightLogs: WeightRecord[];
  /** This week's signed pact, if any. */
  pact: WeekPactRecord | null;
};

const WEIGHT_LOOKBACK_MS = 9 * 7 * 24 * 60 * 60 * 1000; // 9 weeks of buffer for "last 8 weeks" charts

const MEALS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MEALS_HARD_LIMIT = 200;

/** Load the current group + members + recent meals + this week's pact. */
export async function loadDashboardData(groupId: string): Promise<DashboardData> {
  const { db } = getFirebase();

  const groupSnap = await getDoc(doc(db, 'groups', groupId));
  if (!groupSnap.exists()) throw new Error('Group not found');
  const g = groupSnap.data() as Omit<DashboardGroup, 'id'>;
  const group: DashboardGroup = { id: groupId, ...g };

  const sinceMs = Date.now() - MEALS_LOOKBACK_MS;
  const sinceTs = Timestamp.fromMillis(sinceMs);

  const weightSinceTs = Timestamp.fromMillis(Date.now() - WEIGHT_LOOKBACK_MS);

  const [membersSnap, mealsSnap, pactSnap, workoutsSnap, weightSnap] = await Promise.all([
    getDocs(query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc'))),
    getDocs(
      query(
        collection(db, 'groups', groupId, 'meals'),
        where('loggedAt', '>=', sinceTs),
        orderBy('loggedAt', 'desc'),
        limit(MEALS_HARD_LIMIT),
      ),
    ),
    getDoc(doc(db, 'groups', groupId, 'pacts', group.currentWeek)),
    getDocs(
      query(
        collection(db, 'groups', groupId, 'workouts'),
        where('loggedAt', '>=', sinceTs),
        orderBy('loggedAt', 'desc'),
        limit(MEALS_HARD_LIMIT),
      ),
    ),
    getDocs(
      query(
        collection(db, 'groups', groupId, 'weightLogs'),
        where('loggedAt', '>=', weightSinceTs),
        orderBy('loggedAt', 'desc'),
        limit(MEALS_HARD_LIMIT),
      ),
    ),
  ]);

  const members: GroupMemberDoc[] = membersSnap.docs.map((d) => d.data() as GroupMemberDoc);

  const meals: MealRecord[] = mealsSnap.docs.map((d) => {
    const raw = d.data() as {
      memberId: string;
      loggedAt?: Timestamp;
      photoUrl?: string;
      totals?: Macros;
      items?: MealParseItem[];
      notes?: string | null;
    };
    return {
      id: d.id,
      memberId: raw.memberId,
      loggedAt: raw.loggedAt?.toMillis() ?? 0,
      photoUrl: raw.photoUrl ?? null,
      totals: raw.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      items: raw.items ?? [],
      notes: raw.notes ?? null,
    };
  });

  const pact: WeekPactRecord | null = pactSnap.exists()
    ? (() => {
        const r = pactSnap.data() as {
          week: string;
          signedAt?: Timestamp;
          commitments?: PactCommitment;
          memberUids?: string[];
        };
        return {
          week: r.week,
          signedAt: r.signedAt?.toMillis() ?? 0,
          commitments: r.commitments ?? {},
          memberUids: r.memberUids ?? [],
        };
      })()
    : null;

  const workouts: WorkoutRecord[] = workoutsSnap.docs.map((d) => workoutFromSnap(d));
  const weightLogs: WeightRecord[] = weightSnap.docs.map((d) => weightFromSnap(d));

  return { group, members, meals, workouts, weightLogs, pact };
}

/** Sum macros across a list of meals. */
export function sumMacros(meals: MealRecord[]): Macros {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.totals.calories,
      proteinG: acc.proteinG + m.totals.proteinG,
      carbsG: acc.carbsG + m.totals.carbsG,
      fatG: acc.fatG + m.totals.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Filter meals to just those logged today, in the user's local timezone. */
export function mealsLoggedToday(meals: MealRecord[], now: Date = new Date()): MealRecord[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return meals.filter((m) => m.loggedAt >= start);
}

/** A short relative-time string ("now", "12m", "3h", "2d", "Apr 21"). */
export function shortRelativeTime(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
