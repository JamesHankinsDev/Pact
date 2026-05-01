'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand, Card, Chip, Eyebrow, Icon, StatNumeral } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import {
  dayStartMs,
  formatTime,
  lastNWeekTotals,
  loadRecentUserMeals,
  macroEnergyMix,
  mealLeadText,
  sumMealMacros,
  thisWeekMondayMs,
  weekDayTotals,
  type DayTotals,
  type MealDetailRecord,
  type WeekTotals,
} from '@/lib/meals';
import {
  loadBodyProfile,
  loadNutritionGoals,
  type BodyProfile,
  type NutritionGoals,
} from '@/lib/nutrition-goals';
import { loadRecentUserWorkouts, type WorkoutRecord } from '@/lib/workouts';
import type { Macros } from '@pact/types';

const LOOKBACK_WEEKS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

export function MealsDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [meals, setMeals] = useState<MealDetailRecord[] | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [body, setBody] = useState<BodyProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/meals')}`);
      return;
    }
    if (!profile?.currentGroupId) return;
    let cancelled = false;
    const groupId = profile.currentGroupId;
    const sinceMs = Date.now() - LOOKBACK_WEEKS * 7 * DAY_MS;
    Promise.all([
      loadRecentUserMeals(groupId, user.uid, sinceMs),
      loadRecentUserWorkouts(groupId, user.uid, sinceMs),
      loadNutritionGoals(user.uid),
      loadBodyProfile(user.uid),
    ])
      .then(([m, w, g, b]) => {
        if (cancelled) return;
        setMeals(m);
        setWorkouts(w);
        setGoals(g);
        setBody(b);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : 'Could not load nutrition data');
      });
    return () => { cancelled = true; };
  }, [authLoading, user, profile, router]);

  const today = useMemo(() => {
    if (!meals) return null;
    const start = dayStartMs(Date.now());
    const end = start + DAY_MS;
    const dayMeals = meals.filter((m) => m.loggedAt >= start && m.loggedAt < end);
    return { start, meals: dayMeals, totals: sumMealMacros(dayMeals) };
  }, [meals]);

  const yesterday = useMemo(() => {
    if (!meals) return null;
    const start = dayStartMs(Date.now()) - DAY_MS;
    const end = start + DAY_MS;
    const dayMeals = meals.filter((m) => m.loggedAt >= start && m.loggedAt < end);
    return { start, totals: sumMealMacros(dayMeals) };
  }, [meals]);

  const week = useMemo(() => {
    if (!meals) return null;
    const monday = thisWeekMondayMs();
    return weekDayTotals(meals, monday);
  }, [meals]);

  const weekTotals = useMemo(
    () => (week ? sumMealMacros(week.flatMap((d) => d.meals)) : null),
    [week],
  );

  const trend = useMemo(
    () => (meals ? lastNWeekTotals(meals, LOOKBACK_WEEKS) : null),
    [meals],
  );

  const streak = useMemo(() => (meals ? loggingStreak(meals) : 0), [meals]);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text-on-dark)', padding: '32px 24px 64px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <div style={{ display: 'flex', gap: 14 }}>
            <Link href="/log/meal" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
              LOG MEAL
            </Link>
            <Link href="/workouts" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
              TRAINING
            </Link>
            <Link href="/dashboard" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
              ← DASHBOARD
            </Link>
          </div>
        </header>

        <div>
          <Eyebrow>MEALS &amp; CALORIES</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            Your meals &amp; macros
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Day, week, and trend views of your dietary intake — plus the full log of every meal.
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

        {profile?.currentGroupId && !meals && !err && (
          <Card>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--text-on-dark-mute)' }}>Loading…</p>
          </Card>
        )}

        {meals && meals.length === 0 && (
          <Card style={{ padding: '28px 22px' }}>
            <Eyebrow>EMPTY</Eyebrow>
            <p style={{ fontSize: 14, marginTop: 8, marginBottom: 14, lineHeight: 1.5 }}>
              No meals logged in the last {LOOKBACK_WEEKS} weeks. Log a meal to start the trend.
            </p>
            <Link href="/log/meal" className="btn btn-lime" style={{ padding: '12px 18px', fontSize: 14, display: 'inline-flex' }}>
              Log a meal
              <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
            </Link>
          </Card>
        )}

        {meals && meals.length > 0 && today && yesterday && week && weekTotals && trend && (
          <>
            <TodaySection today={today} yesterday={yesterday} streak={streak} />
            <EnergyBalanceCard today={today} week={week} goals={goals} body={body} />
            <WeekSection week={week} totals={weekTotals} workouts={workouts} goals={goals} />
            <TrendSection weeks={trend} />
            <AllMealsSection meals={meals} />
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
  today: { start: number; meals: MealDetailRecord[]; totals: Macros };
  yesterday: { start: number; totals: Macros };
  streak: number;
}) {
  const calDelta = Math.round(today.totals.calories - yesterday.totals.calories);
  const protDelta = Math.round(today.totals.proteinG - yesterday.totals.proteinG);
  const mix = macroEnergyMix(today.totals);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Eyebrow>TODAY</Eyebrow>
          <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {today.meals.length === 0 ? 'Nothing logged yet' : `${today.meals.length} meal${today.meals.length === 1 ? '' : 's'} so far`}
          </div>
        </div>
        <Chip color={streak > 0 ? 'lime' : 'ghost'}>
          {streak > 0 ? `${streak}-DAY STREAK` : 'NO STREAK'}
        </Chip>
      </div>

      <Card style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <StatNumeral value={Math.round(today.totals.calories)} unit="KCAL" size={56} />
          <DeltaPill label="vs yesterday" valueKcal={calDelta} />
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <MacroTile label="PROTEIN" g={today.totals.proteinG} pct={mix.proteinPct} accent="var(--lime)" />
          <MacroTile label="CARBS"   g={today.totals.carbsG}   pct={mix.carbsPct}   accent="#7cd4ff" />
          <MacroTile label="FAT"     g={today.totals.fatG}     pct={mix.fatPct}     accent="#ff6b4a" />
        </div>

        {today.totals.calories > 0 && (
          <>
            <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', marginTop: 18, marginBottom: 8, letterSpacing: '0.1em' }}>
              ENERGY MIX
            </div>
            <MacroBar mix={mix} />
          </>
        )}

        {protDelta !== 0 && today.meals.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 14 }}>
            {protDelta > 0 ? `+${protDelta}g protein vs yesterday` : `${protDelta}g protein vs yesterday`}
          </div>
        )}
      </Card>
    </section>
  );
}

