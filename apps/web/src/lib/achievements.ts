import type { IconName } from '@/components/primitives';
import type { MealRecord, WeightRecord, WorkoutRecord } from './group-data';
import type { WorkoutDetail } from './workouts';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export type AchievementCategory =
  | 'logging-streak'        // consecutive days of meal logs
  | 'training-streak'       // consecutive days of workout logs
  | 'meals-count'           // cumulative meals logged
  | 'workouts-count'        // cumulative workouts logged
  | 'weight-loss'           // % off starting weight (down)
  | 'weight-gain'           // % above starting weight (up)
  | 'volume';               // cumulative lbs lifted (self only — needs detailed)

export type AchievementDef = {
  id: string;
  category: AchievementCategory;
  tier: AchievementTier;
  threshold: number;
  /** Short title shown on the chip. */
  label: string;
  /** One-line description. */
  description: string;
  icon: IconName;
};

export const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#daff3f',
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // Logging streaks
  { id: 'log-3',   category: 'logging-streak',  tier: 'bronze', threshold: 3,  label: '3-Day Logger',   description: '3 days in a row of meals logged.', icon: 'flame' },
  { id: 'log-7',   category: 'logging-streak',  tier: 'silver', threshold: 7,  label: 'Week of Logs',   description: '7 days in a row of meals logged.', icon: 'flame' },
  { id: 'log-30',  category: 'logging-streak',  tier: 'gold',   threshold: 30, label: 'Month of Logs',  description: '30 days in a row of meals logged.', icon: 'flame' },

  // Training streaks
  { id: 'train-3', category: 'training-streak', tier: 'bronze', threshold: 3, label: '3-Day Trainer',  description: 'Trained 3 days in a row.', icon: 'dumbbell' },
  { id: 'train-5', category: 'training-streak', tier: 'silver', threshold: 5, label: '5-Day Trainer',  description: 'Trained 5 days in a row.', icon: 'dumbbell' },
  { id: 'train-7', category: 'training-streak', tier: 'gold',   threshold: 7, label: 'Week of Iron',   description: 'Trained 7 days in a row.', icon: 'dumbbell' },

  // Total meals
  { id: 'meals-25',  category: 'meals-count', tier: 'bronze', threshold: 25,  label: '25 Meals',     description: 'Logged 25 meals.', icon: 'bowl' },
  { id: 'meals-100', category: 'meals-count', tier: 'silver', threshold: 100, label: '100 Meals',    description: 'Logged 100 meals.', icon: 'bowl' },
  { id: 'meals-500', category: 'meals-count', tier: 'gold',   threshold: 500, label: '500 Meals',    description: 'Logged 500 meals.', icon: 'bowl' },

  // Total workouts
  { id: 'workouts-10',  category: 'workouts-count', tier: 'bronze', threshold: 10,  label: '10 Workouts',   description: 'Logged 10 workouts.', icon: 'dumbbell' },
  { id: 'workouts-50',  category: 'workouts-count', tier: 'silver', threshold: 50,  label: '50 Workouts',   description: 'Logged 50 workouts.', icon: 'dumbbell' },
  { id: 'workouts-200', category: 'workouts-count', tier: 'gold',   threshold: 200, label: '200 Workouts',  description: 'Logged 200 workouts.', icon: 'dumbbell' },

  // Weight loss
  { id: 'loss-1', category: 'weight-loss', tier: 'bronze', threshold: 1, label: 'Down 1%',  description: 'Down 1% from your starting weight.',  icon: 'weight' },
  { id: 'loss-3', category: 'weight-loss', tier: 'silver', threshold: 3, label: 'Down 3%',  description: 'Down 3% from your starting weight.',  icon: 'weight' },
  { id: 'loss-5', category: 'weight-loss', tier: 'gold',   threshold: 5, label: 'Down 5%',  description: 'Down 5% from your starting weight.',  icon: 'weight' },

  // Weight gain (lean bulk territory)
  { id: 'gain-1', category: 'weight-gain', tier: 'bronze', threshold: 1, label: 'Up 1%',  description: '1% lean gain from your starting weight.',  icon: 'weight' },
  { id: 'gain-3', category: 'weight-gain', tier: 'silver', threshold: 3, label: 'Up 3%',  description: '3% lean gain from your starting weight.',  icon: 'weight' },
  { id: 'gain-5', category: 'weight-gain', tier: 'gold',   threshold: 5, label: 'Up 5%',  description: '5% lean gain from your starting weight.',  icon: 'weight' },

  // Volume (self only — requires detailed workouts to compute weight × reps)
  { id: 'vol-10k',  category: 'volume', tier: 'bronze', threshold: 10_000,  label: '10k Lifted',     description: '10,000 lbs cumulative lifted.',  icon: 'flame' },
  { id: 'vol-50k',  category: 'volume', tier: 'silver', threshold: 50_000,  label: '50k Lifted',     description: '50,000 lbs cumulative lifted.',  icon: 'flame' },
  { id: 'vol-250k', category: 'volume', tier: 'gold',   threshold: 250_000, label: 'Quarter Million',description: '250,000 lbs cumulative lifted.', icon: 'flame' },
];

