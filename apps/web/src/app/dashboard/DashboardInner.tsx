'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarStack, Card, Chip, Eyebrow, Icon } from '@/components/primitives';
import { HomeAuthBar } from '@/components/HomeAuthBar';
import { useAuth } from '@/lib/auth-context';
import {
  formatWeekRange,
  loadDashboardData,
  mealsLoggedToday,
  shortRelativeTime,
  sumMacros,
  todayIndexInWeek,
  weekDayNumbers,
  type DashboardData,
  type MealRecord,
  type WeightRecord,
  type WorkoutRecord,
} from '@/lib/group-data';
import { loadHouseholdInventory, type InventoryRecord } from '@/lib/inventory';
import { weeklyAveragesByMember } from '@/lib/weight';
import {
  loadRecentUserWorkoutsDetailed,
  workoutVolume,
  type WorkoutDetail,
} from '@/lib/workouts';
import {
  computeCrewFeed,
  computeMemberAchievements,
  TIER_COLOR,
  topTierByCategory,
  type CrewFeedItem,
  type EarnedAchievement,
} from '@/lib/achievements';
import styles from './dashboard.module.css';
import type { GroupMemberDoc } from '@/lib/groups';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DashboardInner() {
  const router = useRouter();
  const { user, profile, loading: authLoading, configured } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [userWorkouts, setUserWorkouts] = useState<WorkoutDetail[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/dashboard')}`);
      return;
    }
    if (!profile?.currentGroupId) return;
    let cancelled = false;
    const groupId = profile.currentGroupId;
    const householdId = profile.currentHouseholdId;
    const sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    loadDashboardData(groupId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        setLoadErr(err instanceof Error ? err.message : 'Could not load your pact');
      });
    // Detailed workouts (with per-set weight × reps) for the user's hero card.
    // Failure here is non-fatal — the card just falls back to zero volume.
    loadRecentUserWorkoutsDetailed(groupId, user.uid, sinceMs)
      .then((w) => { if (!cancelled) setUserWorkouts(w); })
      .catch(() => {});
    // Inventory is household-scoped now. Skip the load if the user hasn't
    // set up a household yet — the card will show a setup prompt instead.
    if (householdId) {
      loadHouseholdInventory(householdId)
        .then((items) => { if (!cancelled) setInventory(items); })
        .catch(() => {});
    } else {
      setInventory([]);
    }
    return () => { cancelled = true; };
  }, [authLoading, user, profile, router]);

  if (!configured) return <FullPageNote title="Firebase not configured" body="Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local and restart pnpm dev." />;
  if (authLoading || !user) return <FullPageNote title="Loading…" />;
  if (!profile?.currentGroupId) return <NoGroupPrompt />;
  if (loadErr) return <FullPageNote title="Couldn't load your pact" body={loadErr} />;
  if (!data) return <FullPageNote title="Loading your pact…" />;

  return (
    <Dashboard
      data={data}
      userWorkouts={userWorkouts}
      inventory={inventory}
      hasHousehold={!!profile?.currentHouseholdId}
    />
  );
}

/* ── Main dashboard ──────────────────────────────────────────────────── */