function MacroTile({
  label,
  g,
  pct,
  accent,
}: {
  label: string;
  g: number;
  pct: number;
  accent: string;
}) {
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ ...display, fontSize: 24, fontWeight: 700, color: accent }}>
          {Math.round(g)}
        </span>
        <span style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>g</span>
      </div>
      <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)', marginTop: 2 }}>
        {Math.round(pct)}% OF KCAL
      </div>
    </div>
  );
}

function MacroBar({ mix }: { mix: { proteinPct: number; carbsPct: number; fatPct: number } }) {
  const segments: Array<{ pct: number; color: string }> = [
    { pct: mix.proteinPct, color: 'var(--lime)' },
    { pct: mix.carbsPct, color: '#7cd4ff' },
    { pct: mix.fatPct, color: '#ff6b4a' },
  ];
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
      {segments.map((s, i) => (
        <div key={i} style={{ width: `${s.pct}%`, background: s.color }} />
      ))}
    </div>
  );
}

function DeltaPill({ label, valueKcal }: { label: string; valueKcal: number }) {
  if (valueKcal === 0) {
    return <Chip color="ghost">SAME · {label.toUpperCase()}</Chip>;
  }
  const sign = valueKcal > 0 ? '+' : '−';
  return (
    <Chip color="ghost">
      {sign}{Math.abs(valueKcal).toLocaleString()} KCAL · {label.toUpperCase()}
    </Chip>
  );
}

/* ── This week ───────────────────────────────────────────────────────── */

type DailyAchievements = {
  exercised: boolean;
  hitProtein: boolean;
  inCalorieZone: boolean;
};