export type EarnedAchievement = {
  def: AchievementDef;
  /** Best-effort timestamp for when this was unlocked. */
  earnedAt: number;
  /** Actual value at the time of unlocking (e.g. % loss, lb total). */
  value: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Active consecutive-day streak ending today (or 0 if today missing). */
function consecutiveStreak(timestamps: number[], now: Date = new Date()): number {
  if (timestamps.length === 0) return 0;
  const days = new Set(timestamps.map(dayStart));
  const today = dayStart(now.getTime());
  if (!days.has(today)) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (days.has(today - i * DAY_MS)) streak += 1;
    else break;
  }
  return streak;
}

/** Most recent activity timestamp in the input array. */
function mostRecent(ts: number[]): number {
  return ts.reduce((a, b) => (b > a ? b : a), 0);
}

/** Build a sorted list of earned achievements for one member. */
export function computeMemberAchievements({
  meals,
  workouts,
  weightLogs,
  detailedWorkouts,
}: {
  meals: MealRecord[];
  workouts: WorkoutRecord[];
  weightLogs: WeightRecord[];
  /** Optional — if provided, volume achievements are computed. Pass for self only. */
  detailedWorkouts?: WorkoutDetail[];
}): EarnedAchievement[] {
  const earned: EarnedAchievement[] = [];

  // ── Logging streak (meals)
  const mealStreak = consecutiveStreak(meals.map((m) => m.loggedAt));
  if (mealStreak > 0) {
    const recentMealMs = mostRecent(meals.map((m) => m.loggedAt));
    for (const def of ACHIEVEMENTS) {
      if (def.category === 'logging-streak' && mealStreak >= def.threshold) {
        earned.push({ def, earnedAt: recentMealMs, value: mealStreak });
      }
    }
  }

  // ── Training streak (workouts)
  const trainStreak = consecutiveStreak(workouts.map((w) => w.loggedAt));
  if (trainStreak > 0) {
    const recentWorkoutMs = mostRecent(workouts.map((w) => w.loggedAt));
    for (const def of ACHIEVEMENTS) {
      if (def.category === 'training-streak' && trainStreak >= def.threshold) {
        earned.push({ def, earnedAt: recentWorkoutMs, value: trainStreak });
      }
    }
  }

  // ── Meals count
  if (meals.length > 0) {
    const sortedAsc = [...meals].sort((a, b) => a.loggedAt - b.loggedAt);
    for (const def of ACHIEVEMENTS) {
      if (def.category === 'meals-count' && meals.length >= def.threshold) {
        const cross = sortedAsc[def.threshold - 1];
        earned.push({
          def,
          earnedAt: cross?.loggedAt ?? mostRecent(meals.map((m) => m.loggedAt)),
          value: meals.length,
        });
      }
    }
  }

  // ── Workouts count
  if (workouts.length > 0) {
    const sortedAsc = [...workouts].sort((a, b) => a.loggedAt - b.loggedAt);
    for (const def of ACHIEVEMENTS) {
      if (def.category === 'workouts-count' && workouts.length >= def.threshold) {
        const cross = sortedAsc[def.threshold - 1];
        earned.push({
          def,
          earnedAt: cross?.loggedAt ?? mostRecent(workouts.map((w) => w.loggedAt)),
          value: workouts.length,
        });
      }
    }
  }

  // ── Weight change (loss / gain)
  if (weightLogs.length >= 2) {
    const sortedAsc = [...weightLogs].sort((a, b) => a.loggedAt - b.loggedAt);
    const start = sortedAsc[0]!.weightLb;
    if (start > 0) {
      const latest = sortedAsc[sortedAsc.length - 1]!;
      const pct = ((latest.weightLb - start) / start) * 100;
      const isLoss = pct < 0;
      const isGain = pct > 0;
      for (const def of ACHIEVEMENTS) {
        if (def.category === 'weight-loss' && isLoss && Math.abs(pct) >= def.threshold) {
          // Earn at the first log that crossed the threshold (downward).
          const crossLog = sortedAsc.find((l) => ((l.weightLb - start) / start) * 100 <= -def.threshold);
          earned.push({
            def,
            earnedAt: crossLog?.loggedAt ?? latest.loggedAt,
            value: Math.abs(pct),
          });
        }
        if (def.category === 'weight-gain' && isGain && pct >= def.threshold) {
          const crossLog = sortedAsc.find((l) => ((l.weightLb - start) / start) * 100 >= def.threshold);
          earned.push({
            def,
            earnedAt: crossLog?.loggedAt ?? latest.loggedAt,
            value: pct,
          });
        }
      }
    }
  }

  // ── Volume (self only)
  if (detailedWorkouts && detailedWorkouts.length > 0) {
    const sortedAsc = [...detailedWorkouts].sort((a, b) => a.loggedAt - b.loggedAt);
    let running = 0;
    let crossedAt: Record<string, number | undefined> = {};
    for (const w of sortedAsc) {
      const wVol = w.exercises.reduce(
        (acc, ex) => acc + ex.sets.reduce((a, s) => a + s.weight * s.reps, 0),
        0,
      );
      running += wVol;
      for (const def of ACHIEVEMENTS) {
        if (def.category === 'volume' && running >= def.threshold && crossedAt[def.id] == null) {
          crossedAt[def.id] = w.loggedAt;
        }
      }
    }
    for (const def of ACHIEVEMENTS) {
      if (def.category === 'volume' && crossedAt[def.id] != null) {
        earned.push({
          def,
          earnedAt: crossedAt[def.id]!,
          value: running,
        });
      }
    }
  }

  return earned.sort((a, b) => b.earnedAt - a.earnedAt);
}