function Dashboard({
  data,
  userWorkouts,
  inventory,
  hasHousehold,
}: {
  data: DashboardData;
  userWorkouts: WorkoutDetail[];
  inventory: InventoryRecord[];
  hasHousehold: boolean;
}) {
  const { user } = useAuth();
  const { group, members, meals, workouts, weightLogs } = data;
  const week = formatWeekRange(group.currentWeek);
  const dayNums = weekDayNumbers(group.currentWeek);
  const todayIdx = todayIndexInWeek(group.currentWeek);
  const stackMembers = members.map((m) => ({ initials: m.initials, color: m.color }));

  const todayMeals = useMemo(() => mealsLoggedToday(meals), [meals]);
  const todayTotals = useMemo(() => sumMacros(todayMeals), [todayMeals]);

  const todayUserWorkouts = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return userWorkouts.filter((w) => w.loggedAt >= startMs);
  }, [userWorkouts]);

  const todayTraining = useMemo(() => {
    const sets = todayUserWorkouts.reduce((a, w) => a + w.totalSets, 0);
    const volume = todayUserWorkouts.reduce((a, w) => a + workoutVolume(w), 0);
    return { count: todayUserWorkouts.length, sets, volume };
  }, [todayUserWorkouts]);

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m])),
    [members],
  );

  const ownAchievements = useMemo<EarnedAchievement[]>(() => {
    if (!user) return [];
    const ownMeals = meals.filter((m) => m.memberId === user.uid);
    const ownWorkouts = workouts.filter((w) => w.memberId === user.uid);
    const ownWeights = weightLogs.filter((wl) => wl.memberId === user.uid);
    return topTierByCategory(
      computeMemberAchievements({
        meals: ownMeals,
        workouts: ownWorkouts,
        weightLogs: ownWeights,
        detailedWorkouts: userWorkouts,
      }),
    );
  }, [user, meals, workouts, weightLogs, userWorkouts]);

  return (
    <div className={styles.shell}>
      <TopBar
        week={week}
        stackMembers={stackMembers}
        groupName={group.name}
        inviteCode={group.inviteCode}
      />
      <div className={styles.body}>
        <HeroStrip
          group={group}
          members={members}
          todayMealCount={todayMeals.length}
          todayCalories={todayTotals.calories}
          todayProteinG={todayTotals.proteinG}
          todayWorkoutCount={todayTraining.count}
          todaySets={todayTraining.sets}
          todayVolume={todayTraining.volume}
        />
        <QuickLog />
        <YourAchievementsRow achievements={ownAchievements} />
        <WeekGrid
          members={members}
          meals={meals}
          workouts={workouts}
          dayNums={dayNums}
          todayIdx={todayIdx}
          isoWeek={group.currentWeek}
        />
        <BottomRow
          meals={meals}
          workouts={workouts}
          memberById={memberById}
          inventory={inventory}
          hasHousehold={hasHousehold}
          weightLogs={weightLogs}
          selfUid={user?.uid ?? null}
        />
      </div>
    </div>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────── */

function TopBar({
  week,
  stackMembers,
  groupName,
  inviteCode,
}: {
  week: { label: string; range: string };
  stackMembers: Array<{ initials: string; color: string }>;
  groupName: string;
  inviteCode: string;
}) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--f-display)',
              fontWeight: 800,
              fontSize: 16,
              color: 'var(--ink)',
              letterSpacing: '-0.04em',
            }}
          >
            P
          </div>
          <span className="display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-on-dark)' }}>
            PACT
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['week', 'crew', 'archive'] as const).map((t) => {
            const active = t === 'week';
            return (
              <button
                key={t}
                type="button"
                style={{
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: active ? 'var(--text-on-dark)' : 'var(--text-on-dark-mute)',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontFamily: 'var(--f-ui)',
                  fontWeight: 600,
                  fontSize: 13,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {t === 'week' ? 'This week' : t}
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.topBarRight}>
        <span
          className={`mono ${styles.weekLabel}`}
          style={{
            fontSize: 11,
            color: 'var(--text-on-dark-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {week.label} · {week.range}
        </span>
        {stackMembers.length > 0 && <AvatarStack members={stackMembers} size={28} dark />}
        <InviteButton groupName={groupName} inviteCode={inviteCode} />
        <HomeAuthBar />
      </div>
    </div>
  );
}

/* ── Quick log row ───────────────────────────────────────────────────── */

function QuickLog() {
  const items: Array<{ href: string; icon: 'bowl' | 'dumbbell' | 'cart' | 'weight' | 'home'; label: string; sub: string }> = [
    { href: '/log/meal',      icon: 'bowl',     label: 'Log a meal',     sub: 'Snap a photo · macros parsed' },
    { href: '/workout',       icon: 'dumbbell', label: 'Log a workout',  sub: 'Sets, reps, weight'           },
    { href: '/log/groceries', icon: 'cart',     label: 'Scan groceries', sub: 'Receipt → pantry'             },
    { href: '/log/body',      icon: 'weight',   label: 'Log weight',     sub: 'Trend, optional photo'        },
    { href: '/household',     icon: 'home',     label: 'Household',      sub: 'Share fridge & pantry'        },
  ];
  return (
    <div className={styles.quickLog}>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={styles.quickLogCard}>
          <span className={styles.quickLogIcon}>
            <Icon name={it.icon} size={18} color="var(--lime)" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.quickLogLabel}>{it.label}</div>
            <div className={styles.quickLogSub}>{it.sub}</div>
          </div>
          <Icon name="chevron" size={14} color="var(--text-on-dark-faint)" />
        </Link>
      ))}
    </div>
  );
}

/* ── Hero strip ──────────────────────────────────────────────────────── */