function computeAchievements(
  day: DayTotals,
  workouts: WorkoutRecord[],
  goals: NutritionGoals | null,
): DailyAchievements {
  const dayEnd = day.dayStartMs + DAY_MS;
  const exercised = workouts.some((w) => w.loggedAt >= day.dayStartMs && w.loggedAt < dayEnd);
  const hitProtein = !!goals && day.totals.proteinG >= goals.proteinG.target;
  // Calorie zone: at or above the band's min and at or below the band's max.
  // We only count it if the user actually logged something — an empty day
  // shouldn't read as "stayed under goal".
  const cals = day.totals.calories;
  const inCalorieZone =
    !!goals &&
    cals > 0 &&
    cals >= goals.caloriesDaily.min &&
    cals <= goals.caloriesDaily.max;
  return { exercised, hitProtein, inCalorieZone };
}

function WeekSection({
  week,
  totals,
  workouts,
  goals,
}: {
  week: DayTotals[];
  totals: Macros;
  workouts: WorkoutRecord[];
  goals: NutritionGoals | null;
}) {
  const todayStart = dayStartMs(Date.now());
  const maxCal = Math.max(1, ...week.map((d) => d.totals.calories));
  const daysLogged = week.filter((d) => d.meals.length > 0).length;
  const avgCals = daysLogged > 0 ? Math.round(totals.calories / daysLogged) : 0;
  const avgProt = daysLogged > 0 ? Math.round(totals.proteinG / daysLogged) : 0;

  const weekAchievements = week.map((d) => computeAchievements(d, workouts, goals));
  const exerciseCount = weekAchievements.filter((a) => a.exercised).length;
  const proteinCount = weekAchievements.filter((a) => a.hitProtein).length;
  const calorieCount = weekAchievements.filter((a) => a.inCalorieZone).length;

  // Default: today if it has meals, else the most recent day with meals.
  const initialSelected = useMemo(() => {
    const today = week.find((d) => d.dayStartMs === todayStart);
    if (today && today.meals.length > 0) return today.dayStartMs;
    const recent = [...week].reverse().find((d) => d.dayStartMs <= todayStart && d.meals.length > 0);
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
          <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            Daily breakdown
          </div>
        </div>
        <Chip color="ghost">{daysLogged}/7 LOGGED</Chip>
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
          {week.map((day, i) => {
            const isToday = day.dayStartMs === todayStart;
            const isFuture = day.dayStartMs > todayStart;
            const hasData = day.totals.calories > 0;
            const isSelected = day.dayStartMs === selectedDayMs;
            const heightPct = hasData ? Math.max(8, (day.totals.calories / maxCal) * 100) : 4;
            const ach = weekAchievements[i]!;
            const interactive = !isFuture;
            return (
              <button
                key={day.dayStartMs}
                type="button"
                disabled={!interactive}
                onClick={() => interactive && setSelectedDayMs(day.dayStartMs)}
                aria-pressed={isSelected}
                aria-label={`${day.weekday} — ${hasData ? `${Math.round(day.totals.calories)} kcal` : 'no meals'}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 6,
                  height: 168,
                  padding: '4px 2px',
                  border: isSelected
                    ? '1px solid rgba(218,255,63,0.5)'
                    : '1px solid transparent',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(218,255,63,0.05)' : 'transparent',
                  cursor: interactive ? 'pointer' : 'default',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)' }}>
                  {hasData ? Math.round(day.totals.calories).toLocaleString() : '—'}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    background: isToday
                      ? 'var(--lime)'
                      : hasData
                        ? 'rgba(124, 212, 255, 0.6)'
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
                <DayBadges achievements={ach} dimmed={isFuture} hasGoals={!!goals} />
              </button>
            );
          })}
        </div>

        <BadgeLegend
          exerciseCount={exerciseCount}
          proteinCount={proteinCount}
          calorieCount={calorieCount}
          hasGoals={!!goals}
        />

        {selectedDay && <SelectedDayMeals day={selectedDay} />}

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
          <SmallStat label="WEEK · KCAL" value={Math.round(totals.calories).toLocaleString()} />
          <SmallStat label="WEEK · PROTEIN" value={`${Math.round(totals.proteinG)}g`} />
          <SmallStat
            label="AVG · KCAL/DAY"
            value={daysLogged > 0 ? avgCals.toLocaleString() : '—'}
            sub={daysLogged > 0 ? `over ${daysLogged} day${daysLogged === 1 ? '' : 's'}` : undefined}
          />
          <SmallStat
            label="AVG · PROTEIN/DAY"
            value={daysLogged > 0 ? `${avgProt}g` : '—'}
          />
        </div>
      </Card>
    </section>
  );
}

function SelectedDayMeals({ day }: { day: DayTotals }) {
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

  if (day.meals.length === 0) {
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
          Nothing logged this day. <Link href="/log/meal" style={{ color: 'var(--lime)' }}>Log a meal</Link>.
        </p>
      </div>
    );
  }

  // Sort earliest → latest within the day for a sensible "first meal at top" feel.
  const meals = [...day.meals].sort((a, b) => a.loggedAt - b.loggedAt);

  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px' }}>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
          {label.toUpperCase()} · {meals.length} MEAL{meals.length === 1 ? '' : 'S'}
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)' }}>
          {Math.round(day.totals.calories).toLocaleString()} KCAL · {Math.round(day.totals.proteinG)}P
        </div>
      </div>

      {meals.map((meal) => <DayMealRow key={meal.id} meal={meal} />)}
    </div>
  );
}

function DayMealRow({ meal }: { meal: MealDetailRecord }) {
  return (
    <Link
      href={`/meals/${meal.id}`}
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
      <DayMealThumb meal={meal} />
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
            {mealLeadText(meal)}
          </span>
          <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)', flexShrink: 0 }}>
            {formatTime(meal.loggedAt)}
          </span>
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', marginTop: 2 }}>
          {Math.round(meal.totals.calories)} KCAL · {Math.round(meal.totals.proteinG)}P · {Math.round(meal.totals.carbsG)}C · {Math.round(meal.totals.fatG)}F
        </div>
      </div>
      <Icon name="chevron" size={12} color="var(--text-on-dark-faint)" />
    </Link>
  );
}

function DayMealThumb({ meal }: { meal: MealDetailRecord }) {
  const size = 36;
  if (meal.photoUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={meal.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  const icon = meal.source === 'description' ? 'chat' : 'bowl';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: 'rgba(218,255,63,0.1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={16} color="var(--lime)" />
    </div>
  );
}

function DayBadges({
  achievements,
  dimmed,
  hasGoals,
}: {
  achievements: DailyAchievements;
  dimmed: boolean;
  hasGoals: boolean;
}) {
  const items: Array<{ key: string; on: boolean; icon: 'dumbbell' | 'flame' | 'target'; color: string; title: string }> = [
    {
      key: 'exercise',
      on: achievements.exercised,
      icon: 'dumbbell',
      color: '#c58cff',
      title: achievements.exercised ? 'Exercised' : 'No workout logged',
    },
    {
      key: 'protein',
      on: achievements.hitProtein,
      icon: 'flame',
      color: 'var(--lime)',
      title: hasGoals
        ? achievements.hitProtein ? 'Hit protein goal' : 'Protein goal not met'
        : 'Set a protein goal in Settings',
    },
    {
      key: 'calories',
      on: achievements.inCalorieZone,
      icon: 'target',
      color: '#7cd4ff',
      title: hasGoals
        ? achievements.inCalorieZone ? 'Calories in zone' : 'Calories outside zone'
        : 'Set a calorie goal in Settings',
    },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        marginTop: 6,
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {items.map((it) => (
        <Badge key={it.key} on={it.on} icon={it.icon} color={it.color} title={it.title} />
      ))}
    </div>
  );
}

function Badge({
  on,
  icon,
  color,
  title,
}: {
  on: boolean;
  icon: 'dumbbell' | 'flame' | 'target';
  color: string;
  title: string;
}) {
  return (
    <div
      title={title}
      aria-label={title}
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: on ? color : 'rgba(255,255,255,0.04)',
        border: on ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
        transition: 'background 0.15s ease',
      }}
    >
      <Icon name={icon} size={11} color={on ? '#0a0a0a' : 'rgba(255,255,255,0.25)'} strokeWidth={on ? 2.2 : 1.6} />
    </div>
  );
}

function BadgeLegend({
  exerciseCount,
  proteinCount,
  calorieCount,
  hasGoals,
}: {
  exerciseCount: number;
  proteinCount: number;
  calorieCount: number;
  hasGoals: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 16,
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        ...mono,
        fontSize: 10,
        color: 'var(--text-on-dark-mute)',
        letterSpacing: '0.05em',
      }}
    >
      <LegendItem icon="dumbbell" color="#c58cff" label={`EXERCISE · ${exerciseCount}/7`} />
      <LegendItem
        icon="flame"
        color="var(--lime)"
        label={hasGoals ? `PROTEIN GOAL · ${proteinCount}/7` : 'PROTEIN GOAL · SET ONE'}
      />
      <LegendItem
        icon="target"
        color="#7cd4ff"
        label={hasGoals ? `CALORIE ZONE · ${calorieCount}/7` : 'CALORIE ZONE · SET ONE'}
      />
      {!hasGoals && (
        <Link
          href="/settings"
          style={{
            ...mono,
            fontSize: 10,
            color: 'var(--lime)',
            textDecoration: 'none',
            letterSpacing: '0.05em',
            marginLeft: 'auto',
          }}
        >
          SET GOALS →
        </Link>
      )}
    </div>
  );
}

function LegendItem({
  icon,
  color,
  label,
}: {
  icon: 'dumbbell' | 'flame' | 'target';
  color: string;
  label: string;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          background: color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={8} color="#0a0a0a" strokeWidth={2.2} />
      </span>
      {label}
    </span>
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

function TrendSection({ weeks }: { weeks: WeekTotals[] }) {
  const populated = weeks.filter((w) => w.meals.length > 0);
  if (populated.length === 0) return null;

  const maxCal = Math.max(1, ...populated.map((w) => w.totals.calories));

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow>TREND · LAST {LOOKBACK_WEEKS} WEEKS</Eyebrow>
        <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>
          Weekly totals
        </div>
      </div>

      <Card padded={false}>
        {weeks.map((w, i) => {
          const isCurrent = i === 0;
          const dayAvg = w.daysLogged > 0 ? Math.round(w.totals.calories / w.daysLogged) : 0;
          const widthPct = (w.totals.calories / maxCal) * 100;
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
                    {w.daysLogged > 0
                      ? `${w.daysLogged} DAY${w.daysLogged === 1 ? '' : 'S'} · AVG ${dayAvg.toLocaleString()} KCAL`
                      : 'NO MEALS'}
                  </div>
                </div>
                <div style={{ ...mono, fontSize: 13, color: 'var(--text-on-dark)', fontWeight: 600 }}>
                  {Math.round(w.totals.calories).toLocaleString()} <span style={{ color: 'var(--text-on-dark-mute)', fontWeight: 400 }}>kcal</span>
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
                    background: isCurrent ? 'var(--lime)' : 'rgba(124, 212, 255, 0.6)',
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

/* ── All meals list ──────────────────────────────────────────────────── */

function AllMealsSection({ meals }: { meals: MealDetailRecord[] }) {
  const days = useMemo(() => groupMealsByDayLocal(meals), [meals]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow>ALL MEALS · LAST {LOOKBACK_WEEKS} WEEKS</Eyebrow>
        <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>Meal log</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {days.map(({ dayKey, dayStartMs: ds, meals: dm }) => {
          const dayCals = Math.round(dm.reduce((s, m) => s + m.totals.calories, 0));
          const dayProt = Math.round(dm.reduce((s, m) => s + m.totals.proteinG, 0));
          return (
            <div key={dayKey} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
                <div style={{ ...display, fontSize: 16, fontWeight: 700 }}>
                  {formatDayLabelLocal(ds)}
                </div>
                <div style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
                  {dm.length} MEAL{dm.length === 1 ? '' : 'S'} · {dayCals.toLocaleString()} KCAL · {dayProt}P
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dm.map((m) => <DayMealRow key={m.id} meal={m} />)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function groupMealsByDayLocal(
  meals: MealDetailRecord[],
): Array<{ dayKey: string; dayStartMs: number; meals: MealDetailRecord[] }> {
  const buckets = new Map<string, MealDetailRecord[]>();
  for (const meal of meals) {
    const d = new Date(meal.loggedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const arr = buckets.get(key);
    if (arr) arr.push(meal);
    else buckets.set(key, [meal]);
  }
  return Array.from(buckets.entries())
    .map(([dayKey, dayMeals]) => {
      const first = new Date(dayMeals[0]!.loggedAt);
      const ds = new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime();
      // Sort earliest → latest within the day so breakfast lands on top.
      const sorted = [...dayMeals].sort((a, b) => a.loggedAt - b.loggedAt);
      return { dayKey, dayStartMs: ds, meals: sorted };
    })
    .sort((a, b) => b.dayStartMs - a.dayStartMs);
}

function formatDayLabelLocal(ds: number, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ds === today) return 'Today';
  if (ds === today - DAY_MS) return 'Yesterday';
  return new Date(ds).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function weekRangeLabel(weekStartMs: number): string {
  const start = new Date(weekStartMs);
  const end = new Date(weekStartMs + 6 * DAY_MS);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Consecutive days (including today) with at least one meal logged. */
function loggingStreak(meals: MealDetailRecord[], now: Date = new Date()): number {
  if (meals.length === 0) return 0;
  const days = new Set(meals.map((m) => dayStartMs(m.loggedAt)));
  const today = dayStartMs(now.getTime());
  // If nothing today, streak resets unless yesterday counted — return 0 to keep semantics simple.
  if (!days.has(today)) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = today - i * DAY_MS;
    if (days.has(day)) streak += 1;
    else break;
  }
  return streak;
}

/* ── Energy balance card ─────────────────────────────────────────────── */

function EnergyBalanceCard({
  today,
  week,
  goals,
  body,
}: {
  today: { meals: MealDetailRecord[]; totals: Macros };
  week: DayTotals[];
  goals: NutritionGoals | null;
  body: BodyProfile | null;
}) {
  const tdee = useMemo(() => deriveTDEE(goals, body), [goals, body]);
  if (tdee == null) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Eyebrow>ENERGY BALANCE</Eyebrow>
          <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>In vs out</div>
        </div>
        <Card>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Set a body profile and goals in{' '}
            <Link href="/settings" style={{ color: 'var(--lime)' }}>Settings</Link>{' '}
            to unlock daily net energy and a projected weekly weight change.
          </p>
        </Card>
      </section>
    );
  }

  // Today's intake range — fall back to ±15% of point estimate when no band stored.
  const todayLow = today.meals.reduce(
    (a, m) => a + (m.caloriesLow ?? Math.round(m.totals.calories * 0.85)),
    0,
  );
  const todayHigh = today.meals.reduce(
    (a, m) => a + (m.caloriesHigh ?? Math.round(m.totals.calories * 1.15)),
    0,
  );

  // Net energy today = intake − TDEE. Negative = deficit (loss).
  const netTodayLow = todayLow - tdee;
  const netTodayHigh = todayHigh - tdee;

  // Week-to-date — average from days that actually had meals. Averaging
  // partial / blank days into the projection makes the numbers absurd
  // (e.g., one 200-kcal meal at noon → "16k kcal deficit this week").
  const todayDay = dayStartMs(Date.now());
  const weekToDate = week.filter((d) => d.dayStartMs <= todayDay);
  const daysWithMeals = weekToDate.filter((d) => d.meals.length > 0);
  const daysLogged = daysWithMeals.length;

  const sumLow = daysWithMeals.reduce(
    (a, d) => a + d.meals.reduce((sa, m) => sa + (m.caloriesLow ?? Math.round(m.totals.calories * 0.85)), 0),
    0,
  );
  const sumHigh = daysWithMeals.reduce(
    (a, d) => a + d.meals.reduce((sa, m) => sa + (m.caloriesHigh ?? Math.round(m.totals.calories * 1.15)), 0),
    0,
  );

  // Need at least 3 fully-logged days for a meaningful projection — fewer
  // and one partial day distorts everything (today's lunch ≠ this week's
  // average). Below the floor we show a "keep logging" hint instead.
  const PROJECTION_MIN_DAYS = 3;
  const canProject = daysLogged >= PROJECTION_MIN_DAYS;

  let lbLow = 0;
  let lbHigh = 0;
  if (canProject) {
    const avgLow = sumLow / daysLogged;
    const avgHigh = sumHigh / daysLogged;
    // Signed: net < 0 → deficit (loss), net > 0 → surplus (gain).
    const netWeekLow = avgLow * 7 - tdee * 7;
    const netWeekHigh = avgHigh * 7 - tdee * 7;
    // 3500 kcal ≈ 1 lb. Keep the sign so the label can branch correctly.
    lbLow = netWeekLow / 3500;
    lbHigh = netWeekHigh / 3500;
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow>ENERGY BALANCE</Eyebrow>
        <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 2 }}>In vs out</div>
      </div>
      <Card>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          <BalanceTile
            label="TODAY · IN"
            primary={`${Math.round(todayLow).toLocaleString()}–${Math.round(todayHigh).toLocaleString()}`}
            unit="KCAL"
          />
          <BalanceTile
            label="TODAY · OUT (TDEE)"
            primary={Math.round(tdee).toLocaleString()}
            unit="KCAL"
          />
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background:
              netTodayHigh < 0
                ? 'rgba(218,255,63,0.06)'
                : netTodayLow > 0
                  ? 'rgba(255,107,74,0.06)'
                  : 'rgba(255,255,255,0.03)',
            border:
              netTodayHigh < 0
                ? '1px solid rgba(218,255,63,0.2)'
                : netTodayLow > 0
                  ? '1px solid rgba(255,107,74,0.2)'
                  : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
          }}
        >
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
            NET TODAY
          </div>
          <div style={{ ...display, fontSize: 22, fontWeight: 700, marginTop: 4 }}>
            {netRangeLabel(netTodayLow, netTodayHigh)}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
          }}
        >
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
            PROJECTED THIS WEEK · {daysLogged} OF 7 DAYS LOGGED
          </div>
          {canProject ? (
            <>
              <div style={{ ...display, fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                {projectedWeightLabel(lbLow, lbHigh)}
              </div>
              <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)', marginTop: 4, letterSpacing: '0.1em' }}>
                ASSUMES YOUR CURRENT PACE HOLDS · 3500 KCAL ≈ 1 LB
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', marginTop: 6, lineHeight: 1.5 }}>
              Keep logging — projection unlocks once you have {PROJECTION_MIN_DAYS}+ days of meals
              this week. One partial day skews the math.
            </div>
          )}
        </div>

        <div
          style={{
            ...mono,
            fontSize: 9,
            color: 'var(--text-on-dark-faint)',
            marginTop: 12,
            letterSpacing: '0.1em',
            lineHeight: 1.6,
          }}
        >
          OUT IS YOUR TDEE — TYPICAL DAILY BURN INCLUDING ACTIVITY MULTIPLIER. WORKOUT-BURN ESTIMATES ARE
          SHOWN SEPARATELY ON /WORKOUTS AND ARE NOT ADDED HERE TO AVOID DOUBLE-COUNTING.
        </div>
      </Card>
    </section>
  );
}

function BalanceTile({ label, primary, unit }: { label: string; primary: string; unit: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ ...display, fontSize: 24, fontWeight: 700 }}>{primary}</span>
        <span style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>{unit}</span>
      </div>
    </div>
  );
}

function netRangeLabel(low: number, high: number): string {
  const fmt = (n: number) => `${n < 0 ? '−' : '+'}${Math.round(Math.abs(n)).toLocaleString()}`;
  if (low === high) return `${fmt(low)} KCAL`;
  return `${fmt(low)} → ${fmt(high)} KCAL`;
}

function projectedWeightLabel(lo: number, hi: number): string {
  // lo and hi are signed lbs (kcal/3500). Negative = deficit → loss.
  // Positive = surplus → gain. Caller passes [low-end, high-end] of the
  // intake band, so lo ≤ hi by construction.
  const fmt = (v: number) => Math.abs(v).toFixed(2);
  if (hi < 0) return `Expected loss · ${fmt(hi)}–${fmt(lo)} lb`;       // both deficits
  if (lo > 0) return `Expected gain · ${fmt(lo)}–${fmt(hi)} lb`;       // both surpluses
  // Mixed — band crosses maintenance.
  return `Could go either way · ${fmt(lo)} lb loss to ${fmt(hi)} lb gain`;
}

function deriveTDEE(goals: NutritionGoals | null, body: BodyProfile | null): number | null {
  if (!goals) return null;
  if (!body) return goals.caloriesDaily.target; // fall back: target ≈ TDEE for "maintain"
  const target = goals.caloriesDaily.target;
  const lbPerWeek = body.goalLbPerWeek || 0;
  const dailyDelta = (lbPerWeek * 3500) / 7;
  if (body.goalDirection === 'lose') return target + dailyDelta;
  if (body.goalDirection === 'gain') return target - dailyDelta;
  return target;
}

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};
