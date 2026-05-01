'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand, Card, Chip, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { getFirebase } from '@/lib/firebase';
import {
  ACTIVITY_LEVELS,
  loadBodyProfile,
  loadNutritionGoals,
  saveBodyProfile,
  saveNutritionGoals,
  type ActivityLevel,
  type BodyProfile,
  type GoalDirection,
  type NutritionGoals,
  type Range,
  type Sex,
} from '@/lib/nutrition-goals';

const CURRENT_YEAR = new Date().getFullYear();

type SuggestionResponse = {
  rationale: string;
  caloriesDaily: Range;
  proteinG: Range;
  carbsG: Range;
  fatG: Range;
};

type SuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; suggestion: SuggestionResponse }
  | { status: 'error'; message: string };

export function SettingsInner() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [body, setBody] = useState<BodyProfileForm>(emptyBody);
  const [bodyLoaded, setBodyLoaded] = useState(false);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [editable, setEditable] = useState<EditableTargets | null>(null);
  const [suggest, setSuggest] = useState<SuggestState>({ status: 'idle' });
  const [savingBody, setSavingBody] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Load existing body + goals.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/settings')}`);
      return;
    }
    let cancelled = false;
    (async () => {
      const [bodyDoc, goalsDoc] = await Promise.all([
        loadBodyProfile(user.uid),
        loadNutritionGoals(user.uid),
      ]);
      if (cancelled) return;
      if (bodyDoc) setBody(toForm(bodyDoc));
      setBodyLoaded(true);
      if (goalsDoc) {
        setGoals(goalsDoc);
        setEditable({
          calTarget: goalsDoc.caloriesDaily.target,
          proteinTarget: goalsDoc.proteinG.target,
          carbsTarget: goalsDoc.carbsG.target,
          fatTarget: goalsDoc.fatG.target,
        });
      }
    })().catch(() => {
      if (!cancelled) setBodyLoaded(true);
    });
    return () => { cancelled = true; };
  }, [authLoading, user, router]);

  const bodyValid = useMemo(() => isBodyValid(body), [body]);

  const handleSaveBody = async () => {
    if (!user || !bodyValid) return;
    setSavingBody(true);
    try {
      await saveBodyProfile(user.uid, fromForm(body));
      setSavedBanner('Body profile saved.');
      window.setTimeout(() => setSavedBanner(null), 1800);
    } catch (e) {
      setSavedBanner(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSavingBody(false);
    }
  };

  const handleSuggest = async () => {
    if (!user || !bodyValid) return;
    setSuggest({ status: 'loading' });
    try {
      // Save the body profile first so we always have a fresh snapshot of
      // what informed the suggestion.
      await saveBodyProfile(user.uid, fromForm(body));

      const { auth } = getFirebase();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const res = await fetch('/api/text/nutrition-goals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          sex: body.sex,
          age: ageFromBirthYear(body.birthYear),
          heightIn: heightToInches(body.heightFt, body.heightInches),
          weightLb: Number(body.weightLb),
          activityLevel: body.activityLevel,
          goalDirection: body.goalDirection,
          goalLbPerWeek: body.goalDirection === 'maintain' ? 0 : Number(body.goalLbPerWeek),
          notes: body.notes,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const suggestion = (await res.json()) as SuggestionResponse;
      setSuggest({ status: 'ready', suggestion });
      setEditable({
        calTarget: Math.round(suggestion.caloriesDaily.target),
        proteinTarget: Math.round(suggestion.proteinG.target),
        carbsTarget: Math.round(suggestion.carbsG.target),
        fatTarget: Math.round(suggestion.fatG.target),
      });
    } catch (e) {
      setSuggest({ status: 'error', message: e instanceof Error ? e.message : 'Request failed' });
    }
  };

  const handleSaveGoals = async () => {
    if (!user || !editable) return;
    const source: SuggestionResponse | NutritionGoals | null =
      suggest.status === 'ready' ? suggest.suggestion : goals;
    if (!source) return;
    setSavingGoals(true);
    try {
      const next: Omit<NutritionGoals, 'updatedAt'> = {
        rationale:
          suggest.status === 'ready' ? suggest.suggestion.rationale : (goals?.rationale ?? ''),
        aiSuggested: suggest.status === 'ready' ? true : (goals?.aiSuggested ?? false),
        caloriesDaily: withTarget(source.caloriesDaily, editable.calTarget),
        proteinG: withTarget(source.proteinG, editable.proteinTarget),
        carbsG: withTarget(source.carbsG, editable.carbsTarget),
        fatG: withTarget(source.fatG, editable.fatTarget),
      };
      await saveNutritionGoals(user.uid, next);
      setGoals({ ...next, updatedAt: Date.now() });
      setSavedBanner('Goals saved.');
      window.setTimeout(() => setSavedBanner(null), 1800);
    } catch (e) {
      setSavedBanner(e instanceof Error ? e.message : 'Could not save goals');
    } finally {
      setSavingGoals(false);
    }
  };

  const activeSuggestion: SuggestionResponse | NutritionGoals | null =
    suggest.status === 'ready' ? suggest.suggestion : goals;

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text-on-dark)', padding: '32px 24px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/dashboard" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
            ← DASHBOARD
          </Link>
        </header>

        <div>
          <Eyebrow>SETTINGS</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            Goals & body profile
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Private to you — your crew never sees this. Used to suggest sustainable calorie + macro targets.
          </p>
        </div>

        {savedBanner && (
          <Card style={{ background: 'rgba(218,255,63,0.1)', borderColor: 'rgba(218,255,63,0.3)' }}>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--lime)' }}>{savedBanner}</p>
          </Card>
        )}

        {/* ── Body profile ─────────────────────────────────────────── */}
        <Card>
          <Eyebrow>BODY · ACTIVITY</Eyebrow>
          <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
            We use this to estimate maintenance calories and a sustainable target band.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Sex">
              <Segmented
                value={body.sex}
                onChange={(v) => setBody({ ...body, sex: v as Sex })}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Birth year">
                <NumInput
                  value={body.birthYear}
                  onChange={(v) => setBody({ ...body, birthYear: v })}
                  placeholder={String(CURRENT_YEAR - 30)}
                  min={CURRENT_YEAR - 100}
                  max={CURRENT_YEAR - 13}
                />
              </Field>
              <Field label="Weight (lb)">
                <NumInput
                  value={body.weightLb}
                  onChange={(v) => setBody({ ...body, weightLb: v })}
                  placeholder="160"
                  min="60"
                  max="600"
                  step="0.1"
                />
              </Field>
            </div>

            <Field label="Height">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <NumInput
                  value={body.heightFt}
                  onChange={(v) => setBody({ ...body, heightFt: v })}
                  placeholder="5"
                  min="3"
                  max="8"
                  suffix="ft"
                />
                <NumInput
                  value={body.heightInches}
                  onChange={(v) => setBody({ ...body, heightInches: v })}
                  placeholder="10"
                  min="0"
                  max="11"
                  suffix="in"
                />
              </div>
            </Field>

            <Field label="Activity level">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ACTIVITY_LEVELS.map((opt) => {
                  const active = body.activityLevel === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBody({ ...body, activityLevel: opt.value })}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: active ? 'rgba(218,255,63,0.1)' : 'rgba(255,255,255,0.03)',
                        border: active
                          ? '1px solid rgba(218,255,63,0.3)'
                          : '1px solid rgba(255,255,255,0.06)',
                        color: 'var(--text-on-dark)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</div>
                        <div style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)', marginTop: 2 }}>
                          {opt.sub}
                        </div>
                      </div>
                      {active && <Icon name="check" size={14} color="var(--lime)" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Direction">
              <Segmented
                value={body.goalDirection}
                onChange={(v) => setBody({ ...body, goalDirection: v as GoalDirection })}
                options={[
                  { value: 'lose', label: 'Lose' },
                  { value: 'maintain', label: 'Maintain' },
                  { value: 'gain', label: 'Gain' },
                ]}
              />
            </Field>

            {body.goalDirection !== 'maintain' && (
              <Field label={`Pace (${body.goalDirection === 'lose' ? 'lb to lose' : 'lb to gain'} per week)`}>
                <Segmented
                  value={body.goalLbPerWeek}
                  onChange={(v) => setBody({ ...body, goalLbPerWeek: v })}
                  options={[
                    { value: '0.5', label: '0.5 lb' },
                    { value: '1',   label: '1 lb' },
                    { value: '1.5', label: '1.5 lb' },
                    { value: '2',   label: '2 lb' },
                  ]}
                />
              </Field>
            )}

            <Field label="Anything else? (preferences, restrictions, training context)">
              <textarea
                value={body.notes}
                onChange={(e) => setBody({ ...body, notes: e.target.value })}
                placeholder="e.g. I'm lifting 4×/week and want more protein. Vegetarian, dairy-free."
                rows={4}
                maxLength={1000}
                style={textareaStyle}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSaveBody}
              disabled={!bodyValid || savingBody}
              className="btn btn-ghost-dark"
              style={{ padding: '12px 16px', fontSize: 13, opacity: bodyValid && !savingBody ? 1 : 0.5 }}
            >
              {savingBody ? 'Saving…' : 'Save profile only'}
            </button>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={!bodyValid || suggest.status === 'loading'}
              className="btn btn-lime"
              style={{ padding: '12px 16px', fontSize: 13, opacity: bodyValid && suggest.status !== 'loading' ? 1 : 0.5 }}
            >
              {suggest.status === 'loading' ? 'Asking Claude…' : 'Suggest goals with AI'}
              <Icon name="sparkle" size={13} color="#0a0a0a" strokeWidth={2.5} />
            </button>
          </div>

          {!bodyValid && bodyLoaded && (
            <p style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)', marginTop: 10 }}>
              Fill in sex, birth year, height, weight, and activity to suggest goals.
            </p>
          )}
        </Card>

        {/* ── Goals ─────────────────────────────────────────────────── */}
        {(activeSuggestion || suggest.status === 'error') && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <Eyebrow>NUTRITION GOALS</Eyebrow>
              {goals?.aiSuggested && suggest.status !== 'ready' && <Chip color="ghost">AI · LAST SUGGESTED</Chip>}
              {suggest.status === 'ready' && <Chip color="lime">JUST SUGGESTED</Chip>}
            </div>

            {suggest.status === 'error' && (
              <p style={{ fontSize: 13, marginTop: 8, marginBottom: 0, color: 'var(--coral)' }}>
                {suggest.message}
              </p>
            )}

            {activeSuggestion && (
              <>
                <p style={{ fontSize: 13, marginTop: 8, marginBottom: 14, lineHeight: 1.5 }}>
                  {suggest.status === 'ready' ? suggest.suggestion.rationale : (goals?.rationale ?? '')}
                </p>

                {editable && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <TargetRow
                      label="Calories"
                      unit="kcal/day"
                      range={activeSuggestion.caloriesDaily}
                      value={editable.calTarget}
                      onChange={(v) => setEditable({ ...editable, calTarget: v })}
                      step={10}
                    />
                    <TargetRow
                      label="Protein"
                      unit="g/day"
                      range={activeSuggestion.proteinG}
                      value={editable.proteinTarget}
                      onChange={(v) => setEditable({ ...editable, proteinTarget: v })}
                      step={5}
                      accent="var(--lime)"
                    />
                    <TargetRow
                      label="Carbs"
                      unit="g/day"
                      range={activeSuggestion.carbsG}
                      value={editable.carbsTarget}
                      onChange={(v) => setEditable({ ...editable, carbsTarget: v })}
                      step={5}
                      accent="#7cd4ff"
                    />
                    <TargetRow
                      label="Fat"
                      unit="g/day"
                      range={activeSuggestion.fatG}
                      value={editable.fatTarget}
                      onChange={(v) => setEditable({ ...editable, fatTarget: v })}
                      step={5}
                      accent="#ff6b4a"
                    />
                  </div>
                )}

                <div style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    onClick={handleSaveGoals}
                    disabled={!editable || savingGoals}
                    className="btn btn-lime"
                    style={{ padding: '12px 16px', fontSize: 13, opacity: editable && !savingGoals ? 1 : 0.5 }}
                  >
                    {savingGoals ? 'Saving…' : 'Save these goals'}
                    <Icon name="check" size={13} color="#0a0a0a" strokeWidth={2.5} />
                  </button>
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

/* ── Field components ─────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}

function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: active ? 'var(--lime)' : 'transparent',
              color: active ? '#0a0a0a' : 'var(--text-on-dark)',
              fontFamily: 'var(--f-ui)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  suffix?: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        style={{
          width: '100%',
          padding: '12px 14px',
          paddingRight: suffix ? 44 : 14,
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--text-on-dark)',
          fontFamily: 'var(--f-mono)',
          fontSize: 14,
          outline: 'none',
        }}
      />
      {suffix && (
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            ...mono,
            fontSize: 11,
            color: 'var(--text-on-dark-mute)',
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

function TargetRow({
  label,
  unit,
  range,
  value,
  onChange,
  step,
  accent,
}: {
  label: string;
  unit: string;
  range: Range;
  value: number;
  onChange: (v: number) => void;
  step: number;
  accent?: string;
}) {
  const minSafe = Math.min(range.min, value);
  const maxSafe = Math.max(range.max, value);
  const pct = maxSafe > minSafe ? ((value - minSafe) / (maxSafe - minSafe)) * 100 : 50;
  const tickPct = (target: number) =>
    maxSafe > minSafe ? ((target - minSafe) / (maxSafe - minSafe)) * 100 : 50;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
          {label.toUpperCase()}
        </span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          step={step}
          style={{
            width: 90,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
            color: accent ?? 'var(--text-on-dark)',
            fontFamily: 'var(--f-display)',
            fontWeight: 700,
            fontSize: 18,
            textAlign: 'right',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ position: 'relative', marginTop: 10, height: 18 }}>
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 0,
            right: 0,
            height: 2,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: `${tickPct(range.min)}%`,
            width: 2,
            height: 6,
            background: 'rgba(255,255,255,0.4)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: `${tickPct(range.max)}%`,
            width: 2,
            height: 6,
            background: 'rgba(255,255,255,0.4)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: `calc(${pct}% - 5px)`,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: accent ?? 'var(--lime)',
            boxShadow: '0 0 0 2px var(--ink-card)',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)' }}>
          MIN {range.min} {unit.split('/')[0]}
        </span>
        <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)' }}>
          MAX {range.max} {unit.split('/')[0]}
        </span>
      </div>
    </div>
  );
}

/* ── Form helpers ─────────────────────────────────────────────────────── */

type EditableTargets = {
  calTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
};

type BodyProfileForm = {
  sex: Sex;
  birthYear: string;
  heightFt: string;
  heightInches: string;
  weightLb: string;
  activityLevel: ActivityLevel;
  goalDirection: GoalDirection;
  goalLbPerWeek: string;
  notes: string;
};

const emptyBody: BodyProfileForm = {
  sex: 'other',
  birthYear: '',
  heightFt: '',
  heightInches: '',
  weightLb: '',
  activityLevel: 'moderate',
  goalDirection: 'maintain',
  goalLbPerWeek: '1',
  notes: '',
};

function toForm(p: BodyProfile): BodyProfileForm {
  const ft = Math.floor(p.heightIn / 12);
  const inches = p.heightIn - ft * 12;
  return {
    sex: p.sex,
    birthYear: String(p.birthYear),
    heightFt: String(ft),
    heightInches: String(inches),
    weightLb: String(p.weightLb),
    activityLevel: p.activityLevel,
    goalDirection: p.goalDirection,
    goalLbPerWeek: String(p.goalLbPerWeek),
    notes: p.notes,
  };
}

function fromForm(f: BodyProfileForm): Omit<BodyProfile, 'updatedAt'> {
  return {
    sex: f.sex,
    birthYear: Number(f.birthYear),
    heightIn: heightToInches(f.heightFt, f.heightInches),
    weightLb: Number(f.weightLb),
    activityLevel: f.activityLevel,
    goalDirection: f.goalDirection,
    goalLbPerWeek: f.goalDirection === 'maintain' ? 0 : Number(f.goalLbPerWeek),
    notes: f.notes,
  };
}

function isBodyValid(f: BodyProfileForm): boolean {
  const year = Number(f.birthYear);
  const heightIn = heightToInches(f.heightFt, f.heightInches);
  const weight = Number(f.weightLb);
  if (!year || year < CURRENT_YEAR - 100 || year > CURRENT_YEAR - 13) return false;
  if (!heightIn || heightIn < 36 || heightIn > 96) return false;
  if (!weight || weight < 60 || weight > 600) return false;
  return true;
}

function heightToInches(ft: string, inches: string): number {
  const f = Number(ft) || 0;
  const i = Number(inches) || 0;
  return f * 12 + i;
}

function ageFromBirthYear(year: string): number {
  const y = Number(year);
  if (!y) return 0;
  return CURRENT_YEAR - y;
}

function withTarget(range: Range, target: number): Range {
  return {
    min: range.min,
    max: range.max,
    target,
  };
}

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-on-dark)',
  fontFamily: 'var(--f-ui)',
  fontSize: 13,
  lineHeight: 1.5,
  resize: 'vertical',
  outline: 'none',
};

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};