/** For each tier in a category, only keep the highest tier earned. */
export function topTierByCategory(achievements: EarnedAchievement[]): EarnedAchievement[] {
  const tierRank: Record<AchievementTier, number> = { bronze: 1, silver: 2, gold: 3 };
  const best = new Map<AchievementCategory, EarnedAchievement>();
  for (const a of achievements) {
    const existing = best.get(a.def.category);
    if (!existing || tierRank[a.def.tier] > tierRank[existing.def.tier]) {
      best.set(a.def.category, a);
    }
  }
  return Array.from(best.values()).sort((a, b) => b.earnedAt - a.earnedAt);
}

export type CrewAchievement = {
  memberUid: string;
  achievement: EarnedAchievement;
};

/**
 * Compute the top achievement per category per crew member, sorted by most
 * recently earned. Useful for the "Crew · Milestones" feed on the dashboard.
 */
export function computeCrewAchievements(perMember: Array<{
  memberUid: string;
  meals: MealRecord[];
  workouts: WorkoutRecord[];
  weightLogs: WeightRecord[];
}>): CrewAchievement[] {
  const all: CrewAchievement[] = [];
  for (const m of perMember) {
    const earned = topTierByCategory(
      computeMemberAchievements({
        meals: m.meals,
        workouts: m.workouts,
        weightLogs: m.weightLogs,
        // Crew volume not computed — would require loading detailed workouts
        // for every member which is more than we want to do on the dashboard.
      }),
    );
    for (const a of earned) {
      all.push({ memberUid: m.memberUid, achievement: a });
    }
  }
  return all.sort((a, b) => b.achievement.earnedAt - a.achievement.earnedAt);
}

