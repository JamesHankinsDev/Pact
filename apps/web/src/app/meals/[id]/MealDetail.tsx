'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand, Card, Chip, Eyebrow, Icon, StatNumeral } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { formatTime, loadMeal, updateMeal, type MealDetailRecord } from '@/lib/meals';
import type { MealParseItem } from '@pact/types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; meal: MealDetailRecord }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export function MealDetail({ mealId }: { mealId: string }) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent(`/meals/${mealId}`)}`);
      return;
    }
    if (!profile?.currentGroupId) return;
    let cancelled = false;
    loadMeal(profile.currentGroupId, mealId)
      .then((meal) => {
        if (cancelled) return;
        if (!meal) setState({ status: 'missing' });
        else setState({ status: 'ready', meal });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load meal' });
      });
    return () => { cancelled = true; };
  }, [authLoading, user, profile, mealId, router]);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text-on-dark)', padding: '32px 24px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/meals" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
            ← MEAL LOG
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
              That meal doesn&rsquo;t exist or has been removed.
            </p>
            <Link href="/meals" className="btn btn-ghost-dark" style={{ padding: '10px 14px', fontSize: 13, display: 'inline-flex' }}>
              Back to meal log
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
          <EditableDetail
            meal={state.meal}
            canEdit={state.meal.memberId === user.uid}
            groupId={profile.currentGroupId}
            onSaved={(updated) => setState({ status: 'ready', meal: updated })}
          />
        )}
      </div>
    </main>
  );
}

/* ── Editable form ───────────────────────────────────────────────────── */

