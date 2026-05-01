'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand, Card, Chip, Eyebrow, Icon, StatNumeral } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { dayStartMs, formatTime, thisWeekMondayMs } from '@/lib/meals';
import {
  lastNWeekWorkoutTotals,
  loadRecentUserWorkoutsDetailed,
  weekDayWorkoutTotals,
  workoutVolume,
  type DayWorkoutTotals,
  type WeekWorkoutTotals,
  type WorkoutDetail,
} from '@/lib/workouts';

const LOOKBACK_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

export function WorkoutsDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutDetail[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/workouts')}`);
      return;
    }
    if (!profile?.currentGroupId) return;
    let cancelled = false;
    const sinceMs = Date.now() - LOOKBACK_WEEKS * 7 * DAY_MS;
    loadRecentUserWorkoutsDetailed(profile.currentGroupId, user.uid, sinceMs)
      .then((w) => { if (!cancelled) setWorkouts(w); })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : 'Could not load training data');
      });
    return () => { cancelled = true; };
  }, [authLoading, user, profile, router]);

  const today = useMemo(() => {
    if (!workouts) return null;
    const start = dayStartMs(Date.now());
    const end = start + DAY_MS;
    const day = workouts.filter((w) => w.loggedAt >= start && w.loggedAt < end);
    return {
      start,
      workouts: day,
      sets: day.reduce((a, w) => a + w.totalSets, 0),
      volume: day.reduce((a, w) => a + workoutVolume(w), 0),
      durationMin: day.reduce((a, w) => a + (w.durationMin ?? 0), 0),
    };
  }, [workouts]);

  const yesterday = useMemo(() => {
    if (!workouts) return null;
    const start = dayStartMs(Date.now()) - DAY_MS;
    const end = start + DAY_MS;
    const day = workouts.filter((w) => w.loggedAt >= start && w.loggedAt < end);
    return {
      start,
      volume: day.reduce((a, w) => a + workoutVolume(w), 0),
      sets: day.reduce((a, w) => a + w.totalSets, 0),
    };
  }, [workouts]);

  const week = useMemo(() => {
    if (!workouts) return null;
    return weekDayWorkoutTotals(workouts, thisWeekMondayMs());
  }, [workouts]);

  const weekTotals = useMemo(() => {
    if (!week) return null;
    return {
      sets: week.reduce((a, d) => a + d.sets, 0),
      volume: week.reduce((a, d) => a + d.volume, 0),
      durationMin: week.reduce((a, d) => a + d.durationMin, 0),
      daysTrained: week.filter((d) => d.workouts.length > 0).length,
    };
  }, [week]);

  const trend = useMemo(
    () => (workouts ? lastNWeekWorkoutTotals(workouts, LOOKBACK_WEEKS, thisWeekMondayMs()) : null),
    [workouts],
  );

  const streak = useMemo(() => (workouts ? trainingStreak(workouts) : 0), [workouts]);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text-on-dark)', padding: '32px 24px 64px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <div style={{ display: 'flex', gap: 14 }}>
            <Link href="/workout" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
              LOG WORKOUT
            </Link>
            <Link href="/dashboard" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
              ← DASHBOARD
            </Link>
          </div>
        </header>

        <div>
          <Eyebrow>TRAINING</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            Workouts &amp; lbs lifted
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Day, week, and trend views of your training volume and history.
          </p>
        </div>

        {!profile?.currentGroupId && !authLoading && (
          <Card>
            <p style={{ fontSize: 13, margin: 0 }}>
              You&rsquo;re not in a pact yet. <Link href="/onboarding" style={{ color: 'var(--lime)' }}>Make one</Link> to start logging.
            </p>
          </Card>
        )}

        {err && (
          <Card style={{ borderColor: 'rgba(255,107,74,0.3)', background: 'rgba(255,107,74,0.08)' }}>
            <Eyebrow color="var(--coral)">ERROR</Eyebrow>
            <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{err}</p>
          </Card>
        )}

        {profile?.currentGroupId && !workouts && !err && (
          <Card>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--text-on-dark-mute)' }}>Loading…</p>
          </Card>
        )}

        {workouts && workouts.length === 0 && (
          <Card style={{ padding: '28px 22px' }}>
            <Eyebrow>EMPTY</Eyebrow>
            <p style={{ fontSize: 14, marginTop: 8, marginBottom: 14, lineHeight: 1.5 }}>
              No workouts logged in the last {LOOKBACK_WEEKS} weeks. Log one to start the trend.
            </p>
            <Link href="/workout" className="btn btn-lime" style={{ padding: '12px 18px', fontSize: 14, display: 'inline-flex' }}>
              Log a workout
              <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
            </Link>
          </Card>
        )}

        {workouts && workouts.length > 0 && today && yesterday && week && weekTotals && trend && (
          <>
            <TodaySection today={today} yesterday={yesterday} streak={streak} />
            <WeekSection week={week} totals={weekTotals} />
            <TrendSection weeks={trend} />
            <AllWorkoutsSection workouts={workouts} />
          </>
        )}
      </div>
    </main>
  );
}

