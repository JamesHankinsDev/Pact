'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { saveWorkoutSession } from '@/lib/workouts';
import type { ExerciseTag } from '@pact/types';

/* ── Today's plan — hardcoded for v1 ──────────────────────────────────
 * When the Planning Hub lands, this will come from
 * groups/{id}/plans/{week}/days/{date} or similar. For now, every user
 * gets the same Push Day so we can exercise the log-and-save path. */
type PlannedExercise = {
  id: string;
  name: string;
  plannedSets: number;
  plannedReps: number;
  plannedWeight: number;
  cue?: string;
};

const PLAN_TITLE = 'Push Day · Bench';
const PLAN_TAG: ExerciseTag = 'push';
const PLAN: PlannedExercise[] = [
  {
    id: 'bench',
    name: 'Bench Press',
    plannedSets: 5,
    plannedReps: 5,
    plannedWeight: 195,
    cue: 'You hit 185 × 5×5 last week. Aim 190–195 today.',
  },
  {
    id: 'incline-db',
    name: 'Incline DB',
    plannedSets: 4,
    plannedReps: 8,
    plannedWeight: 55,
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    plannedSets: 3,
    plannedReps: 12,
    plannedWeight: 30,
  },
];

type SetLog = { weight: string; reps: string; done: boolean };
type ExerciseLog = { id: string; name: string; sets: SetLog[] };

function initialLogs(): ExerciseLog[] {
  return PLAN.map((ex) => ({
    id: ex.id,
    name: ex.name,
    sets: Array.from({ length: ex.plannedSets }, () => ({
      weight: String(ex.plannedWeight),
      reps: String(ex.plannedReps),
      done: false,
    })),
  }));
}

type SaveState = 'idle' | 'saving' | 'error';