function HeroStrip({
  group,
  members,
  todayMealCount,
  todayCalories,
  todayProteinG,
  todayWorkoutCount,
  todaySets,
  todayVolume,
}: {
  group: { name: string; memberUids: string[] };
  members: GroupMemberDoc[];
  todayMealCount: number;
  todayCalories: number;
  todayProteinG: number;
  todayWorkoutCount: number;
  todaySets: number;
  todayVolume: number;
}) {
  const stack = members.slice(0, 4).map((m) => ({ initials: m.initials, color: m.color }));
  return (
    <div className={styles.heroGrid}>
      <div
        style={{
          background: 'var(--lime)',
          color: 'var(--ink)',
          borderRadius: 22,
          padding: '22px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div>
          <Eyebrow color="rgba(10,10,10,0.55)">{group.name.toUpperCase()} · ALL IN</Eyebrow>
          <div className="numeral" style={{ fontSize: 84, marginTop: 4 }}>
            23
            <span
              style={{
                fontSize: 20,
                fontFamily: 'var(--f-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginLeft: 6,
              }}
            >
              days
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
            Best: 31d (Feb) · Don&rsquo;t break it
          </div>
        </div>
        {stack.length > 0 && (
          <div style={{ display: 'flex' }}>
            {stack.map((m, i) => (
              <div key={i} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <Avatar initials={m.initials} color={m.color} size={48} ring />
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/meals" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Card style={{ padding: '20px 22px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Eyebrow>TODAY · CALORIES</Eyebrow>
            <Icon name="chevron" size={14} color="var(--text-on-dark-faint)" />
          </div>
          <div className="numeral" style={{ fontSize: 60, marginTop: 4 }}>
            {Math.round(todayCalories).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8 }}>
            {todayMealCount === 0
              ? 'No meals yet — tap to log one'
              : `${todayMealCount} meal${todayMealCount === 1 ? '' : 's'} · ${Math.round(todayProteinG)}g protein`}
          </div>
        </Card>
      </Link>

      <Link href="/workouts" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Card style={{ padding: '20px 22px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Eyebrow>TODAY · LBS LIFTED</Eyebrow>
            <Icon name="chevron" size={14} color="var(--text-on-dark-faint)" />
          </div>
          <div className="numeral" style={{ fontSize: 60, marginTop: 4 }}>
            {Math.round(todayVolume).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8 }}>
            {todayWorkoutCount === 0
              ? 'No training yet — tap to log one'
              : `${todayWorkoutCount} workout${todayWorkoutCount === 1 ? '' : 's'} · ${todaySets} set${todaySets === 1 ? '' : 's'}`}
          </div>
        </Card>
      </Link>
    </div>
  );
}

/* ── Week grid ───────────────────────────────────────────────────────── */

const ACTIVITY_PALETTE = {
  lime: '#daff3f',
  sky: '#7cd4ff',
  coral: '#ff6b4a',
  plum: '#c58cff',
} as const;

const ACTIVITY_LABEL = {
  dumbbell: 'lift',
  bowl: 'meal',
  book: 'pract',
  run: 'run',
  flame: 'pr',
} as const;

type ActivityKind = keyof typeof ACTIVITY_LABEL;
type ActivityColor = keyof typeof ACTIVITY_PALETTE;
type Activity = { color: ActivityColor; kind: ActivityKind };

/**
 * Build the per-day activity for one member from real Firestore data.
 * Wired modules: workouts (lime/dumbbell), meals (sky/bowl). Practices and
 * PRs will fill in as those modules land.
 */
function memberWeekActivity(
  memberUid: string,
  weekDayStarts: number[],
  meals: MealRecord[],
  workouts: WorkoutRecord[],
): Activity[][] {
  const dayMs = 24 * 60 * 60 * 1000;
  return weekDayStarts.map((start) => {
    const end = start + dayMs;
    const dayMeals = meals.filter(
      (m) => m.memberId === memberUid && m.loggedAt >= start && m.loggedAt < end,
    );
    const dayWorkouts = workouts.filter(
      (w) => w.memberId === memberUid && w.loggedAt >= start && w.loggedAt < end,
    );
    const pills: Activity[] = [];
    if (dayWorkouts.length > 0) pills.push({ color: 'lime', kind: 'dumbbell' });
    if (dayMeals.length > 0) pills.push({ color: 'sky', kind: 'bowl' });
    return pills;
  });
}

/**
 * Compute the start-of-day timestamp (local time, ms) for each Mon–Sun
 * of the ISO week.
 */
function weekDayStarts(isoWeek: string): number[] {
  const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return [];
  const year = parseInt(m[1]!, 10);
  const week = parseInt(m[2]!, 10);
  // Monday of ISO week N (in local time)
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getTime();
  });
}

function ActivityPill({ activity }: { activity: Activity }) {
  return (
    <div
      style={{
        background: ACTIVITY_PALETTE[activity.color],
        color: 'var(--ink)',
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 10,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Icon name={activity.kind} size={11} color="#0a0a0a" strokeWidth={2} />
      <span style={{ textTransform: 'capitalize' }}>{ACTIVITY_LABEL[activity.kind]}</span>
    </div>
  );
}

function WeekGrid({
  members,
  meals,
  workouts,
  dayNums,
  todayIdx,
  isoWeek,
}: {
  members: GroupMemberDoc[];
  meals: MealRecord[];
  workouts: WorkoutRecord[];
  dayNums: number[];
  todayIdx: number;
  isoWeek: string;
}) {
  const dayStarts = useMemo(() => weekDayStarts(isoWeek), [isoWeek]);
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Eyebrow>THE WEEK · MON → SUN</Eyebrow>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            Together this week
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/workouts"
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--text-on-dark-mute)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              letterSpacing: '0.1em',
            }}
          >
            TRAINING <Icon name="chevron" size={11} color="var(--text-on-dark-mute)" />
          </Link>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip color="ghost"><DotSwatch color="#daff3f" />WORKOUT</Chip>
            <Chip color="ghost"><DotSwatch color="#7cd4ff" />MEAL</Chip>
            <Chip color="ghost"><DotSwatch color="#ff6b4a" />PR</Chip>
            <Chip color="ghost"><DotSwatch color="#c58cff" />PRACTICE</Chip>
          </div>
        </div>
      </div>

      <div className={styles.weekGridScroll}>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px repeat(7, 1fr)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ padding: '14px 18px' }} />
          {WEEKDAYS.map((d, i) => {
            const isToday = i === todayIdx;
            return (
              <div
                key={d}
                style={{
                  padding: '14px 12px',
                  textAlign: 'center',
                  borderLeft: '1px solid rgba(255,255,255,0.04)',
                  background: isToday ? 'rgba(218,255,63,0.04)' : 'transparent',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--f-mono)',
                    color: 'var(--text-on-dark-mute)',
                    textTransform: 'uppercase',
                  }}
                >
                  {d}
                </div>
                <div
                  className="numeral"
                  style={{
                    fontSize: 22,
                    marginTop: 2,
                    color: isToday ? 'var(--lime)' : 'var(--text-on-dark)',
                  }}
                >
                  {dayNums[i] ?? ''}
                </div>
              </div>
            );
          })}
        </div>

        {members.slice(0, 6).map((m, idx) => {
          const schedule = memberWeekActivity(m.uid, dayStarts, meals, workouts);
          const completed = schedule.filter((day) => day.length > 0).length;
          return (
            <div
              key={m.uid}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px repeat(7, 1fr)',
                borderBottom:
                  idx < Math.min(members.length, 6) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                minHeight: 90,
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Avatar initials={m.initials} color={m.color} size={32} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-on-dark-mute)' }}>
                    {completed}/7
                  </div>
                </div>
              </div>
              {schedule.map((day, di) => {
                const isToday = di === todayIdx;
                return (
                  <div
                    key={di}
                    style={{
                      padding: 8,
                      borderLeft: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      background: isToday ? 'rgba(218,255,63,0.02)' : 'transparent',
                    }}
                  >
                    {day.length === 0 ? (
                      <div style={{ height: 8 }} />
                    ) : (
                      day.map((a, k) => <ActivityPill key={k} activity={a} />)
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </Card>
      </div>
    </div>
  );
}

function DotSwatch({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: color,
        display: 'inline-block',
      }}
    />
  );
}

/* ── Bottom row ──────────────────────────────────────────────────────── */

/* ── Weight trend card ───────────────────────────────────────────────── */

function WeightTrendCard({
  weightLogs,
  memberById,
  selfUid,
}: {
  weightLogs: WeightRecord[];
  memberById: Record<string, GroupMemberDoc>;
  selfUid: string | null;
}) {
  const series = useMemo(() => weeklyAveragesByMember(weightLogs, 8), [weightLogs]);
  const latest = useMemo(() => latestByMember(weightLogs), [weightLogs]);

  if (latest.length === 0) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <Eyebrow>WEIGHT · LAST 8 WEEKS</Eyebrow>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              Trends
            </div>
          </div>
          <Chip color="ghost">EMPTY</Chip>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
          No weight logs yet. Tap{' '}
          <Link href="/log/body" style={{ color: 'var(--lime)' }}>
            Log weight
          </Link>{' '}
          to start the trend. Crew sees the number; photos stay private.
        </p>
      </Card>
    );
  }

  // Header chip — only show your own delta, since crew weight is private.
  let headerChip: { label: string; tone: 'lime' | 'ghost' };
  const ownSeries = selfUid ? series.find((s) => s.memberId === selfUid) : undefined;
  if (ownSeries && ownSeries.points.length >= 2) {
    const delta = ownSeries.points[ownSeries.points.length - 1]!.avgLb - ownSeries.points[0]!.avgLb;
    const sign = delta < 0 ? '−' : '+';
    headerChip = {
      label: `${sign}${Math.abs(delta).toFixed(1)} LB`,
      tone: delta < 0 ? 'lime' : 'ghost',
    };
  } else {
    headerChip = { label: `${latest.length} LOGGED`, tone: 'ghost' };
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <Eyebrow>WEIGHT · LAST 8 WEEKS</Eyebrow>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            Trends
          </div>
        </div>
        <Chip color={headerChip.tone}>{headerChip.label}</Chip>
      </div>

      <LatestWeightList latest={latest} memberById={memberById} selfUid={selfUid} />

      {series.length > 0 ? (
        <WeightTrendChart series={series} memberById={memberById} selfUid={selfUid} />
      ) : (
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-on-dark-faint)',
            margin: '14px 0 0',
            lineHeight: 1.5,
            fontFamily: 'var(--f-mono)',
            letterSpacing: '0.04em',
          }}
        >
          TREND APPEARS WHEN ANY MEMBER HAS LOGGED ACROSS 2+ WEEKS.
        </p>
      )}
    </Card>
  );
}

type LatestEntry = {
  memberId: string;
  weightLb: number;
  loggedAt: number;
  /** Most recent log before this one, used for the small delta. */
  prev?: { weightLb: number; loggedAt: number };
};

function latestByMember(logs: WeightRecord[]): LatestEntry[] {
  const byMember = new Map<string, WeightRecord[]>();
  for (const log of logs) {
    const arr = byMember.get(log.memberId);
    if (arr) arr.push(log);
    else byMember.set(log.memberId, [log]);
  }
  return Array.from(byMember.entries()).map(([memberId, entries]) => {
    const sorted = [...entries].sort((a, b) => b.loggedAt - a.loggedAt);
    const newest = sorted[0]!;
    const prev = sorted[1];
    return {
      memberId,
      weightLb: newest.weightLb,
      loggedAt: newest.loggedAt,
      prev: prev ? { weightLb: prev.weightLb, loggedAt: prev.loggedAt } : undefined,
    };
  });
}

function LatestWeightList({
  latest,
  memberById,
  selfUid,
}: {
  latest: LatestEntry[];
  memberById: Record<string, GroupMemberDoc>;
  selfUid: string | null;
}) {
  // Sort own row first.
  const ordered = [...latest].sort((a, b) => {
    if (a.memberId === selfUid) return -1;
    if (b.memberId === selfUid) return 1;
    return b.loggedAt - a.loggedAt;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ordered.map((e) => {
        const member = memberById[e.memberId];
        const dot = member?.color ?? '#daff3f';
        const name = member?.name ?? 'Member';
        const isSelf = e.memberId === selfUid;
        const delta = e.prev ? e.weightLb - e.prev.weightLb : null;

        return (
          <div
            key={e.memberId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
              {name}
              {isSelf && (
                <span
                  className="mono"
                  style={{ fontSize: 9, color: 'var(--text-on-dark-faint)', marginLeft: 6, letterSpacing: '0.1em' }}
                >
                  YOU
                </span>
              )}
            </span>

            {isSelf ? (
              <>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 14, color: 'var(--text-on-dark)' }}>
                  {e.weightLb.toFixed(1)}
                  <span style={{ color: 'var(--text-on-dark-mute)', marginLeft: 4, fontSize: 11 }}>lb</span>
                </span>
                <span
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: 10,
                    color:
                      delta == null
                        ? 'var(--text-on-dark-faint)'
                        : delta < 0
                          ? 'var(--lime)'
                          : delta > 0
                            ? 'var(--text-on-dark-mute)'
                            : 'var(--text-on-dark-faint)',
                    minWidth: 60,
                    textAlign: 'right',
                  }}
                >
                  {delta == null
                    ? shortRelativeTime(e.loggedAt).toUpperCase()
                    : `${delta < 0 ? '−' : delta > 0 ? '+' : ''}${Math.abs(delta).toFixed(1)} · ${shortRelativeTime(e.loggedAt).toUpperCase()}`}
                </span>
              </>
            ) : (
              // Crew row — no exact number, just "logged X ago" so they
              // can still see momentum without seeing weight.
              <span
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: 10,
                  color: 'var(--text-on-dark-mute)',
                  letterSpacing: '0.1em',
                }}
              >
                LOGGED {shortRelativeTime(e.loggedAt).toUpperCase()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeightTrendChart({
  series,
  memberById,
  selfUid,
}: {
  series: ReturnType<typeof weeklyAveragesByMember>;
  memberById: Record<string, GroupMemberDoc>;
  selfUid: string | null;
}) {
  const allWeights = series.flatMap((s) => s.points.map((p) => p.avgLb));
  const minLb = Math.min(...allWeights);
  const maxLb = Math.max(...allWeights);
  const allWeeks = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.weekStart)))).sort(
    (a, b) => a - b,
  );

  const W = 320;
  const H = 120;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 12;
  const range = Math.max(1, maxLb - minLb);

  function xFor(weekStart: number): number {
    if (allWeeks.length === 1) return W / 2;
    const minWeek = allWeeks[0]!;
    const maxWeek = allWeeks[allWeeks.length - 1]!;
    return ((weekStart - minWeek) / (maxWeek - minWeek)) * W;
  }
  function yFor(lb: number): number {
    return H - PAD_BOTTOM - ((lb - minLb) / range) * (H - PAD_TOP - PAD_BOTTOM);
  }

  // Render crew members first (faint silhouettes), then own series on top.
  const crew = series.filter((s) => s.memberId !== selfUid);
  const own = series.find((s) => s.memberId === selfUid);

  return (
    <div style={{ marginTop: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
        {crew.map((s) => {
          const path = s.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.weekStart).toFixed(1)},${yFor(p.avgLb).toFixed(1)}`)
            .join(' ');
          return (
            <g key={s.memberId} opacity={0.25}>
              <path
                d={path}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="3 3"
              />
            </g>
          );
        })}
        {own && (
          <g key={own.memberId}>
            <path
              d={own.points
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.weekStart).toFixed(1)},${yFor(p.avgLb).toFixed(1)}`)
                .join(' ')}
              stroke={memberById[own.memberId]?.color ?? '#daff3f'}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {own.points.map((p, i) => (
              <circle
                key={i}
                cx={xFor(p.weekStart)}
                cy={yFor(p.avgLb)}
                r={3}
                fill={memberById[own.memberId]?.color ?? '#daff3f'}
              />
            ))}
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {own && memberById[own.memberId] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 8, height: 2, background: memberById[own.memberId]!.color }} />
            You
          </div>
        )}
        {crew.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-on-dark-mute)',
            }}
          >
            <span style={{ width: 8, height: 2, background: 'rgba(255,255,255,0.4)' }} />
            Crew (private)
          </div>
        )}
      </div>
    </div>
  );
}