/* ── Today ───────────────────────────────────────────────────────────── */

function TodaySection({
  today,
  yesterday,
  streak,
}: {
  today: { workouts: WorkoutDetail[]; sets: number; volume: number; durationMin: number };
  yesterday: { volume: number; sets: number };
  streak: number;
}) {
  const volDelta = Math.round(today.volume - yesterday.volume);
  const burnLow = today.workouts.reduce((a, w) => a + (w.caloriesBurnedLow ?? 0), 0);
  const burnHigh = today.workouts.reduce((a, w) => a + (w.caloriesBurnedHigh ?? 0), 0);
  const hasBurn = burnHigh > 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Eyebrow>TODAY</Eyebrow>
          <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {today.workouts.length === 0
              ? 'No training yet'
              : `${today.workouts.length} workout${today.workouts.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <Chip color={streak > 0 ? 'lime' : 'ghost'}>
          {streak > 0 ? `${streak}-DAY STREAK` : 'NO STREAK'}
        </Chip>
      </div>

      <Card style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <StatNumeral value={Math.round(today.volume)} unit="LBS LIFTED" size={56} />
          <DeltaPill label="vs yesterday" valueLbs={volDelta} />
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Tile label="WORKOUTS" value={String(today.workouts.length)} />
          <Tile label="SETS" value={String(today.sets)} />
          <Tile label="DURATION" value={today.durationMin > 0 ? `${today.durationMin}m` : '—'} />
        </div>

        {hasBurn && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
              EST. BURN TODAY
            </span>
            <span style={{ ...mono, fontSize: 13, color: 'var(--text-on-dark)' }}>
              {Math.round(burnLow).toLocaleString()}–{Math.round(burnHigh).toLocaleString()} KCAL
            </span>
            <span
              style={{
                ...mono,
                fontSize: 9,
                color: 'var(--text-on-dark-faint)',
                letterSpacing: '0.1em',
                flexBasis: '100%',
              }}
            >
              RANGE — INDIVIDUAL BURN VARIES ±30%
            </span>
          </div>
        )}

        {today.workouts.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {today.workouts.map((w) => <WorkoutMiniRow key={w.id} workout={w} />)}
          </div>
        )}
      </Card>
    </section>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div style={{ ...display, fontSize: 24, fontWeight: 700, marginTop: 4, color: accent ?? 'var(--text-on-dark)' }}>
        {value}
      </div>
    </div>
  );
}

function DeltaPill({ label, valueLbs }: { label: string; valueLbs: number }) {
  if (valueLbs === 0) return <Chip color="ghost">SAME · {label.toUpperCase()}</Chip>;
  const sign = valueLbs > 0 ? '+' : '−';
  return (
    <Chip color="ghost">
      {sign}{Math.abs(valueLbs).toLocaleString()} LBS · {label.toUpperCase()}
    </Chip>
  );
}

/* ── Week ────────────────────────────────────────────────────────────── */

function WeekSection({
  week,
  totals,
}: {
  week: DayWorkoutTotals[];
  totals: { sets: number; volume: number; durationMin: number; daysTrained: number };
}) {
  const todayStart = dayStartMs(Date.now());
  const maxVol = Math.max(1, ...week.map((d) => d.volume));

  const initialSelected = useMemo(() => {
    const today = week.find((d) => d.dayStartMs === todayStart);
    if (today && today.workouts.length > 0) return today.dayStartMs;
    const recent = [...week].reverse().find((d) => d.dayStartMs <= todayStart && d.workouts.length > 0);
    return recent?.dayStartMs ?? null;
  }, [week, todayStart]);
  const [selectedDayMs, setSelectedDayMs] = useState<number | null>(initialSelected);
  const selectedDay = useMemo(
    () => week.find((d) => d.dayStartMs === selectedDayMs) ?? null,
    [week, selectedDayMs],
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Eyebrow>THIS WEEK · MON → SUN</Eyebrow>
          <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>Daily volume</div>
        </div>
        <Chip color="ghost">{totals.daysTrained}/7 TRAINED</Chip>
      </div>

      <Card>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 8,
            alignItems: 'end',
            minHeight: 160,
          }}
        >
          {week.map((day) => {
            const isToday = day.dayStartMs === todayStart;
            const isFuture = day.dayStartMs > todayStart;
            const hasData = day.volume > 0;
            const isSelected = day.dayStartMs === selectedDayMs;
            const heightPct = hasData ? Math.max(8, (day.volume / maxVol) * 100) : 4;
            const interactive = !isFuture;
            return (
              <button
                key={day.dayStartMs}
                type="button"
                disabled={!interactive}
                onClick={() => interactive && setSelectedDayMs(day.dayStartMs)}
                aria-pressed={isSelected}
                aria-label={`${day.weekday} — ${hasData ? `${Math.round(day.volume)} lbs` : 'no workouts'}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 6,
                  height: 168,
                  padding: '4px 2px',
                  border: isSelected ? '1px solid rgba(218,255,63,0.5)' : '1px solid transparent',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(218,255,63,0.05)' : 'transparent',
                  cursor: interactive ? 'pointer' : 'default',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)' }}>
                  {hasData ? Math.round(day.volume).toLocaleString() : '—'}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    background: isToday
                      ? 'var(--lime)'
                      : hasData
                        ? 'rgba(197, 140, 255, 0.6)'
                        : 'rgba(255,255,255,0.06)',
                    borderRadius: 6,
                    opacity: isFuture ? 0.3 : 1,
                  }}
                />
                <div
                  style={{
                    ...mono,
                    fontSize: 11,
                    color: isToday ? 'var(--lime)' : 'var(--text-on-dark-mute)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {day.weekday}
                </div>
              </button>
            );
          })}
        </div>

        {selectedDay && <SelectedDayWorkouts day={selectedDay} />}

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
          }}
        >
          <SmallStat label="WEEK · LBS" value={Math.round(totals.volume).toLocaleString()} />
          <SmallStat label="WEEK · SETS" value={String(totals.sets)} />
          <SmallStat
            label="AVG · LBS/DAY"
            value={totals.daysTrained > 0 ? Math.round(totals.volume / totals.daysTrained).toLocaleString() : '—'}
            sub={totals.daysTrained > 0 ? `over ${totals.daysTrained} day${totals.daysTrained === 1 ? '' : 's'}` : undefined}
          />
          <SmallStat
            label="WEEK · TIME"
            value={totals.durationMin > 0 ? `${totals.durationMin}m` : '—'}
          />
        </div>
      </Card>
    </section>
  );
}

