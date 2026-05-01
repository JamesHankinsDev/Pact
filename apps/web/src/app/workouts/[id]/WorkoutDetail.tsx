'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand, Card, Chip, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { loadWorkout, updateWorkout, type WorkoutDetail as WorkoutDetailRecord } from '@/lib/workouts';
import { formatTime } from '@/lib/meals';
import type { ExerciseTag } from '@pact/types';

const TAGS: ExerciseTag[] = ['push', 'pull', 'legs', 'cardio', 'rest', 'crew'];

type State =
  | { status: 'loading' }
  | { status: 'ready'; workout: WorkoutDetailRecord }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export function WorkoutDetail({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent(`/workouts/${workoutId}`)}`);
      return;
    }
    if (!profile?.currentGroupId) return;
    let cancelled = false;
    loadWorkout(profile.currentGroupId, workoutId)
      .then((w) => {
        if (cancelled) return;
        if (!w) setState({ status: 'missing' });
        else setState({ status: 'ready', workout: w });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load workout' });
      });
    return () => { cancelled = true; };
  }, [authLoading, user, profile, workoutId, router]);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text-on-dark)', padding: '32px 24px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/workouts" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
            ← WORKOUT LOG
          </Link>
        </header>

        {state.status === 'loading' && (
          <Card>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--text-on-dark-mute)' }}>Loading…</p>
          </Card>
        )}

        {state.status === 'missing' && (
          <Card>
            <Eyebrow>NOT FOUND</Eyebrow>
            <p style={{ fontSize: 13, marginTop: 6, marginBottom: 12, lineHeight: 1.5 }}>
              That workout doesn&rsquo;t exist or has been removed.
            </p>
            <Link href="/workouts" className="btn btn-ghost-dark" style={{ padding: '10px 14px', fontSize: 13, display: 'inline-flex' }}>
              Back to workout log
            </Link>
          </Card>
        )}

        {state.status === 'error' && (
          <Card style={{ borderColor: 'rgba(255,107,74,0.3)', background: 'rgba(255,107,74,0.08)' }}>
            <Eyebrow color="var(--coral)">ERROR</Eyebrow>
            <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{state.message}</p>
          </Card>
        )}

        {state.status === 'ready' && user && profile?.currentGroupId && (
          <EditableWorkout
            workout={state.workout}
            canEdit={state.workout.memberId === user.uid}
            groupId={profile.currentGroupId}
            onSaved={(updated) => setState({ status: 'ready', workout: updated })}
          />
        )}
      </div>
    </main>
  );
}

/* ── Editable form ───────────────────────────────────────────────────── */

type EditableSet = { weight: string; reps: string; rpe: string };
type EditableExercise = { id: string; name: string; sets: EditableSet[]; notes: string };
type Form = {
  title: string;
  tag: ExerciseTag;
  durationMin: string;
  exercises: EditableExercise[];
};

function toForm(w: WorkoutDetailRecord): Form {
  return {
    title: w.title,
    tag: w.tag,
    durationMin: w.durationMin != null ? String(w.durationMin) : '',
    exercises: w.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      notes: ex.notes ?? '',
      sets: ex.sets.map((s) => ({
        weight: String(s.weight),
        reps: String(s.reps),
        rpe: s.rpe != null ? String(s.rpe) : '',
      })),
    })),
  };
}

function isDirty(form: Form, original: WorkoutDetailRecord): boolean {
  if (form.title !== original.title) return true;
  if (form.tag !== original.tag) return true;
  const dur = numOrNull(form.durationMin);
  if (dur !== original.durationMin) return true;
  if (form.exercises.length !== original.exercises.length) return true;
  for (let i = 0; i < form.exercises.length; i++) {
    const a = form.exercises[i]!;
    const b = original.exercises[i]!;
    if (a.name !== b.name) return true;
    if ((a.notes || '') !== (b.notes ?? '')) return true;
    if (a.sets.length !== b.sets.length) return true;
    for (let j = 0; j < a.sets.length; j++) {
      const sa = a.sets[j]!;
      const sb = b.sets[j]!;
      if (numOrZero(sa.weight) !== sb.weight) return true;
      if (numOrZero(sa.reps) !== sb.reps) return true;
      const aRpe = sa.rpe.trim() ? numOrZero(sa.rpe) : undefined;
      if (aRpe !== sb.rpe) return true;
    }
  }
  return false;
}

function EditableWorkout({
  workout,
  canEdit,
  groupId,
  onSaved,
}: {
  workout: WorkoutDetailRecord;
  canEdit: boolean;
  groupId: string;
  onSaved: (updated: WorkoutDetailRecord) => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(workout));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => { setForm(toForm(workout)); }, [workout]);

  const dirty = useMemo(() => isDirty(form, workout), [form, workout]);
  const totalSets = useMemo(
    () => form.exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
    [form.exercises],
  );

  const loggedDate = new Date(workout.loggedAt);
  const dateLabel = loggedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const updateExercise = (id: string, patch: Partial<EditableExercise>) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)),
    }));
  };

  const updateSet = (exId: string, idx: number, patch: Partial<EditableSet>) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((ex) =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)) },
      ),
    }));
  };

  const addSet = (exId: string) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, { weight: last?.weight ?? '0', reps: last?.reps ?? '0', rpe: '' }],
        };
      }),
    }));
  };

  const removeSet = (exId: string, idx: number) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((ex) =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== idx) },
      ),
    }));
  };

  const addExercise = () => {
    setForm((f) => ({
      ...f,
      exercises: [
        ...f.exercises,
        { id: `ex-new-${Date.now()}`, name: 'New exercise', sets: [{ weight: '0', reps: '0', rpe: '' }], notes: '' },
      ],
    }));
  };

  const removeExercise = (exId: string) => {
    setForm((f) => ({ ...f, exercises: f.exercises.filter((ex) => ex.id !== exId) }));
  };

  const discard = () => setForm(toForm(workout));

  const handleSave = async () => {
    if (!canEdit || !dirty) return;
    setSaving(true);
    setErr(null);
    try {
      const exercises = form.exercises
        .map((ex, i) => ({
          id: ex.id || `ex-${i}`,
          name: ex.name.trim() || `Exercise ${i + 1}`,
          notes: ex.notes.trim() || undefined,
          sets: ex.sets
            .map((s) => ({
              reps: numOrZero(s.reps),
              weight: numOrZero(s.weight),
              ...(s.rpe.trim() ? { rpe: numOrZero(s.rpe) } : {}),
            }))
            .filter((s) => s.reps > 0),
        }))
        .filter((ex) => ex.sets.length > 0);

      if (exercises.length === 0) {
        setErr('At least one set with reps is required.');
        setSaving(false);
        return;
      }

      await updateWorkout(groupId, workout.id, {
        title: form.title.trim() || 'Workout',
        tag: form.tag,
        durationMin: numOrNull(form.durationMin),
        exercises,
      });

      const updated: WorkoutDetailRecord = {
        ...workout,
        title: form.title.trim() || 'Workout',
        tag: form.tag,
        durationMin: numOrNull(form.durationMin),
        totalSets: exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
        exercises,
        edited: true,
      };
      onSaved(updated);
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt((v) => (v && Date.now() - v >= 1500 ? null : v)), 1700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Eyebrow>WORKOUT · {dateLabel.toUpperCase()} · {formatTime(workout.loggedAt).toUpperCase()}</Eyebrow>
        <h1 style={{ ...display, fontSize: 'clamp(24px, 6vw, 28px)', fontWeight: 700, marginTop: 6, marginBottom: 0 }}>
          {form.title || 'Workout'}
        </h1>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <Eyebrow>SESSION</Eyebrow>
          {workout.edited && <Chip color="ghost">EDITED</Chip>}
        </div>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          disabled={!canEdit}
          placeholder="Workout title"
          style={{ ...titleInput, marginTop: 8 }}
        />
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TAGS.map((t) => {
            const active = t === form.tag;
            return (
              <button
                key={t}
                type="button"
                disabled={!canEdit}
                onClick={() => setForm({ ...form, tag: t })}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: active ? '1px solid var(--lime)' : '1px solid rgba(255,255,255,0.1)',
                  background: active ? 'rgba(218,255,63,0.12)' : 'transparent',
                  color: active ? 'var(--lime)' : 'var(--text-on-dark-mute)',
                  fontFamily: 'var(--f-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: canEdit ? 'pointer' : 'default',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={mono10}>DURATION</span>
          <input
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: e.target.value.replace(/\D/g, '') })}
            disabled={!canEdit}
            placeholder="—"
            inputMode="numeric"
            style={{ ...inputStyle, width: 70 }}
          />
          <span style={mono10}>MIN</span>
          <span style={{ ...mono10, marginLeft: 'auto' }}>{totalSets} TOTAL SETS</span>
        </div>

        {workout.caloriesBurnedLow != null && workout.caloriesBurnedHigh != null && workout.caloriesBurnedHigh > 0 && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={mono10}>EST. BURN</span>
            <span style={{ ...mono10, color: 'var(--text-on-dark)' }}>
              {Math.round(workout.caloriesBurnedLow).toLocaleString()}–
              {Math.round(workout.caloriesBurnedHigh).toLocaleString()} KCAL
            </span>
            <span style={{ ...mono10, color: 'var(--text-on-dark-faint)', flexBasis: '100%' }}>
              ESTIMATE — INDIVIDUAL BURN VARIES ±30%
            </span>
          </div>
        )}
      </Card>

      {form.exercises.map((ex) => (
        <Card key={ex.id} style={{ padding: 0 }}>
          <div style={exerciseHeader}>
            <input
              value={ex.name}
              onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
              disabled={!canEdit}
              style={exerciseTitleInput}
            />
            {canEdit && (
              <button type="button" onClick={() => removeExercise(ex.id)} aria-label="Remove exercise" style={iconBtn}>
                <Icon name="x" size={14} color="var(--text-on-dark-faint)" />
              </button>
            )}
          </div>

          <div style={{ padding: '4px 18px 16px' }}>
            {ex.sets.map((s, i) => (
              <div key={i} style={rowStyle}>
                <span style={rowIndex}>{i + 1}.</span>
                <input
                  value={s.weight}
                  inputMode="decimal"
                  disabled={!canEdit}
                  onChange={(e) => updateSet(ex.id, i, { weight: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="lb"
                  style={inputStyle}
                />
                <span style={rowSep}>×</span>
                <input
                  value={s.reps}
                  inputMode="numeric"
                  disabled={!canEdit}
                  onChange={(e) => updateSet(ex.id, i, { reps: e.target.value.replace(/\D/g, '') })}
                  placeholder="reps"
                  style={inputStyle}
                />
                <input
                  value={s.rpe}
                  inputMode="decimal"
                  disabled={!canEdit}
                  onChange={(e) => updateSet(ex.id, i, { rpe: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="rpe"
                  style={{ ...inputStyle, width: 56, marginLeft: 'auto' }}
                />
                {canEdit && ex.sets.length > 1 && (
                  <button type="button" onClick={() => removeSet(ex.id, i)} aria-label="Remove set" style={removeBtn}>
                    <Icon name="x" size={12} color="var(--text-on-dark-faint)" />
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button type="button" onClick={() => addSet(ex.id)} style={addSetBtn}>
                <Icon name="plus" size={12} color="var(--text-on-dark-mute)" strokeWidth={2.5} />
                Add set
              </button>
            )}

            <input
              value={ex.notes}
              onChange={(e) => updateExercise(ex.id, { notes: e.target.value })}
              disabled={!canEdit}
              placeholder={canEdit ? 'Notes (optional)' : ''}
              style={{ ...inputStyle, width: '100%', marginTop: 10, textAlign: 'left' }}
            />
          </div>
        </Card>
      ))}

      {canEdit && (
        <button type="button" onClick={addExercise} style={addExerciseBtn}>
          <Icon name="plus" size={14} color="var(--lime)" strokeWidth={2.5} />
          Add exercise
        </button>
      )}

      {err && (
        <Card style={{ borderColor: 'rgba(255,107,74,0.3)', background: 'rgba(255,107,74,0.08)' }}>
          <Eyebrow color="var(--coral)">ERROR</Eyebrow>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{err}</p>
        </Card>
      )}

      {savedAt && (
        <Card style={{ background: 'rgba(218,255,63,0.1)', borderColor: 'rgba(218,255,63,0.3)' }}>
          <p style={{ fontSize: 13, margin: 0, color: 'var(--lime)' }}>Saved.</p>
        </Card>
      )}

      {canEdit && dirty && (
        <div style={stickyFooter}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="btn btn-ghost-dark"
              style={{ padding: '12px 14px', fontSize: 13, opacity: saving ? 0.5 : 1 }}
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-lime"
              style={{ flex: 1, padding: '12px 18px', fontSize: 14, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save changes'}
              <Icon name="check" size={14} color="#0a0a0a" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {!dirty && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/workout" className="btn btn-lime" style={{ padding: '12px 16px', fontSize: 13, display: 'inline-flex' }}>
            Log another
            <Icon name="plus" size={14} color="#0a0a0a" strokeWidth={2.5} />
          </Link>
          <Link href="/workouts" className="btn btn-ghost-dark" style={{ padding: '12px 16px', fontSize: 13, display: 'inline-flex' }}>
            All workouts
          </Link>
        </div>
      )}
    </div>
  );
}

function numOrZero(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};

const titleInput: CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--text-on-dark)',
  fontFamily: 'var(--f-display)',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  padding: '4px 0',
  outline: 'none',
};

const exerciseHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  gap: 8,
};

const exerciseTitleInput: CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  color: 'var(--text-on-dark)',
  fontFamily: 'var(--f-display)',
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  padding: 0,
  outline: 'none',
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

const iconBtn: CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 8,
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

const addExerciseBtn: CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  border: '1px dashed rgba(218,255,63,0.3)',
  background: 'rgba(218,255,63,0.04)',
  color: 'var(--lime)',
  borderRadius: 12,
  fontFamily: 'var(--f-ui)',
  fontWeight: 600,
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
};

const stickyFooter: CSSProperties = {
  position: 'sticky',
  bottom: 12,
  background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 30%, rgba(10,10,10,1) 100%)',
  paddingTop: 8,
  paddingBottom: 8,
  zIndex: 5,
};

const mono10: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 10,
  color: 'var(--text-on-dark-mute)',
  letterSpacing: '0.1em',
};