type EditableItem = {
  name: string;
  portion: string;
  grams: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

type Form = {
  description: string;
  notes: string;
  items: EditableItem[];
};

function toForm(meal: MealDetailRecord): Form {
  return {
    description: meal.description ?? '',
    notes: meal.notes ?? '',
    items: meal.items.map((it) => ({
      name: it.name,
      portion: it.portion ?? '',
      grams: it.grams != null ? String(it.grams) : '',
      calories: String(it.calories),
      proteinG: String(it.proteinG),
      carbsG: String(it.carbsG),
      fatG: String(it.fatG),
    })),
  };
}

function fromForm(f: Form): { items: MealParseItem[] } {
  const items = f.items
    .filter((it) => it.name.trim() !== '' || numOrZero(it.calories) > 0)
    .map((it) => {
      const item: MealParseItem = {
        name: it.name.trim() || 'Item',
        calories: numOrZero(it.calories),
        proteinG: numOrZero(it.proteinG),
        carbsG: numOrZero(it.carbsG),
        fatG: numOrZero(it.fatG),
      };
      if (it.portion.trim()) item.portion = it.portion.trim();
      const g = numOrZero(it.grams);
      if (g > 0) item.grams = g;
      return item;
    });
  return { items };
}

function totalsFromItems(items: MealParseItem[]) {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + (it.calories || 0),
      proteinG: acc.proteinG + (it.proteinG || 0),
      carbsG: acc.carbsG + (it.carbsG || 0),
      fatG: acc.fatG + (it.fatG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function isDirty(form: Form, original: MealDetailRecord): boolean {
  if ((form.description || '') !== (original.description ?? '')) return true;
  if ((form.notes || '') !== (original.notes ?? '')) return true;
  if (form.items.length !== original.items.length) return true;
  for (let i = 0; i < form.items.length; i++) {
    const a = form.items[i]!;
    const b = original.items[i]!;
    if (a.name !== b.name) return true;
    if (a.portion !== (b.portion ?? '')) return true;
    if (a.grams !== (b.grams != null ? String(b.grams) : '')) return true;
    if (numOrZero(a.calories) !== b.calories) return true;
    if (numOrZero(a.proteinG) !== b.proteinG) return true;
    if (numOrZero(a.carbsG) !== b.carbsG) return true;
    if (numOrZero(a.fatG) !== b.fatG) return true;
  }
  return false;
}

function EditableDetail({
  meal,
  canEdit,
  groupId,
  onSaved,
}: {
  meal: MealDetailRecord;
  canEdit: boolean;
  groupId: string;
  onSaved: (updated: MealDetailRecord) => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(meal));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Reset form whenever the underlying meal changes (e.g., after a save).
  useEffect(() => { setForm(toForm(meal)); }, [meal]);

  const dirty = useMemo(() => isDirty(form, meal), [form, meal]);
  const liveItems = useMemo(() => fromForm(form).items, [form]);
  const liveTotals = useMemo(() => totalsFromItems(liveItems), [liveItems]);

  const loggedDate = new Date(meal.loggedAt);
  const dateLabel = loggedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const updateItem = (idx: number, patch: Partial<EditableItem>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };
  const addItem = () => {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { name: '', portion: '', grams: '', calories: '0', proteinG: '0', carbsG: '0', fatG: '0' },
      ],
    }));
  };
  const removeItem = (idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const discard = () => setForm(toForm(meal));

  const handleSave = async () => {
    if (!canEdit || !dirty) return;
    setSaving(true);
    setErr(null);
    try {
      const { items } = fromForm(form);
      const totals = totalsFromItems(items);
      // Rescale the AI-supplied calorie band proportionally if the user
      // adjusted item calories. If we don't have an original band, fall back
      // to ±15% of the new total.
      const origCal = meal.totals.calories;
      let lo: number | null = null;
      let hi: number | null = null;
      if (totals.calories > 0) {
        if (meal.caloriesLow != null && meal.caloriesHigh != null && origCal > 0) {
          const ratio = totals.calories / origCal;
          lo = Math.round((meal.caloriesLow * ratio) / 10) * 10;
          hi = Math.round((meal.caloriesHigh * ratio) / 10) * 10;
        } else {
          lo = Math.round((totals.calories * 0.85) / 10) * 10;
          hi = Math.round((totals.calories * 1.15) / 10) * 10;
        }
      }
      await updateMeal(groupId, meal.id, {
        items,
        totals,
        caloriesLow: lo,
        caloriesHigh: hi,
        notes: form.notes.trim() ? form.notes.trim() : null,
        description: form.description.trim() ? form.description.trim() : null,
      });
      const updated: MealDetailRecord = {
        ...meal,
        items,
        totals,
        caloriesLow: lo,
        caloriesHigh: hi,
        notes: form.notes.trim() ? form.notes.trim() : null,
        description: form.description.trim() ? form.description.trim() : null,
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
        <Eyebrow>MEAL · {dateLabel.toUpperCase()} · {formatTime(meal.loggedAt).toUpperCase()}</Eyebrow>
        <h1 style={{ ...display, fontSize: 'clamp(24px, 6vw, 28px)', fontWeight: 700, marginTop: 6, marginBottom: 0 }}>
          {headline(form, meal)}
        </h1>
      </div>

      {meal.photoUrl && (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meal.photoUrl} alt="meal" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }} />
        </div>
      )}

      {(meal.source === 'description' || form.description) && (
        <Card>
          <Eyebrow>YOUR DESCRIPTION</Eyebrow>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            disabled={!canEdit}
            placeholder="What did you eat?"
            style={{ ...textareaStyle, marginTop: 8 }}
          />
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <Eyebrow>TOTAL · AUTO-SUMMED</Eyebrow>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {meal.edited && <Chip color="ghost">EDITED</Chip>}
            <SourceChip source={meal.source} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
          <StatNumeral value={Math.round(liveTotals.calories)} unit="KCAL" size={48} />
          <div style={{ ...mono, fontSize: 12, color: 'var(--text-on-dark-mute)' }}>
            {Math.round(liveTotals.proteinG)}P · {Math.round(liveTotals.carbsG)}C · {Math.round(liveTotals.fatG)}F
          </div>
        </div>
        {meal.caloriesLow != null && meal.caloriesHigh != null && meal.caloriesHigh > 0 && (
          <div
            style={{
              marginTop: 8,
              ...mono,
              fontSize: 10,
              color: 'var(--text-on-dark-faint)',
              letterSpacing: '0.1em',
            }}
          >
            EST. RANGE · {Math.round(meal.caloriesLow).toLocaleString()}–
            {Math.round(meal.caloriesHigh).toLocaleString()} KCAL
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>ITEMS · {form.items.length}</Eyebrow>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {form.items.map((it, i) => (
            <ItemEditor
              key={i}
              item={it}
              disabled={!canEdit}
              onChange={(patch) => updateItem(i, patch)}
              onRemove={canEdit ? () => removeItem(i) : undefined}
            />
          ))}
          {form.items.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: 0 }}>
              No items yet. {canEdit && 'Add one below.'}
            </p>
          )}
        </div>
        {canEdit && (
          <button type="button" onClick={addItem} style={addItemBtn}>
            <Icon name="plus" size={12} color="var(--lime)" strokeWidth={2.5} />
            Add item
          </button>
        )}
      </Card>

      <Card style={form.notes ? { background: 'rgba(218,255,63,0.06)', borderColor: 'rgba(218,255,63,0.2)' } : undefined}>
        <Eyebrow color={form.notes ? 'var(--lime)' : undefined}>NOTES</Eyebrow>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          disabled={!canEdit}
          rows={2}
          placeholder={canEdit ? 'Add a note (optional)' : ''}
          style={{ ...textareaStyle, marginTop: 8 }}
        />
      </Card>

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
          <Link href="/log/meal" className="btn btn-lime" style={{ padding: '12px 16px', fontSize: 13, display: 'inline-flex' }}>
            Log another
            <Icon name="plus" size={14} color="#0a0a0a" strokeWidth={2.5} />
          </Link>
          <Link href="/meals" className="btn btn-ghost-dark" style={{ padding: '12px 16px', fontSize: 13, display: 'inline-flex' }}>
            All meals
          </Link>
        </div>
      )}
    </div>
  );
}