function SelectedDayWorkouts({ day }: { day: DayWorkoutTotals }) {
  const todayStart = dayStartMs(Date.now());
  const dayMs = 24 * 60 * 60 * 1000;
  const label =
    day.dayStartMs === todayStart
      ? 'Today'
      : day.dayStartMs === todayStart - dayMs
        ? 'Yesterday'
        : new Date(day.dayStartMs).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          });

  if (day.workouts.length === 0) {
    return (
      <div
        style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
          {label.toUpperCase()}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: '6px 0 0', lineHeight: 1.5 }}>
          No training this day. <Link href="/workout" style={{ color: 'var(--lime)' }}>Log a workout</Link>.
        </p>
      </div>
    );
  }

  const ws = [...day.workouts].sort((a, b) => a.loggedAt - b.loggedAt);

  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px' }}>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
          {label.toUpperCase()} · {ws.length} WORKOUT{ws.length === 1 ? '' : 'S'}
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)' }}>
          {Math.round(day.volume).toLocaleString()} LBS · {day.sets} SETS
        </div>
      </div>

      {ws.map((w) => <WorkoutMiniRow key={w.id} workout={w} />)}
    </div>
  );
}

function WorkoutMiniRow({ workout }: { workout: WorkoutDetail }) {
  const vol = Math.round(workoutVolume(workout));
  return (
    <Link
      href={`/workouts/${workout.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        textDecoration: 'none',
        color: 'var(--text-on-dark)',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(218,255,63,0.1)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={iconForTag(workout.tag)} size={16} color="var(--lime)" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {workout.title}
          </span>
          <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)', flexShrink: 0 }}>
            {formatTime(workout.loggedAt)}
          </span>
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', marginTop: 2 }}>
          {vol.toLocaleString()} LBS · {workout.totalSets} SETS · {workout.tag.toUpperCase()}
          {workout.durationMin != null && ` · ${workout.durationMin}M`}
        </div>
      </div>
      <Icon name="chevron" size={12} color="var(--text-on-dark-faint)" />
    </Link>
  );
}

function SmallStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {sub && (
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── Trend ───────────────────────────────────────────────────────────── */

function TrendSection({ weeks }: { weeks: WeekWorkoutTotals[] }) {
  const populated = weeks.filter((w) => w.workouts.length > 0);
  if (populated.length === 0) return null;
  const maxVol = Math.max(1, ...populated.map((w) => w.volume));

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow>TREND · LAST {LOOKBACK_WEEKS} WEEKS</Eyebrow>
        <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>Weekly volume</div>
      </div>

      <Card padded={false}>
        {weeks.map((w, i) => {
          const isCurrent = i === 0;
          const widthPct = (w.volume / maxVol) * 100;
          return (
            <div
              key={w.weekStartMs}
              style={{
                padding: '14px 18px',
                borderBottom: i < weeks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {isCurrent ? 'This week' : weekRangeLabel(w.weekStartMs)}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', marginTop: 2 }}>
                    {w.daysTrained > 0
                      ? `${w.daysTrained} DAY${w.daysTrained === 1 ? '' : 'S'} · ${w.sets} SETS`
                      : 'NO TRAINING'}
                  </div>
                </div>
                <div style={{ ...mono, fontSize: 13, color: 'var(--text-on-dark)', fontWeight: 600 }}>
                  {Math.round(w.volume).toLocaleString()}{' '}
                  <span style={{ color: 'var(--text-on-dark-mute)', fontWeight: 400 }}>lbs</span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.04)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: '100%',
                    background: isCurrent ? 'var(--lime)' : 'rgba(197, 140, 255, 0.6)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

function weekRangeLabel(weekStartMs: number): string {
  const start = new Date(weekStartMs);
  const end = new Date(weekStartMs + 6 * DAY_MS);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ── All workouts list ───────────────────────────────────────────────── */

function AllWorkoutsSection({ workouts }: { workouts: WorkoutDetail[] }) {
  const days = useMemo(() => groupByDay(workouts), [workouts]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow>ALL WORKOUTS · LAST {LOOKBACK_WEEKS} WEEKS</Eyebrow>
        <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>Training log</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {days.map(({ dayKey, dayStartMs, workouts: dw }) => {
          const dayVol = Math.round(dw.reduce((a, w) => a + workoutVolume(w), 0));
          const daySets = dw.reduce((a, w) => a + w.totalSets, 0);
          return (
            <div key={dayKey} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
                <div style={{ ...display, fontSize: 16, fontWeight: 700 }}>{formatDayLabel(dayStartMs)}</div>
                <div style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
                  {dw.length} WORKOUT{dw.length === 1 ? '' : 'S'} · {dayVol.toLocaleString()} LBS · {daySets} SETS
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dw.map((w) => <WorkoutMiniRow key={w.id} workout={w} />)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function groupByDay(workouts: WorkoutDetail[]): Array<{ dayKey: string; dayStartMs: number; workouts: WorkoutDetail[] }> {
  const buckets = new Map<string, WorkoutDetail[]>();
  for (const w of workouts) {
    const d = new Date(w.loggedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const arr = buckets.get(key);
    if (arr) arr.push(w);
    else buckets.set(key, [w]);
  }
  return Array.from(buckets.entries())
    .map(([dayKey, dw]) => {
      const first = new Date(dw[0]!.loggedAt);
      const ds = new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime();
      return { dayKey, dayStartMs: ds, workouts: dw };
    })
    .sort((a, b) => b.dayStartMs - a.dayStartMs);
}

function formatDayLabel(ds: number, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ds === today) return 'Today';
  if (ds === today - DAY_MS) return 'Yesterday';
  return new Date(ds).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function iconForTag(tag: string): 'dumbbell' | 'run' | 'leaf' | 'heart' {
  if (tag === 'cardio') return 'run';
  if (tag === 'rest') return 'leaf';
  if (tag === 'crew') return 'heart';
  return 'dumbbell';
}

function trainingStreak(workouts: WorkoutDetail[], now: Date = new Date()): number {
  if (workouts.length === 0) return 0;
  const days = new Set(workouts.map((w) => dayStartMs(w.loggedAt)));
  const today = dayStartMs(now.getTime());
  if (!days.has(today)) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = today - i * DAY_MS;
    if (days.has(day)) streak += 1;
    else break;
  }
  return streak;
}

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};