function BottomRow({
  meals,
  workouts,
  memberById,
  inventory,
  hasHousehold,
  weightLogs,
  selfUid,
}: {
  meals: MealRecord[];
  workouts: WorkoutRecord[];
  memberById: Record<string, GroupMemberDoc>;
  inventory: InventoryRecord[];
  hasHousehold: boolean;
  weightLogs: WeightRecord[];
  selfUid: string | null;
}) {
  return (
    <div className={styles.bottomGrid}>
      <WeightTrendCard weightLogs={weightLogs} memberById={memberById} selfUid={selfUid} />

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          <div>
            <Eyebrow>FRIDGE & PANTRY</Eyebrow>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              Inventory
            </div>
          </div>
          <Chip color="ghost">
            {!hasHousehold
              ? 'NO HOUSEHOLD'
              : inventory.length === 0
                ? 'EMPTY'
                : inventory.length >= 20
                  ? '20+ ITEMS'
                  : `${inventory.length} ITEM${inventory.length === 1 ? '' : 'S'}`}
          </Chip>
        </div>
        {!hasHousehold ? (
          <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Inventory lives with the people you share a kitchen with. Tap{' '}
            <Link href="/household" style={{ color: 'var(--lime)' }}>Household</Link>{' '}
            to set one up.
          </p>
        ) : inventory.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            No items yet. Tap <Link href="/log/groceries" style={{ color: 'var(--lime)' }}>Scan groceries</Link> to populate the pantry.
          </p>
        ) : (
          inventory.slice(0, 5).map((it, i, arr) => (
            <div
              key={it.id}
              style={{
                paddingBottom: 8,
                marginBottom: 8,
                borderBottom:
                  i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.name}
                </span>
                <span className="mono" style={{ color: 'var(--text-on-dark)', whiteSpace: 'nowrap' }}>
                  {formatQuantity(it.quantity)} {it.unit}
                </span>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--text-on-dark-faint)',
                  marginTop: 2,
                  display: 'flex',
                  gap: 8,
                }}
              >
                {it.estCost != null && <span>${it.estCost.toFixed(2)}</span>}
                <span>{shortRelativeTime(it.addedAt)} ago</span>
              </div>
            </div>
          ))
        )}
      </Card>

      <CrewFeedCard
        meals={meals}
        workouts={workouts}
        weightLogs={weightLogs}
        memberById={memberById}
        selfUid={selfUid}
      />
    </div>
  );
}