/* ── Habit feed: kudos + nudges ──────────────────────────────────────── */

export type CrewFeedKind = 'achievement' | 'kudos' | 'nudge';

export type CrewFeedItem = {
  id: string;
  memberUid: string;
  /** Sort timestamp — most recent activity tied to this event. */
  ts: number;
  kind: CrewFeedKind;
  title: string;       // e.g. "5-day meal logging streak", "Hasn't logged a workout in 5 days"
  cta: string;         // e.g. "Send kudos", "Lend some strength"
  icon: IconName;
  tone: 'positive' | 'encourage';
};

const KUDOS_MEAL_DAYS = 5;          // 5+ consecutive days with ≥2 meals
const KUDOS_TRAINING_DAYS = 3;      // 3+ consecutive days with at least 1 workout
const NUDGE_MEAL_DAYS = 2;          // ≥2 days since last meal log, but they were active before
const NUDGE_TRAINING_DAYS = 5;      // ≥5 days since last workout, but they had recent activity
const NUDGE_HISTORY_WINDOW_DAYS = 30; // "had been logging" lookback to avoid nudging total newcomers

/** Days of consecutive meal-rich logging ending today (≥2 meals/day). */
function consecutiveDaysWithMeals(meals: MealRecord[], minMealsPerDay: number, now: Date = new Date()): number {
  if (meals.length === 0) return 0;
  const byDay = new Map<number, number>();
  for (const m of meals) {
    const k = dayStart(m.loggedAt);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const today = dayStart(now.getTime());
  if ((byDay.get(today) ?? 0) < minMealsPerDay) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = today - i * DAY_MS;
    if ((byDay.get(day) ?? 0) >= minMealsPerDay) streak += 1;
    else break;
  }
  return streak;
}

function daysSinceMostRecent(timestamps: number[], now: Date = new Date()): number {
  if (timestamps.length === 0) return Infinity;
  const newest = timestamps.reduce((a, b) => (b > a ? b : a), 0);
  const today = dayStart(now.getTime());
  const newestDay = dayStart(newest);
  return Math.max(0, Math.round((today - newestDay) / DAY_MS));
}

function hasRecentActivity(timestamps: number[], windowDays: number, now: Date = new Date()): boolean {
  if (timestamps.length === 0) return false;
  const cutoff = now.getTime() - windowDays * DAY_MS;
  return timestamps.some((t) => t >= cutoff);
}

/**
 * Build a unified crew feed: milestone unlocks (positive), habit kudos
 * (positive — for active streaks worth celebrating), and habit nudges
 * (encouragement — for slipping habits the crew can rally around).
 *
 * The feed deliberately avoids exact metrics or submissions — entries are
 * narrative ("3-day training streak") not specific ("ate 1,200 kcal").
 */
