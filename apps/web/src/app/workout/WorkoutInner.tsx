'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { getFirebase } from '@/lib/firebase';
import { saveWorkoutSession } from '@/lib/workouts';
import { loadBodyProfile } from '@/lib/nutrition-goals';
import { useSpeechRecognition } from '@/lib/speech-recognition';
import { compressImageForUpload } from '@/lib/image-compress';
import type { ExerciseTag, WorkoutParseExercise, WorkoutParseResult } from '@pact/types';

type Mode = 'photo' | 'describe' | 'manual';
const MODE_LABEL: Record<Mode, string> = {
  photo: 'Photo',
  describe: 'Describe',
  manual: 'Manual',
};
const MODE_ICON: Record<Mode, 'camera' | 'chat' | 'dumbbell'> = {
  photo: 'camera',
  describe: 'chat',
  manual: 'dumbbell',
};

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const TAGS: ExerciseTag[] = ['push', 'pull', 'legs', 'cardio', 'rest', 'crew'];

export function WorkoutInner() {
  const [mode, setMode] = useState<Mode>('describe');

  return (
    <div style={shellOuter}>
      <div style={shellInner}>
        <header style={headerStyle}>
          <Link href="/dashboard" style={backLink}>
            ← BACK
          </Link>
          <Eyebrow>LOG A WORKOUT</Eyebrow>
        </header>

        <ModeToggle mode={mode} onChange={setMode} />

        {mode === 'photo' && <PhotoMode />}
        {mode === 'describe' && <DescribeMode />}
        {mode === 'manual' && <ManualMode />}
      </div>
    </div>
  );
}

/* ── Mode toggle ─────────────────────────────────────────────────────── */

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="tablist" style={toggleWrap}>
      {(Object.keys(MODE_LABEL) as Mode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(m)}
            style={{
              ...toggleBtn,
              background: active ? 'var(--lime)' : 'transparent',
              color: active ? '#0a0a0a' : 'var(--text-on-dark)',
            }}
          >
            <Icon name={MODE_ICON[m]} size={14} color={active ? '#0a0a0a' : 'var(--text-on-dark-mute)'} />
            {MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}

/* ── Photo mode ──────────────────────────────────────────────────────── */

type CaptureState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'parsing' }
  | { status: 'parsed'; result: WorkoutParseResult; preview?: string }
  | { status: 'error'; message: string };