function ItemEditor({
  item,
  disabled,
  onChange,
  onRemove,
}: {
  item: EditableItem;
  disabled: boolean;
  onChange: (patch: Partial<EditableItem>) => void;
  onRemove?: () => void;
}) {
  return (
    <div style={itemBox}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={disabled}
          placeholder="Item name"
          style={{ ...nameInput, flex: 1 }}
        />
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove item" style={iconBtn}>
            <Icon name="x" size={12} color="var(--text-on-dark-faint)" />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <LabeledNum
          label="PORTION"
          value={item.portion}
          onChange={(v) => onChange({ portion: v })}
          disabled={disabled}
          placeholder="1 cup"
          numeric={false}
        />
        <LabeledNum
          label="GRAMS"
          value={item.grams}
          onChange={(v) => onChange({ grams: v })}
          disabled={disabled}
          placeholder="0"
          numeric
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
        <LabeledNum label="KCAL" value={item.calories} onChange={(v) => onChange({ calories: v })} disabled={disabled} numeric accent="var(--lime)" />
        <LabeledNum label="P" value={item.proteinG} onChange={(v) => onChange({ proteinG: v })} disabled={disabled} numeric />
        <LabeledNum label="C" value={item.carbsG} onChange={(v) => onChange({ carbsG: v })} disabled={disabled} numeric />
        <LabeledNum label="F" value={item.fatG} onChange={(v) => onChange({ fatG: v })} disabled={disabled} numeric />
      </div>
    </div>
  );
}

function LabeledNum({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  numeric,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  numeric?: boolean;
  accent?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...mono, fontSize: 9, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => {
          const next = numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value;
          onChange(next);
        }}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={numeric ? 'decimal' : undefined}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0e0d0a',
          color: accent ?? 'var(--text-on-dark)',
          fontFamily: 'var(--f-mono)',
          fontSize: 13,
          textAlign: numeric ? 'right' : 'left',
          outline: 'none',
        }}
      />
    </label>
  );
}

function headline(form: Form, meal: MealDetailRecord): string {
  if (form.items.length === 0) {
    return form.description.trim() || meal.description || 'Logged meal';
  }
  const first = form.items[0]!.name.trim() || 'Item';
  if (form.items.length === 1) return first;
  return `${first} + ${form.items.length - 1} more`;
}

function SourceChip({ source }: { source: MealDetailRecord['source'] }) {
  if (source === 'description') return <Chip color="ghost">FROM TEXT</Chip>;
  if (source === 'manual') return <Chip color="ghost">MANUAL</Chip>;
  return <Chip color="ghost">FROM PHOTO</Chip>;
}

function numOrZero(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  fontFamily: 'var(--f-ui)',
  fontSize: 13,
  lineHeight: 1.5,
  resize: 'vertical',
  outline: 'none',
};

const itemBox: CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 12,
};

const nameInput: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  fontFamily: 'var(--f-ui)',
  fontSize: 14,
  fontWeight: 600,
  outline: 'none',
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
  flexShrink: 0,
};

const addItemBtn: CSSProperties = {
  marginTop: 12,
  width: '100%',
  padding: '10px 12px',
  border: '1px dashed rgba(218,255,63,0.3)',
  background: 'rgba(218,255,63,0.04)',
  color: 'var(--lime)',
  borderRadius: 10,
  fontFamily: 'var(--f-ui)',
  fontWeight: 600,
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
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