export function computeCrewFeed(
  perMember: Array<{
    memberUid: string;
    meals: MealRecord[];
    workouts: WorkoutRecord[];
    weightLogs: WeightRecord[];
  }>,
  selfUid: string | null = null,
  now: Date = new Date(),
): CrewFeedItem[] {
  const items: CrewFeedItem[] = [];
  const todayMs = now.getTime();

  for (const m of perMember) {
    const isSelf = m.memberUid === selfUid;

    // 1) Milestones (top tier per category) ── positive
    const milestones = topTierByCategory(
      computeMemberAchievements({
        meals: m.meals,
        workouts: m.workouts,
        weightLogs: m.weightLogs,
      }),
    );
    for (const a of milestones) {
      items.push({
        id: `${m.memberUid}-ach-${a.def.id}`,
        memberUid: m.memberUid,
        ts: a.earnedAt,
        kind: 'achievement',
        title: achievementTitle(a),
        cta: isSelf ? 'You earned it' : 'Send kudos',
        icon: a.def.icon,
        tone: 'positive',
      });
    }

    // 2) Habit kudos ── positive recurring streaks worth shouting out
    const mealRichDays = consecutiveDaysWithMeals(m.meals, 2, now);
    if (mealRichDays >= KUDOS_MEAL_DAYS) {
      items.push({
        id: `${m.memberUid}-kudos-meals-${mealRichDays}`,
        memberUid: m.memberUid,
        ts: todayMs,
        kind: 'kudos',
        title: `Logged 2+ meals every day for ${mealRichDays} days`,
        cta: isSelf ? 'Keep it up' : 'Give some kudos',
        icon: 'flame',
        tone: 'positive',
      });
    }
    const trainStreak = consecutiveStreak(m.workouts.map((w) => w.loggedAt), now);
    if (trainStreak >= KUDOS_TRAINING_DAYS) {
      items.push({
        id: `${m.memberUid}-kudos-train-${trainStreak}`,
        memberUid: m.memberUid,
        ts: todayMs,
        kind: 'kudos',
        title: `${trainStreak} days of training in a row`,
        cta: isSelf ? 'Keep it up' : 'Give some kudos',
        icon: 'dumbbell',
        tone: 'positive',
      });
    }

    // 3) Habit nudges ── slipping habits the crew can rally around
    //    Only fire if they have history (so we don't nudge brand-new members).
    const mealsTs = m.meals.map((mm) => mm.loggedAt);
    const workoutsTs = m.workouts.map((w) => w.loggedAt);
    const mealsSilence = daysSinceMostRecent(mealsTs, now);
    const workoutsSilence = daysSinceMostRecent(workoutsTs, now);

    if (
      !isSelf &&
      mealsSilence >= NUDGE_MEAL_DAYS &&
      mealsSilence !== Infinity &&
      hasRecentActivity(mealsTs, NUDGE_HISTORY_WINDOW_DAYS, now)
    ) {
      items.push({
        id: `${m.memberUid}-nudge-meals-${mealsSilence}`,
        memberUid: m.memberUid,
        ts: todayMs - mealsSilence * DAY_MS,
        kind: 'nudge',
        title: `Hasn't logged a meal in ${mealsSilence} day${mealsSilence === 1 ? '' : 's'}`,
        cta: 'Send some encouragement',
        icon: 'bowl',
        tone: 'encourage',
      });
    }

    if (
      !isSelf &&
      workoutsSilence >= NUDGE_TRAINING_DAYS &&
      workoutsSilence !== Infinity &&
      hasRecentActivity(workoutsTs, NUDGE_HISTORY_WINDOW_DAYS, now)
    ) {
      items.push({
        id: `${m.memberUid}-nudge-train-${workoutsSilence}`,
        memberUid: m.memberUid,
        ts: todayMs - workoutsSilence * DAY_MS,
        kind: 'nudge',
        title: `Hasn't trained in ${workoutsSilence} days`,
        cta: 'Lend some strength',
        icon: 'dumbbell',
        tone: 'encourage',
      });
    }
  }

  return items.sort((a, b) => b.ts - a.ts);
}

function achievementTitle(a: EarnedAchievement): string {
  switch (a.def.category) {
    case 'logging-streak':
      return `${a.value}-day meal logging streak`;
    case 'training-streak':
      return `${a.value}-day training streak`;
    case 'meals-count':
      return `${a.def.label} unlocked`;
    case 'workouts-count':
      return `${a.def.label} unlocked`;
    case 'weight-loss':
      return `Down ${a.value.toFixed(1)}% from starting weight`;
    case 'weight-gain':
      return `Up ${a.value.toFixed(1)}% from starting weight`;
    case 'volume':
      return `${a.def.label} (${Math.round(a.value).toLocaleString()} lbs)`;
  }
}
