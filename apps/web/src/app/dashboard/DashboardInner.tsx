'use client';

import { useEffect, useMemo, useState } from 'react';
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
  type InventoryRecord,
  type MealRecord,
  type WeightRecord,
  type WorkoutRecord,
} from '@/lib/group-data';
import { weeklyAveragesByMember } from '@/lib/weight';
import styles from './dashboard.module.css';
import type { GroupMemberDoc } from '@/lib/groups';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DashboardInner() {
  const router = useRouter();
  const { user, profile, loading: authLoading, configured } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/dashboard')}`);
      return;
    }
    if (!profile?.currentGroupId) return;
    let cancelled = false;
    loadDashboardData(profile.currentGroupId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        setLoadErr(err instanceof Error ? err.message : 'Could not load your pact');
      });
    return () => { cancelled = true; };
  }, [authLoading, user, profile, router]);

  if (!configured) return <FullPageNote title="Firebase not configured" body="Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local and restart pnpm dev." />;
  if (authLoading || !user) return <FullPageNote title="Loading…" />;
  if (!profile?.currentGroupId) return <NoGroupPrompt />;
  if (loadErr) return <FullPageNote title="Couldn't load your pact" body={loadErr} />;
  if (!data) return <FullPageNote title="Loading your pact…" />;

  return <Dashboard data={data} />;
}

/* ── Main dashboard ──────────────────────────────────────────────────── */