export function WorkoutInner() {
  const router = useRouter();
  const { user, profile, loading: authLoading, configured } = useAuth();
  const [logs, setLogs] = useState<ExerciseLog[]>(() => initialLogs());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const startedAt = useMemo(() => Date.now(), []);

  const updateSet = useCallback(
    (exId: string, setIdx: number, field: 'weight' | 'reps', value: string) => {
      setLogs((prev) =>
        prev.map((ex) =>
          ex.id !== exId
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)),
              },
        ),
      );
    },
    [],
  );

  const toggleDone = useCallback((exId: string, setIdx: number) => {
    setLogs((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, done: !s.done } : s)),
            },
      ),
    );
  }, []);

  const addSet = useCallback((exId: string) => {
    setLogs((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, { weight: last?.weight ?? '', reps: last?.reps ?? '', done: false }],
        };
      }),
    );
  }, []);

  const removeSet = useCallback((exId: string, setIdx: number) => {
    setLogs((prev) =>
      prev.map((ex) =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) },
      ),
    );
  }, []);

  const completedCount = useMemo(
    () => logs.reduce((acc, ex) => acc + ex.sets.filter((s) => s.done).length, 0),
    [logs],
  );

  const handleFinish = async () => {
    if (!configured) {
      setError('Firebase is not configured.');
      return;
    }
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent('/workout')}`);
      return;
    }
    if (!profile?.currentGroupId) {
      setError('You need to be in a pact to log a workout. Make or join one first.');
      return;
    }

    const exercisesPayload = logs
      .map((ex) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets
          .filter((s) => s.done)
          .map((s) => ({
            weight: parseFloat(s.weight) || 0,
            reps: parseInt(s.reps, 10) || 0,
          }))
          .filter((s) => s.weight > 0 && s.reps > 0),
      }))
      .filter((ex) => ex.sets.length > 0);

    if (exercisesPayload.length === 0) {
      setError('Tick at least one set as done — empty workouts aren’t saved.');
      return;
    }

    setSaveState('saving');
    setError(null);
    try {
      const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
      await saveWorkoutSession({
        uid: user.uid,
        groupId: profile.currentGroupId,
        title: PLAN_TITLE,
        tag: PLAN_TAG,
        durationMin,
        exercises: exercisesPayload,
      });
      router.replace('/dashboard');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : 'Could not save workout');
    }
  };

  return (
    <div style={shellOuter}>
      <div style={shellInner}>
        <header style={headerStyle}>
          <Link href="/dashboard" style={backLink}>
            ← BACK
          </Link>
          <Eyebrow>TODAY · WORKOUT</Eyebrow>
        </header>

        <div style={titleBlock}>
          <h1 style={titleStyle}>{PLAN_TITLE}</h1>
          <p style={subtitleStyle}>
            {PLAN.length} exercise{PLAN.length === 1 ? '' : 's'} · tick each set as you finish
          </p>
        </div>

        {!authLoading && !user && (
          <Card>
            <p style={{ fontSize: 13, margin: 0 }}>
              You need to{' '}
              <Link
                href={`/auth?next=${encodeURIComponent('/workout')}`}
                style={{ color: 'var(--lime)' }}
              >
                sign in
              </Link>{' '}
              to log a workout.
            </p>
          </Card>
        )}

        {logs.map((ex) => {
          const planned = PLAN.find((p) => p.id === ex.id);
          return (
            <ExerciseSection
              key={ex.id}
              ex={ex}
              cue={planned?.cue}
              onUpdateSet={(setIdx, field, value) => updateSet(ex.id, setIdx, field, value)}
              onToggleDone={(setIdx) => toggleDone(ex.id, setIdx)}
              onAddSet={() => addSet(ex.id)}
              onRemoveSet={(setIdx) => removeSet(ex.id, setIdx)}
            />
          );
        })}

        {error && (
          <div style={errorBox}>
            <Eyebrow color="var(--coral)">ERROR</Eyebrow>
            <p style={{ fontSize: 13, color: 'var(--coral)', margin: '6px 0 0' }}>{error}</p>
          </div>
        )}

        <div style={footerStyle}>
          <button
            type="button"
            onClick={handleFinish}
            disabled={saveState === 'saving' || authLoading}
            className="btn btn-lime"
            style={{
              width: '100%',
              padding: '16px 20px',
              fontSize: 15,
              opacity: saveState === 'saving' || authLoading ? 0.6 : 1,
            }}
          >
            {saveState === 'saving' ? 'Saving…' : `Finish workout · ${completedCount} sets`}
            <Icon name="check" size={16} color="#0a0a0a" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Per-exercise section ────────────────────────────────────────────── */

function ExerciseSection({
  ex,
  cue,
  onUpdateSet,
  onToggleDone,
  onAddSet,
  onRemoveSet,
}: {
  ex: ExerciseLog;
  cue?: string;
  onUpdateSet: (setIdx: number, field: 'weight' | 'reps', value: string) => void;
  onToggleDone: (setIdx: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
}) {
  const doneCount = ex.sets.filter((s) => s.done).length;
  return (
    <Card style={{ padding: 0 }}>
      <div style={exerciseHeader}>
        <div>
          <Eyebrow>EXERCISE</Eyebrow>
          <div style={exerciseTitle}>{ex.name}</div>
        </div>
        <span style={exerciseCount}>
          {doneCount}/{ex.sets.length}
        </span>
      </div>

      <div style={{ padding: '4px 18px 16px' }}>
        {ex.sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            set={s}
            onWeight={(v) => onUpdateSet(i, 'weight', v)}
            onReps={(v) => onUpdateSet(i, 'reps', v)}
            onToggle={() => onToggleDone(i)}
            onRemove={ex.sets.length > 1 ? () => onRemoveSet(i) : undefined}
          />
        ))}
        <button type="button" onClick={onAddSet} style={addSetBtn}>
          <Icon name="plus" size={12} color="var(--text-on-dark-mute)" strokeWidth={2.5} />
          Add set
        </button>
      </div>

      {cue && (
        <div style={cueBox}>
          <Icon name="sparkle" size={14} color="var(--lime)" />
          <div>
            <div style={cueLabel}>PACT NOTICED</div>
            <div style={cueText}>{cue}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Set row ─────────────────────────────────────────────────────────── */

function SetRow({
  index,
  set,
  onWeight,
  onReps,
  onToggle,
  onRemove,
}: {
  index: number;
  set: SetLog;
  onWeight: (v: string) => void;
  onReps: (v: string) => void;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <div style={{ ...rowStyle, opacity: set.done ? 0.7 : 1 }}>
      <span style={rowIndex}>{index + 1}.</span>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9.]*"
        value={set.weight}
        onChange={(e) => onWeight(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder="lb"
        style={inputStyle}
        aria-label={`Set ${index + 1} weight`}
      />
      <span style={rowSep}>×</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={set.reps}
        onChange={(e) => onReps(e.target.value.replace(/\D/g, ''))}
        placeholder="reps"
        style={inputStyle}
        aria-label={`Set ${index + 1} reps`}
      />
      <button
        type="button"
        onClick={onToggle}
        style={set.done ? tickOn : tickOff}
        aria-label={set.done ? 'Mark set as not done' : 'Mark set as done'}
      >
        {set.done && <Icon name="check" size={14} color="#0a0a0a" strokeWidth={2.5} />}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} style={removeBtn} aria-label="Remove set">
          <Icon name="x" size={12} color="var(--text-on-dark-faint)" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const shellOuter: CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--ink)',
  color: 'var(--text-on-dark)',
  display: 'flex',
  justifyContent: 'center',
};

const shellInner: CSSProperties = {
  width: '100%',
  maxWidth: 480,
  padding: '50px 22px 40px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const backLink: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 11,
  color: 'var(--text-on-dark-mute)',
  textDecoration: 'none',
  letterSpacing: '0.14em',
};

const titleBlock: CSSProperties = {
  marginTop: 4,
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--f-display)',
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  margin: '0 0 4px',
};

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-on-dark-mute)',
  margin: 0,
  lineHeight: 1.5,
};

const exerciseHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  padding: '14px 18px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};

const exerciseTitle: CSSProperties = {
  fontFamily: 'var(--f-display)',
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  marginTop: 4,
};

const exerciseCount: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 12,
  color: 'var(--text-on-dark-mute)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 10,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

const rowIndex: CSSProperties = {
  width: 22,
  fontFamily: 'var(--f-mono)',
  fontSize: 12,
  color: 'var(--text-on-dark-faint)',
};

const inputStyle: CSSProperties = {
  width: 64,
  padding: '8px 10px',
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  fontFamily: 'var(--f-mono)',
  fontSize: 14,
  textAlign: 'center',
  outline: 'none',
};

const rowSep: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 12,
  color: 'var(--text-on-dark-faint)',
};

const tickBase: CSSProperties = {
  marginLeft: 'auto',
  width: 28,
  height: 28,
  borderRadius: 14,
  borderWidth: 2,
  borderStyle: 'solid',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
};

const tickOn: CSSProperties = {
  ...tickBase,
  background: 'var(--lime)',
  borderColor: 'var(--lime)',
};

const tickOff: CSSProperties = {
  ...tickBase,
  background: 'transparent',
  borderColor: 'rgba(255,255,255,0.25)',
};

const removeBtn: CSSProperties = {
  width: 22,
  height: 22,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const addSetBtn: CSSProperties = {
  marginTop: 8,
  width: '100%',
  padding: '10px 12px',
  border: '1px dashed rgba(255,255,255,0.12)',
  background: 'transparent',
  color: 'var(--text-on-dark-mute)',
  borderRadius: 10,
  fontFamily: 'var(--f-ui)',
  fontWeight: 500,
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
};

const cueBox: CSSProperties = {
  margin: '0 18px 16px',
  padding: '10px 12px',
  background: 'rgba(218,255,63,0.06)',
  border: '1px solid rgba(218,255,63,0.2)',
  borderRadius: 12,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
};

const cueLabel: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 10,
  color: 'var(--lime)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
};

const cueText: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-on-dark)',
  marginTop: 4,
  lineHeight: 1.5,
};

const errorBox: CSSProperties = {
  background: 'rgba(255,107,74,0.1)',
  border: '1px solid rgba(255,107,74,0.3)',
  borderRadius: 12,
  padding: '10px 14px',
};

const footerStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  paddingTop: 6,
  paddingBottom: 8,
  background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,1) 30%)',
};