function formatQuantity(q: number): string {
  if (q === Math.floor(q)) return q.toString();
  return q.toFixed(2).replace(/\.?0+$/, '');
}

/* ── Your achievements row ───────────────────────────────────────────── */

function YourAchievementsRow({ achievements }: { achievements: EarnedAchievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '0 4px',
        }}
      >
        <Eyebrow>YOUR ACHIEVEMENTS</Eyebrow>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--text-on-dark-faint)', letterSpacing: '0.1em' }}
        >
          {achievements.length} EARNED
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {achievements.map((a) => (
          <BadgeChip key={a.def.id} achievement={a} />
        ))}
      </div>
    </div>
  );
}

function BadgeChip({ achievement }: { achievement: EarnedAchievement }) {
  const color = TIER_COLOR[achievement.def.tier];
  return (
    <div
      title={achievement.def.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${color}66`,
        background: `${color}1a`,
        fontSize: 12,
        fontFamily: 'var(--f-ui)',
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          background: color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={achievement.def.icon} size={11} color="#0a0a0a" strokeWidth={2.2} />
      </span>
      <span style={{ color: 'var(--text-on-dark)' }}>{achievement.def.label}</span>
      <span
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--text-on-dark-mute)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {achievement.def.tier}
      </span>
    </div>
  );
}

/* ── Crew feed card ──────────────────────────────────────────────────── */

function CrewFeedCard({
  meals,
  workouts,
  weightLogs,
  memberById,
  selfUid,
}: {
  meals: MealRecord[];
  workouts: WorkoutRecord[];
  weightLogs: WeightRecord[];
  memberById: Record<string, GroupMemberDoc>;
  selfUid: string | null;
}) {
  const items = useMemo<CrewFeedItem[]>(() => {
    const buckets = new Map<string, { meals: MealRecord[]; workouts: WorkoutRecord[]; weightLogs: WeightRecord[] }>();
    const ensure = (uid: string) => {
      let b = buckets.get(uid);
      if (!b) {
        b = { meals: [], workouts: [], weightLogs: [] };
        buckets.set(uid, b);
      }
      return b;
    };
    for (const m of meals) ensure(m.memberId).meals.push(m);
    for (const w of workouts) ensure(w.memberId).workouts.push(w);
    for (const wl of weightLogs) ensure(wl.memberId).weightLogs.push(wl);

    const perMember = Array.from(buckets.entries()).map(([memberUid, b]) => ({
      memberUid,
      meals: b.meals,
      workouts: b.workouts,
      weightLogs: b.weightLogs,
    }));

    return computeCrewFeed(perMember, selfUid);
  }, [meals, workouts, weightLogs, selfUid]);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <Eyebrow>CREW · MILESTONES</Eyebrow>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            Activity feed
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
          No milestones yet. Log meals and workouts to start unlocking achievements — your crew sees the badges, not the numbers.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.slice(0, 6).map((item) => (
            <CrewFeedRow key={item.id} item={item} member={memberById[item.memberUid]} />
          ))}
        </div>
      )}
    </Card>
  );
}

function CrewFeedRow({ item, member }: { item: CrewFeedItem; member: GroupMemberDoc | undefined }) {
  const name = member?.name ?? 'Member';
  const initials = member?.initials ?? '?';
  const color = member?.color ?? 'var(--lime)';
  const isPositive = item.tone === 'positive';
  const accent = isPositive ? 'var(--lime)' : 'var(--coral)';
  const ringBg = isPositive ? 'rgba(218,255,63,0.06)' : 'rgba(255,107,74,0.06)';
  const ringBorder = isPositive ? 'rgba(218,255,63,0.18)' : 'rgba(255,107,74,0.22)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        background: ringBg,
        border: `1px solid ${ringBorder}`,
      }}
    >
      <Avatar initials={initials} color={color} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
          <span
            className="mono"
            style={{ fontSize: 9, color: 'var(--text-on-dark-faint)', letterSpacing: '0.1em' }}
          >
            {item.kind === 'achievement' ? 'BADGE' : item.kind === 'kudos' ? 'STREAK' : 'NUDGE'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-on-dark)', marginTop: 2, lineHeight: 1.4 }}>
          {item.title}
        </div>
        <div
          style={{
            ...(monoSmall),
            color: accent,
            marginTop: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icon name={item.icon} size={10} color={accent} strokeWidth={2} />
          {item.cta.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

const monoSmall: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 10,
  letterSpacing: '0.1em',
};

/* ── Empty / loading states ──────────────────────────────────────────── */

function FullPageNote({ title, body }: { title: string; body?: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--ink)',
        color: 'var(--text-on-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {title}
        </h1>
        {body && (
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', marginTop: 8, lineHeight: 1.5 }}>
            {body}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Invite button + modal ───────────────────────────────────────────── */

function InviteButton({ groupName, inviteCode }: { groupName: string; inviteCode: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-lime"
        style={{
          padding: '8px 12px',
          fontSize: 12,
          fontFamily: 'var(--f-ui)',
          fontWeight: 600,
        }}
      >
        <Icon name="plus" size={13} color="#0a0a0a" strokeWidth={2.5} />
        Invite
      </button>
      {open && <InviteModal groupName={groupName} inviteCode={inviteCode} onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteModal({
  groupName,
  inviteCode,
  onClose,
}: {
  groupName: string;
  inviteCode: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/onboarding/join?code=${inviteCode}`
      : `/onboarding/join?code=${inviteCode}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async (text: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      // Clipboard API unavailable (insecure context, etc) — silently no-op.
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--ink-card)',
          color: 'var(--text-on-dark)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 22,
          padding: '24px 22px',
          width: '100%',
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <Eyebrow>INVITE TO {groupName.toUpperCase()}</Eyebrow>
            <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              Add someone to your pact
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-on-dark-mute)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 8,
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
          Share the link or just the code. Pacts max out at 6 — close circles only.
        </p>

        <div
          style={{
            background: 'rgba(218,255,63,0.08)',
            border: '1px solid rgba(218,255,63,0.2)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
            CODE
          </div>
          <div
            style={{
              ...display,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: 'var(--lime)',
              wordBreak: 'break-all',
            }}
          >
            {inviteCode}
          </div>
          <button
            type="button"
            onClick={() => copy(inviteCode, 'code')}
            className="btn btn-ghost-dark"
            style={{ padding: '10px 14px', fontSize: 13, alignSelf: 'flex-start' }}
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
            <Icon
              name={copied === 'code' ? 'check' : 'upload'}
              size={13}
              color="currentColor"
              strokeWidth={2}
            />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
            INVITE LINK
          </div>
          <div
            style={{
              ...mono,
              fontSize: 12,
              color: 'var(--text-on-dark-mute)',
              padding: '10px 12px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              wordBreak: 'break-all',
            }}
          >
            {inviteUrl}
          </div>
          <button
            type="button"
            onClick={() => copy(inviteUrl, 'link')}
            className="btn btn-lime"
            style={{ padding: '12px 16px', fontSize: 13, alignSelf: 'flex-start' }}
          >
            {copied === 'link' ? 'Copied!' : 'Copy link'}
            <Icon
              name={copied === 'link' ? 'check' : 'upload'}
              size={13}
              color="#0a0a0a"
              strokeWidth={2.5}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};

/* ── No group prompt ─────────────────────────────────────────────────── */

function NoGroupPrompt() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--ink)',
        color: 'var(--text-on-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Eyebrow>NO PACT YET</Eyebrow>
          <h1 className="display" style={{ fontSize: 28, fontWeight: 800, marginTop: 8, marginBottom: 6 }}>
            You&rsquo;re not in a pact yet.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Make one with your people, or join one with an invite code.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Link href="/onboarding" className="btn btn-lime" style={{ padding: '12px 18px', fontSize: 13 }}>
            Make a pact
            <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
          </Link>
          <Link href="/onboarding/join" className="btn btn-ghost-dark" style={{ padding: '12px 18px', fontSize: 13 }}>
            I have an invite code
          </Link>
        </div>
      </div>
    </div>
  );
}