function Dashboard({ data }: { data: DashboardData }) {
  const { group, members, meals, inventory, workouts, weightLogs } = data;
  const week = formatWeekRange(group.currentWeek);
  const dayNums = weekDayNumbers(group.currentWeek);
  const todayIdx = todayIndexInWeek(group.currentWeek);
  const stackMembers = members.map((m) => ({ initials: m.initials, color: m.color }));

  const todayMeals = useMemo(() => mealsLoggedToday(meals), [meals]);
  const todayTotals = useMemo(() => sumMacros(todayMeals), [todayMeals]);
  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m])),
    [members],
  );

  return (
    <div className={styles.shell}>
      <TopBar week={week} stackMembers={stackMembers} />
      <div className={styles.body}>
        <HeroStrip
          group={group}
          members={members}
          weekMealCount={meals.length}
          todayMealCount={todayMeals.length}
          todayCalories={todayTotals.calories}
          todayProteinG={todayTotals.proteinG}
        />
        <QuickLog />
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
          memberById={memberById}
          inventory={inventory}
          weightLogs={weightLogs}
        />
      </div>
    </div>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────── */

function TopBar({
  week,
  stackMembers,
}: {
  week: { label: string; range: string };
  stackMembers: Array<{ initials: string; color: string }>;
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
        <HomeAuthBar />
      </div>
    </div>
  );
}

/* ── Quick log row ───────────────────────────────────────────────────── */

function QuickLog() {
  const items: Array<{ href: string; icon: 'bowl' | 'dumbbell' | 'cart' | 'weight'; label: string; sub: string }> = [
    { href: '/log/meal',      icon: 'bowl',     label: 'Log a meal',     sub: 'Snap a photo · macros parsed' },
    { href: '/workout',       icon: 'dumbbell', label: 'Log a workout',  sub: 'Sets, reps, weight'           },
    { href: '/log/groceries', icon: 'cart',     label: 'Scan groceries', sub: 'Receipt → pantry'             },
    { href: '/log/body',      icon: 'weight',   label: 'Log weight',     sub: 'Trend, optional photo'        },
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
  weekMealCount,
  todayMealCount,
  todayCalories,
  todayProteinG,
}: {
  group: { name: string; memberUids: string[] };
  members: GroupMemberDoc[];
  weekMealCount: number;
  todayMealCount: number;
  todayCalories: number;
  todayProteinG: number;
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

      <Card style={{ padding: '20px 22px' }}>
        <Eyebrow>MEALS · 7 DAYS</Eyebrow>
        <div className="numeral" style={{ fontSize: 60, marginTop: 4 }}>
          {weekMealCount}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8 }}>
          {weekMealCount === 0
            ? 'No meals logged yet — tap Log a meal to start'
            : `${members.length} crew · across the last week`}
        </div>
      </Card>

      <Card style={{ padding: '20px 22px' }}>
        <Eyebrow>TODAY · CALORIES</Eyebrow>
        <div className="numeral" style={{ fontSize: 60, marginTop: 4 }}>
          {Math.round(todayCalories).toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8 }}>
          {todayMealCount === 0
            ? 'Nothing logged today yet'
            : `${todayMealCount} meal${todayMealCount === 1 ? '' : 's'} · ${Math.round(todayProteinG)}g protein`}
        </div>
      </Card>
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
        }}
      >
        <div>
          <Eyebrow>THE WEEK · MON → SUN</Eyebrow>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            Together this week
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip color="ghost"><DotSwatch color="#daff3f" />WORKOUT</Chip>
          <Chip color="ghost"><DotSwatch color="#7cd4ff" />MEAL</Chip>
          <Chip color="ghost"><DotSwatch color="#ff6b4a" />PR</Chip>
          <Chip color="ghost"><DotSwatch color="#c58cff" />PRACTICE</Chip>
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
}: {
  weightLogs: WeightRecord[];
  memberById: Record<string, GroupMemberDoc>;
}) {
  const series = useMemo(() => weeklyAveragesByMember(weightLogs, 8), [weightLogs]);

  if (series.length === 0) {
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

  // Compute chart bounds across all series
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

  // Compute first→last delta for the largest-data series for the chip
  const longest = series.reduce((a, b) => (a.points.length >= b.points.length ? a : b));
  const delta = longest.points[longest.points.length - 1]!.avgLb - longest.points[0]!.avgLb;
  const deltaSign = delta < 0 ? '−' : '+';
  const deltaAbs = Math.abs(delta).toFixed(1);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <Eyebrow>WEIGHT · LAST 8 WEEKS</Eyebrow>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            Trends
          </div>
        </div>
        <Chip color={delta < 0 ? 'lime' : 'ghost'}>
          {deltaSign}
          {deltaAbs} LB
        </Chip>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
        {series.map((s) => {
          const member = memberById[s.memberId];
          const stroke = member?.color ?? '#daff3f';
          const path = s.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.weekStart).toFixed(1)},${yFor(p.avgLb).toFixed(1)}`)
            .join(' ');
          return (
            <g key={s.memberId}>
              <path d={path} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={xFor(p.weekStart)} cy={yFor(p.avgLb)} r={3} fill={stroke} />
              ))}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {series.map((s) => {
          const member = memberById[s.memberId];
          if (!member) return null;
          return (
            <div key={s.memberId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 2, background: member.color }} />
              {member.name}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BottomRow({
  meals,
  memberById,
  inventory,
  weightLogs,
}: {
  meals: MealRecord[];
  memberById: Record<string, GroupMemberDoc>;
  inventory: InventoryRecord[];
  weightLogs: WeightRecord[];
}) {
  return (
    <div className={styles.bottomGrid}>
      <WeightTrendCard weightLogs={weightLogs} memberById={memberById} />

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
            {inventory.length === 0
              ? 'EMPTY'
              : inventory.length >= 20
                ? '20+ ITEMS'
                : `${inventory.length} ITEM${inventory.length === 1 ? '' : 'S'}`}
          </Chip>
        </div>
        {inventory.length === 0 ? (
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
            <Eyebrow>CREW · LIVE</Eyebrow>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              Recent
            </div>
          </div>
          <Icon name="chat" size={18} color="rgba(245,243,238,0.5)" />
        </div>
        {meals.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', padding: '16px 0' }}>
            No activity in the last 7 days. Log a meal to see it here.
          </div>
        ) : (
          meals.slice(0, 5).map((meal, i, arr) => {
            const member = memberById[meal.memberId];
            const name = member?.name ?? 'Member';
            const initials = member?.initials ?? '?';
            const color = member?.color ?? 'var(--lime)';
            const summary = mealSummary(meal);
            return (
              <div
                key={meal.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <Avatar initials={initials} color={color} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--text-on-dark-faint)' }}
                    >
                      {shortRelativeTime(meal.loggedAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-on-dark-mute)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {summary}
                  </div>
                </div>
                <Chip color="ghost">MEAL</Chip>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function formatQuantity(q: number): string {
  if (q === Math.floor(q)) return q.toString();
  return q.toFixed(2).replace(/\.?0+$/, '');
}

function mealSummary(meal: MealRecord): string {
  const cal = Math.round(meal.totals.calories);
  const protein = Math.round(meal.totals.proteinG);
  const lead =
    meal.items.length > 0
      ? meal.items
          .slice(0, 2)
          .map((it) => it.name)
          .join(', ') + (meal.items.length > 2 ? '…' : '')
      : 'Logged meal';
  return `${lead} · ${cal} cal · ${protein}g protein`;
}

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