function PhotoMode() {
  const { user } = useAuth();
  const [state, setState] = useState<CaptureState>({ status: 'idle' });

  const handleFile = async (file: File) => {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setState({ status: 'error', message: `Unsupported file type: ${file.type}` });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setState({ status: 'error', message: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 30 MB.` });
      return;
    }
    setState({ status: 'reading' });
    const preview = URL.createObjectURL(file);
    let compressed;
    try {
      compressed = await compressImageForUpload(file);
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not read image' });
      return;
    }

    setState({ status: 'parsing' });
    try {
      const { auth } = getFirebase();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const body = await loadBodyProfile(user!.uid).catch(() => null);
      const res = await fetch('/api/vision/workout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          imageMediaType: compressed.mediaType,
          bodyWeightLb: body?.weightLb,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      const result = (await res.json()) as WorkoutParseResult;
      setState({ status: 'parsed', result, preview });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Parse failed' });
    }
  };

  if (!user) return <SignInPrompt />;

  if (state.status === 'parsed') {
    return (
      <WorkoutReview
        result={state.result}
        preview={state.preview}
        onCancel={() => setState({ status: 'idle' })}
      />
    );
  }

  return (
    <>
      <FileDrop
        onFile={handleFile}
        disabled={state.status === 'reading' || state.status === 'parsing'}
        helper="Snap a whiteboard, plan, app screen, or your gym notes. We&rsquo;ll extract the sets."
      />
      {state.status === 'reading' && <Pulse label="Reading file…" />}
      {state.status === 'parsing' && <Pulse label="Asking Claude…" />}
      {state.status === 'error' && <ErrorBanner message={state.message} />}
    </>
  );
}

function FileDrop({
  onFile,
  disabled,
  helper,
}: {
  onFile: (f: File) => void;
  disabled: boolean;
  helper: string;
}) {
  return (
    <label
      style={{
        display: 'block',
        padding: 28,
        borderRadius: 16,
        border: '1.5px dashed rgba(255,255,255,0.18)',
        background: 'repeating-linear-gradient(135deg, rgba(218,255,63,0.03) 0 8px, transparent 8px 16px)',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="file"
        accept={ALLOWED_PHOTO_TYPES.join(',')}
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        style={{ display: 'none' }}
      />
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'rgba(218,255,63,0.1)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Icon name="camera" size={26} color="var(--lime)" />
      </div>
      <div style={dropTitle}>Drop a workout photo here</div>
      <div style={dropHelper}>{helper}</div>
    </label>
  );
}

/* ── Describe mode ───────────────────────────────────────────────────── */

function DescribeMode() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [state, setState] = useState<CaptureState>({ status: 'idle' });
  const speech = useSpeechRecognition({
    onAppend: (chunk) => setText((prev) => (prev ? `${prev.trim()} ${chunk}` : chunk)),
    onError: (err) => setState({ status: 'error', message: err }),
  });

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setState({ status: 'error', message: 'Tell us what you did first.' });
      return;
    }
    setState({ status: 'parsing' });
    try {
      const { auth } = getFirebase();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const body = await loadBodyProfile(user!.uid).catch(() => null);
      const res = await fetch('/api/text/workout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ description: trimmed, bodyWeightLb: body?.weightLb }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      const result = (await res.json()) as WorkoutParseResult;
      setState({ status: 'parsed', result });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Parse failed' });
    }
  };

  if (!user) return <SignInPrompt />;
  if (state.status === 'parsed') {
    return <WorkoutReview result={state.result} onCancel={() => { setState({ status: 'idle' }); setText(''); }} />;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Bench 3x8 at 185, then incline DB 4x10 at 60s, finished with cable flies."
            rows={6}
            disabled={state.status === 'parsing'}
            style={{
              width: '100%',
              padding: 16,
              paddingRight: speech.supported ? 56 : 16,
              borderRadius: 16,
              border: '1.5px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-on-dark)',
              fontFamily: 'var(--f-ui)',
              fontSize: 14,
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          {speech.supported && (
            <button
              type="button"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              aria-label={speech.listening ? 'Stop dictation' : 'Start dictation'}
              title={speech.listening ? 'Stop dictation' : 'Start dictation'}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 18,
                border: 'none',
                background: speech.listening ? 'var(--coral)' : 'rgba(218,255,63,0.12)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease, transform 0.15s ease',
                animation: speech.listening ? 'pact-mic-pulse 1s ease-in-out infinite' : undefined,
              }}
            >
              <MicIcon active={speech.listening} />
              <style>{`@keyframes pact-mic-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={mono10}>
            {speech.supported
              ? speech.listening
                ? 'LISTENING…'
                : 'TIP · TAP THE MIC TO DICTATE'
              : 'TIP · DICTATION NOT SUPPORTED IN THIS BROWSER'}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={state.status === 'parsing' || !text.trim()}
            className="btn btn-lime"
            style={{
              padding: '12px 18px',
              fontSize: 14,
              opacity: state.status === 'parsing' || !text.trim() ? 0.5 : 1,
            }}
          >
            {state.status === 'parsing' ? 'Asking Claude…' : 'Parse workout'}
            <Icon name="sparkle" size={13} color="#0a0a0a" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {state.status === 'parsing' && <Pulse label="Asking Claude…" />}
      {state.status === 'error' && <ErrorBanner message={state.message} />}
    </>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="7" y="2" width="6" height="10" rx="3" stroke={active ? '#fff' : 'var(--lime)'} strokeWidth="1.8" />
      <path d="M4 10v1a6 6 0 0012 0v-1M10 17v2" stroke={active ? '#fff' : 'var(--lime)'} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Parsed-workout review form ──────────────────────────────────────── */

type EditableSet = { weight: string; reps: string; rpe?: string };
type EditableExercise = { id: string; name: string; sets: EditableSet[]; notes: string };
type EditableWorkout = {
  title: string;
  tag: ExerciseTag;
  durationMin: string;
  exercises: EditableExercise[];
  parseNotes: string;
  caloriesBurnedLow: number | null;
  caloriesBurnedHigh: number | null;
};

function toEditable(r: WorkoutParseResult): EditableWorkout {
  return {
    title: r.title || 'Workout',
    tag: r.tag,
    durationMin: r.durationMin ? String(r.durationMin) : '',
    parseNotes: r.notes ?? '',
    caloriesBurnedLow: r.caloriesBurnedLow ?? null,
    caloriesBurnedHigh: r.caloriesBurnedHigh ?? null,
    exercises: r.exercises.map((e: WorkoutParseExercise, i) => ({
      id: `ex-${i}`,
      name: e.name,
      notes: e.notes ?? '',
      sets: e.sets.map((s) => ({
        weight: String(s.weight),
        reps: String(s.reps),
        rpe: s.rpe != null ? String(s.rpe) : undefined,
      })),
    })),
  };
}

function WorkoutReview({
  result,
  preview,
  onCancel,
}: {
  result: WorkoutParseResult;
  preview?: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [w, setW] = useState<EditableWorkout>(() => toEditable(result));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSets = useMemo(
    () => w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
    [w.exercises],
  );

  const updateExercise = (id: string, patch: Partial<EditableExercise>) => {
    setW((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)),
    }));
  };

  const updateSet = (exId: string, idx: number, patch: Partial<EditableSet>) => {
    setW((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)) },
      ),
    }));
  };

  const addSet = (exId: string) => {
    setW((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, { weight: last?.weight ?? '0', reps: last?.reps ?? '0' }],
        };
      }),
    }));
  };

  const removeSet = (exId: string, idx: number) => {
    setW((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== idx) },
      ),
    }));
  };

  const removeExercise = (exId: string) => {
    setW((prev) => ({ ...prev, exercises: prev.exercises.filter((ex) => ex.id !== exId) }));
  };

  const addExercise = () => {
    setW((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { id: `ex-new-${Date.now()}`, name: 'New exercise', sets: [{ weight: '0', reps: '0' }], notes: '' },
      ],
    }));
  };

  const handleSave = async () => {
    if (!user) {
      setError('Not signed in');
      return;
    }
    if (!profile?.currentGroupId) {
      setError('You need to be in a pact to save a workout.');
      return;
    }

    const exercises = w.exercises
      .map((ex, i) => ({
        id: ex.id || `ex-${i}`,
        name: ex.name.trim() || `Exercise ${i + 1}`,
        sets: ex.sets
          .map((s) => ({
            weight: parseFloat(s.weight) || 0,
            reps: parseInt(s.reps, 10) || 0,
            ...(s.rpe ? { rpe: parseFloat(s.rpe) } : {}),
          }))
          .filter((s) => s.reps > 0),
      }))
      .filter((ex) => ex.sets.length > 0);

    if (exercises.length === 0) {
      setError('Add at least one set with reps before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveWorkoutSession({
        uid: user.uid,
        groupId: profile.currentGroupId,
        title: w.title.trim() || 'Workout',
        tag: w.tag,
        durationMin: w.durationMin ? Math.max(1, parseInt(w.durationMin, 10)) : undefined,
        exercises,
        caloriesBurnedLow: w.caloriesBurnedLow ?? undefined,
        caloriesBurnedHigh: w.caloriesBurnedHigh ?? undefined,
      });
      router.replace('/dashboard');
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Could not save workout');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {preview && (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="workout source" style={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'cover' }} />
        </div>
      )}

      <Card>
        <Eyebrow>SESSION</Eyebrow>
        <input
          value={w.title}
          onChange={(e) => setW({ ...w, title: e.target.value })}
          placeholder="Workout title"
          style={{ ...titleInput, marginTop: 6 }}
        />
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TAGS.map((t) => {
            const active = t === w.tag;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setW({ ...w, tag: t })}
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
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={mono10}>DURATION</span>
          <input
            value={w.durationMin}
            onChange={(e) => setW({ ...w, durationMin: e.target.value.replace(/\D/g, '') })}
            placeholder="—"
            inputMode="numeric"
            style={{ ...inputStyle, width: 70 }}
          />
          <span style={mono10}>MIN</span>
          <span style={{ ...mono10, marginLeft: 'auto' }}>{totalSets} TOTAL SETS</span>
        </div>

        {w.caloriesBurnedLow != null && w.caloriesBurnedHigh != null && w.caloriesBurnedHigh > 0 && (
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
              {Math.round(w.caloriesBurnedLow).toLocaleString()}–
              {Math.round(w.caloriesBurnedHigh).toLocaleString()} KCAL
            </span>
            <span style={{ ...mono10, color: 'var(--text-on-dark-faint)', flexBasis: '100%' }}>
              RANGE — LIFT-BURN ESTIMATES VARY ±30%
            </span>
          </div>
        )}
      </Card>

      {w.parseNotes && (
        <Card style={{ background: 'rgba(218,255,63,0.06)', borderColor: 'rgba(218,255,63,0.2)' }}>
          <Eyebrow color="var(--lime)">PARSE NOTES</Eyebrow>
          <p style={{ fontSize: 12, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{w.parseNotes}</p>
        </Card>
      )}

      {w.exercises.length === 0 && (
        <Card>
          <p style={{ fontSize: 13, margin: 0, color: 'var(--text-on-dark-mute)' }}>
            No exercises parsed. Add one manually or try again.
          </p>
        </Card>
      )}

      {w.exercises.map((ex) => (
        <Card key={ex.id} style={{ padding: 0 }}>
          <div style={exerciseHeader}>
            <input
              value={ex.name}
              onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
              style={{ ...exerciseTitleInput, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => removeExercise(ex.id)}
              aria-label="Remove exercise"
              style={iconBtn}
            >
              <Icon name="x" size={14} color="var(--text-on-dark-faint)" />
            </button>
          </div>

          <div style={{ padding: '4px 18px 16px' }}>
            {ex.sets.map((s, i) => (
              <div key={i} style={rowStyle}>
                <span style={rowIndex}>{i + 1}.</span>
                <input
                  value={s.weight}
                  inputMode="decimal"
                  onChange={(e) => updateSet(ex.id, i, { weight: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="lb"
                  style={inputStyle}
                  aria-label={`Set ${i + 1} weight`}
                />
                <span style={rowSep}>×</span>
                <input
                  value={s.reps}
                  inputMode="numeric"
                  onChange={(e) => updateSet(ex.id, i, { reps: e.target.value.replace(/\D/g, '') })}
                  placeholder="reps"
                  style={inputStyle}
                  aria-label={`Set ${i + 1} reps`}
                />
                <input
                  value={s.rpe ?? ''}
                  onChange={(e) => updateSet(ex.id, i, { rpe: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="rpe"
                  style={{ ...inputStyle, width: 56, marginLeft: 'auto' }}
                  aria-label={`Set ${i + 1} RPE`}
                />
                {ex.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(ex.id, i)}
                    aria-label="Remove set"
                    style={removeBtn}
                  >
                    <Icon name="x" size={12} color="var(--text-on-dark-faint)" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addSet(ex.id)} style={addSetBtn}>
              <Icon name="plus" size={12} color="var(--text-on-dark-mute)" strokeWidth={2.5} />
              Add set
            </button>

            <input
              value={ex.notes}
              onChange={(e) => updateExercise(ex.id, { notes: e.target.value })}
              placeholder="Notes (optional)"
              style={{ ...inputStyle, width: '100%', marginTop: 10, textAlign: 'left' }}
            />
          </div>
        </Card>
      ))}

      <button type="button" onClick={addExercise} style={addExerciseBtn}>
        <Icon name="plus" size={14} color="var(--lime)" strokeWidth={2.5} />
        Add exercise
      </button>

      {error && (
        <div style={errorBox}>
          <Eyebrow color="var(--coral)">ERROR</Eyebrow>
          <p style={{ fontSize: 13, color: 'var(--coral)', margin: '6px 0 0' }}>{error}</p>
        </div>
      )}

      <div style={footerStyle}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="btn btn-ghost-dark"
            style={{ padding: '14px 16px', fontSize: 14, opacity: saving ? 0.5 : 1 }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-lime"
            style={{ flex: 1, padding: '14px 18px', fontSize: 15, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : `Save workout · ${totalSets} sets`}
            <Icon name="check" size={15} color="#0a0a0a" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Manual mode (existing plan-based logger, untouched logic) ───────── */

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
  { id: 'incline-db', name: 'Incline DB', plannedSets: 4, plannedReps: 8, plannedWeight: 55 },
  { id: 'cable-fly', name: 'Cable Fly', plannedSets: 3, plannedReps: 12, plannedWeight: 30 },
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

function ManualMode() {
  const router = useRouter();
  const { user, profile, loading: authLoading, configured } = useAuth();
  const [logs, setLogs] = useState<ExerciseLog[]>(() => initialLogs());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const startedAt = useMemo(() => Date.now(), []);

  const updateSet = useCallback(
    (exId: string, setIdx: number, field: 'weight' | 'reps', value: string) => {
      setLogs((prev) =>
        prev.map((ex) =>
          ex.id !== exId
            ? ex
            : { ...ex, sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)) },
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
          : { ...ex, sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, done: !s.done } : s)) },
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
      prev.map((ex) => (ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) })),
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
      setError('You need to be in a pact to log a workout.');
      return;
    }

    const exercisesPayload = logs
      .map((ex) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets
          .filter((s) => s.done)
          .map((s) => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps, 10) || 0 }))
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
    <>
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
            <Link href={`/auth?next=${encodeURIComponent('/workout')}`} style={{ color: 'var(--lime)' }}>
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
    </>
  );
}

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

/* ── Shared bits ─────────────────────────────────────────────────────── */

function SignInPrompt() {
  return (
    <Card>
      <p style={{ fontSize: 13, margin: 0 }}>
        You need to{' '}
        <Link href={`/auth?next=${encodeURIComponent('/workout')}`} style={{ color: 'var(--lime)' }}>
          sign in
        </Link>{' '}
        to log a workout.
      </p>
    </Card>
  );
}

function Pulse({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: 'var(--lime)',
              opacity: 0.6,
              animation: `pact-pulse 1s ${i * 0.18}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 16, fontWeight: 600 }}>{label}</div>
      <style>{`@keyframes pact-pulse { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <Card style={{ borderColor: 'rgba(255,107,74,0.3)', background: 'rgba(255,107,74,0.08)' }}>
      <Eyebrow color="var(--coral)">ERROR</Eyebrow>
      <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{message}</p>
    </Card>
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

const toggleWrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const toggleBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 8,
  border: 'none',
  fontFamily: 'var(--f-ui)',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease',
};

const titleBlock: CSSProperties = { marginTop: 4 };

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

const exerciseTitle: CSSProperties = {
  fontFamily: 'var(--f-display)',
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  marginTop: 4,
};

const exerciseTitleInput: CSSProperties = {
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

const tickOn: CSSProperties = { ...tickBase, background: 'var(--lime)', borderColor: 'var(--lime)' };
const tickOff: CSSProperties = { ...tickBase, background: 'transparent', borderColor: 'rgba(255,255,255,0.25)' };

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

const dropTitle: CSSProperties = {
  fontFamily: 'var(--f-display)',
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '-0.02em',
};

const dropHelper: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-on-dark-mute)',
  marginTop: 4,
  lineHeight: 1.5,
};

const mono10: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 10,
  color: 'var(--text-on-dark-mute)',
  letterSpacing: '0.1em',
};

