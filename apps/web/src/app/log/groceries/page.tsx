'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Brand, Card, Eyebrow, Icon, StatNumeral } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { getFirebase } from '@/lib/firebase';
import { saveReceipt } from '@/lib/inventory';
import { useSpeechRecognition } from '@/lib/speech-recognition';
import type { ReceiptParseResult, ReceiptParseItem } from '@pact/types';

type Mode = 'photo' | 'describe';

type ParsedSource =
  | { kind: 'photo'; preview: string }
  | { kind: 'describe' };

type State =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'analyzing' }
  | { status: 'done'; result: ReceiptParseResult; source: ParsedSource }
  | { status: 'saving'; result: ReceiptParseResult; source: ParsedSource }
  | {
      status: 'saved';
      result: ReceiptParseResult;
      source: ParsedSource;
      receiptId: string;
      count: number;
    }
  | { status: 'error'; message: string };

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_DESCRIPTION_LEN = 6000;

export default function GroceriesPage() {
  const { user, profile, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('photo');
  const [state, setState] = useState<State>({ status: 'idle' });

  const switchMode = (next: Mode) => {
    if (state.status === 'reading' || state.status === 'analyzing' || state.status === 'saving') return;
    setMode(next);
    setState({ status: 'idle' });
  };

  const handlePhoto = async (file: File) => {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setState({ status: 'error', message: `Unsupported file type: ${file.type}` });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({
        status: 'error',
        message: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 10 MB.`,
      });
      return;
    }

    setState({ status: 'reading' });
    const preview = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);

    setState({ status: 'analyzing' });
    try {
      const { auth } = getFirebase();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const res = await fetch('/api/vision/receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ imageBase64: base64, imageMediaType: file.type }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      const result = (await res.json()) as ReceiptParseResult;
      setState({ status: 'done', result, source: { kind: 'photo', preview } });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Request failed' });
    }
  };

  const handleDescribe = async (description: string) => {
    setState({ status: 'analyzing' });
    try {
      const { auth } = getFirebase();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const res = await fetch('/api/text/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      const result = (await res.json()) as ReceiptParseResult;
      setState({ status: 'done', result, source: { kind: 'describe' } });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Request failed' });
    }
  };

  const handleSave = async (editedItems: ReceiptParseItem[]) => {
    if (state.status !== 'done') return;
    if (!user) {
      setState({ status: 'error', message: 'You need to sign in first.' });
      return;
    }
    if (!profile?.currentHouseholdId) {
      setState({
        status: 'error',
        message: 'Set up a household first — inventory is shared with the people you share a kitchen with.',
      });
      return;
    }

    const filtered = editedItems.filter((it) => it.name.trim().length > 0 && it.quantity > 0);
    if (filtered.length === 0) {
      setState({ status: 'error', message: 'Nothing to save — add at least one item.' });
      return;
    }

    const finalResult: ReceiptParseResult = { ...state.result, items: filtered };
    setState({ status: 'saving', result: finalResult, source: state.source });
    try {
      const { receiptId, count } = await saveReceipt({
        uid: user.uid,
        householdId: profile.currentHouseholdId,
        parsed: finalResult,
      });
      setState({
        status: 'saved',
        result: finalResult,
        source: state.source,
        receiptId,
        count,
      });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not save inventory' });
    }
  };

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/dashboard" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
            ← BACK
          </Link>
        </header>

        <div>
          <Eyebrow>STOCK YOUR PANTRY</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            What&rsquo;s in your kitchen?
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Scan a receipt or just say what you have. We&rsquo;ll add it to your household&rsquo;s shared pantry.
          </p>
        </div>

        {!loading && !user && (
          <Card>
            <p style={{ fontSize: 13, margin: 0 }}>
              You need to{' '}
              <Link href={`/auth?next=${encodeURIComponent('/log/groceries')}`} style={{ color: 'var(--lime)' }}>
                sign in
              </Link>{' '}
              first.
            </p>
          </Card>
        )}

        {user && !profile?.currentHouseholdId && (
          <Card style={{ background: 'rgba(218,255,63,0.06)', borderColor: 'rgba(218,255,63,0.2)' }}>
            <Eyebrow color="var(--lime)">HOUSEHOLD REQUIRED</Eyebrow>
            <p style={{ fontSize: 13, marginTop: 6, marginBottom: 12, lineHeight: 1.5 }}>
              Inventory is shared with the people you actually share a kitchen with — not your whole pact. Set up or
              join a household first.
            </p>
            <Link
              href="/household"
              className="btn btn-lime"
              style={{ padding: '12px 16px', fontSize: 13, display: 'inline-flex' }}
            >
              Go to Household
              <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
            </Link>
          </Card>
        )}

        {user && profile?.currentHouseholdId && (
          <>
            <ModeToggle mode={mode} onChange={switchMode} />

            {mode === 'photo' && state.status !== 'done' && state.status !== 'saving' && state.status !== 'saved' && (
              <FileDrop
                onFile={handlePhoto}
                disabled={state.status === 'reading' || state.status === 'analyzing'}
              />
            )}

            {mode === 'describe' && state.status !== 'done' && state.status !== 'saving' && state.status !== 'saved' && (
              <DescribeInput
                disabled={state.status === 'analyzing'}
                onSubmit={handleDescribe}
                onError={(msg) => setState({ status: 'error', message: msg })}
              />
            )}

            {state.status === 'reading' && <Pulse label="Reading file…" />}
            {state.status === 'analyzing' && <Pulse label="Asking Claude…" />}
            {state.status === 'saving' && <Pulse label="Adding to your pantry…" />}

            {state.status === 'error' && (
              <Card style={{ borderColor: 'rgba(255,107,74,0.3)', background: 'rgba(255,107,74,0.08)' }}>
                <Eyebrow color="var(--coral)">ERROR</Eyebrow>
                <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>
                  {state.message}
                </p>
              </Card>
            )}

            {(state.status === 'done' || state.status === 'saving' || state.status === 'saved') && (
              <ResultEditor
                result={state.result}
                source={state.source}
                onSave={state.status === 'done' ? handleSave : undefined}
                saved={state.status === 'saved' ? { receiptId: state.receiptId, count: state.count } : undefined}
                onCancel={() => setState({ status: 'idle' })}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* ── Mode toggle ─────────────────────────────────────────────────────── */

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const options: Array<{ key: Mode; label: string; icon: 'camera' | 'chat' }> = [
    { key: 'photo', label: 'Receipt photo', icon: 'camera' },
    { key: 'describe', label: 'Dictate / type', icon: 'chat' },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {options.map((opt) => {
        const active = opt.key === mode;
        return (
          <button
            key={opt.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              background: active ? 'var(--lime)' : 'transparent',
              color: active ? '#0a0a0a' : 'var(--text-on-dark)',
              fontFamily: 'var(--f-ui)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Icon name={opt.icon} size={14} color={active ? '#0a0a0a' : 'var(--text-on-dark-mute)'} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Photo drop ──────────────────────────────────────────────────────── */

function FileDrop({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
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
          const file = e.target.files?.[0];
          if (file) onFile(file);
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
      <div style={{ ...display, fontSize: 18, fontWeight: 700 }}>Drop a receipt here</div>
      <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 4 }}>
        JPEG, PNG, GIF, or WebP up to 10 MB
      </div>
    </label>
  );
}

/* ── Describe / dictate ──────────────────────────────────────────────── */

function DescribeInput({
  disabled,
  onSubmit,
  onError,
}: {
  disabled: boolean;
  onSubmit: (text: string) => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState('');
  const speech = useSpeechRecognition({
    onAppend: (chunk) => setText((prev) => (prev ? `${prev.trim()} ${chunk}` : chunk)),
    onError,
  });

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onError('Type or dictate what you have first.');
      return;
    }
    if (trimmed.length > MAX_DESCRIPTION_LEN) {
      onError(`Too long (max ${MAX_DESCRIPTION_LEN} chars).`);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. dozen eggs, two pounds chicken thighs, half a gallon milk, bag of brown rice, three onions, broccoli, olive oil…"
          rows={6}
          disabled={disabled}
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
              animation: speech.listening ? 'pact-mic-pulse 1s ease-in-out infinite' : undefined,
            }}
          >
            <MicIcon active={speech.listening} />
            <style>{`@keyframes pact-mic-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
          {speech.supported
            ? speech.listening
              ? 'LISTENING…'
              : 'TIP · TAP THE MIC TO DICTATE'
            : 'TIP · DICTATION NOT SUPPORTED IN THIS BROWSER'}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="btn btn-lime"
          style={{ padding: '12px 18px', fontSize: 14, opacity: disabled || !text.trim() ? 0.5 : 1 }}
        >
          {disabled ? 'Asking Claude…' : 'Parse inventory'}
          <Icon name="sparkle" size={13} color="#0a0a0a" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="7" y="2" width="6" height="10" rx="3" stroke={active ? '#fff' : 'var(--lime)'} strokeWidth="1.8" />
      <path
        d="M4 10v1a6 6 0 0012 0v-1M10 17v2"
        stroke={active ? '#fff' : 'var(--lime)'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Editable result ─────────────────────────────────────────────────── */

type EditableItem = {
  name: string;
  quantity: string;
  unit: string;
  estCost: string;
};

function toEditable(item: ReceiptParseItem): EditableItem {
  return {
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    estCost: item.estCost != null ? String(item.estCost) : '',
  };
}

function fromEditable(e: EditableItem): ReceiptParseItem {
  return {
    name: e.name.trim(),
    quantity: parseFloat(e.quantity) || 0,
    unit: e.unit.trim() || 'ea',
    ...(e.estCost.trim() ? { estCost: parseFloat(e.estCost) || 0 } : {}),
  };
}

function ResultEditor({
  result,
  source,
  onSave,
  saved,
  onCancel,
}: {
  result: ReceiptParseResult;
  source: ParsedSource;
  onSave?: (items: ReceiptParseItem[]) => void;
  saved?: { receiptId: string; count: number };
  onCancel: () => void;
}) {
  const [items, setItems] = useState<EditableItem[]>(() => result.items.map(toEditable));

  const itemCount = items.length;
  const subtotal = useMemo(
    () =>
      items.reduce((acc, it) => {
        const cost = parseFloat(it.estCost);
        return acc + (Number.isFinite(cost) ? cost : 0);
      }, 0),
    [items],
  );

  const update = (idx: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const add = () =>
    setItems((prev) => [...prev, { name: '', quantity: '1', unit: 'ea', estCost: '' }]);

  const sourceLabel =
    source.kind === 'photo'
      ? result.store
        ? result.store.toUpperCase()
        : 'RECEIPT'
      : 'DICTATED';

  const handleSaveClick = () => {
    if (!onSave) return;
    onSave(items.map(fromEditable));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {source.kind === 'photo' && (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source.preview}
            alt="receipt"
            style={{
              display: 'block',
              width: '100%',
              maxHeight: 320,
              objectFit: 'contain',
              background: 'var(--ink-card)',
            }}
          />
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <Eyebrow>{sourceLabel}</Eyebrow>
            <StatNumeral value={itemCount} unit={itemCount === 1 ? 'ITEM' : 'ITEMS'} size={48} />
          </div>
          {(result.subtotal != null || result.total != null || subtotal > 0) && (
            <div style={{ ...mono, fontSize: 12, color: 'var(--text-on-dark-mute)', textAlign: 'right' }}>
              {result.subtotal != null && <div>Subtotal · ${result.subtotal.toFixed(2)}</div>}
              {result.total != null && <div>Total · ${result.total.toFixed(2)}</div>}
              {result.subtotal == null && result.total == null && subtotal > 0 && (
                <div>Sum · ${subtotal.toFixed(2)}</div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Eyebrow>ITEMS · EDITABLE</Eyebrow>
          <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)', letterSpacing: '0.1em' }}>
            REVIEW BEFORE SAVING
          </span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => (
            <ItemRow key={i} item={it} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} />
          ))}
          {items.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: 0 }}>
              Nothing parsed yet. Add an item below.
            </p>
          )}
        </div>
        {!saved && (
          <button type="button" onClick={add} style={addItemBtn}>
            <Icon name="plus" size={12} color="var(--lime)" strokeWidth={2.5} />
            Add item
          </button>
        )}
      </Card>

      {result.notes && (
        <Card style={{ background: 'rgba(218,255,63,0.06)', borderColor: 'rgba(218,255,63,0.2)' }}>
          <Eyebrow color="var(--lime)">NOTES</Eyebrow>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{result.notes}</p>
        </Card>
      )}

      {saved ? (
        <Card style={{ background: 'rgba(218,255,63,0.1)', borderColor: 'rgba(218,255,63,0.3)' }}>
          <Eyebrow color="var(--lime)">ADDED</Eyebrow>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 4, lineHeight: 1.5 }}>
            {saved.count} item{saved.count === 1 ? '' : 's'} added to your household pantry.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Link
              href="/household"
              className="btn btn-ghost-dark"
              style={{ padding: '10px 14px', fontSize: 13, display: 'inline-flex' }}
            >
              Back to Household
            </Link>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-lime"
              style={{ padding: '10px 14px', fontSize: 13 }}
            >
              Add more
              <Icon name="plus" size={13} color="#0a0a0a" strokeWidth={2.5} />
            </button>
          </div>
        </Card>
      ) : onSave ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost-dark"
            style={{ padding: '14px 16px', fontSize: 13 }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={itemCount === 0}
            className="btn btn-lime"
            style={{
              flex: 1,
              padding: '14px 18px',
              fontSize: 14,
              opacity: itemCount === 0 ? 0.5 : 1,
            }}
          >
            {itemCount === 0
              ? 'Nothing to add'
              : `Add ${itemCount} item${itemCount === 1 ? '' : 's'} to pantry`}
            <Icon name="check" size={14} color="#0a0a0a" strokeWidth={2.5} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: EditableItem;
  onChange: (patch: Partial<EditableItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={itemBox}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Item name"
          style={{ ...nameInput, flex: 1 }}
        />
        <button type="button" onClick={onRemove} aria-label="Remove item" style={iconBtn}>
          <Icon name="x" size={12} color="var(--text-on-dark-faint)" />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <Labeled label="QTY">
          <input
            value={item.quantity}
            onChange={(e) => onChange({ quantity: e.target.value.replace(/[^0-9.]/g, '') })}
            inputMode="decimal"
            placeholder="1"
            style={smallInput}
          />
        </Labeled>
        <Labeled label="UNIT">
          <input
            value={item.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="ea"
            style={smallInput}
          />
        </Labeled>
        <Labeled label="$ EST">
          <input
            value={item.estCost}
            onChange={(e) => onChange({ estCost: e.target.value.replace(/[^0-9.]/g, '') })}
            inputMode="decimal"
            placeholder="—"
            style={smallInput}
          />
        </Labeled>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...mono, fontSize: 9, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/* ── Pulse ───────────────────────────────────────────────────────────── */

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
      <div style={{ ...display, fontSize: 16, fontWeight: 600 }}>{label}</div>
      <style>{`@keyframes pact-pulse { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

/* ── Helpers + styles ────────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--ink)',
  color: 'var(--text-on-dark)',
  padding: '40px 24px',
};

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
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

const smallInput: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  fontFamily: 'var(--f-mono)',
  fontSize: 13,
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
