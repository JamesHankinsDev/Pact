'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Brand, Card, Eyebrow, Icon, StatNumeral } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { getFirebase } from '@/lib/firebase';
import { saveReceipt } from '@/lib/inventory';
import type { ReceiptParseResult } from '@pact/types';

type ParsedSlot = {
  result: ReceiptParseResult;
  preview: string;
  blob: Blob;
  mediaType: string;
};

type State =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'analyzing' }
  | { status: 'done'; parsed: ParsedSlot }
  | { status: 'saving'; parsed: ParsedSlot }
  | { status: 'saved'; parsed: ParsedSlot; receiptId: string; count: number }
  | { status: 'error'; message: string };

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function ReceiptVisionDevPage() {
  const { user, profile, loading } = useAuth();
  const [state, setState] = useState<State>({ status: 'idle' });

  const handleFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      setState({ status: 'error', message: `Unsupported file type: ${file.type}` });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({
        status: 'error',
        message: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 10 MB.`,
      });
      return;
    }

    setState({ status: 'uploading' });
    const preview = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);

    setState({ status: 'analyzing' });
    try {
      const { auth } = getFirebase();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const res = await fetch('/api/vision/receipt', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ imageBase64: base64, imageMediaType: file.type }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const result = (await res.json()) as ReceiptParseResult;
      setState({ status: 'done', parsed: { result, preview, blob: file, mediaType: file.type } });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Request failed' });
    }
  };

  const handleSave = async () => {
    if (state.status !== 'done') return;
    if (!user || !profile?.currentGroupId) {
      setState({ status: 'error', message: 'You need to be in a pact to add to inventory.' });
      return;
    }
    setState({ status: 'saving', parsed: state.parsed });
    try {
      const { receiptId, count } = await saveReceipt({
        uid: user.uid,
        groupId: profile.currentGroupId,
        parsed: state.parsed.result,
      });
      setState({ status: 'saved', parsed: state.parsed, receiptId, count });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not save inventory' });
    }
  };

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none' }}>
            ← BACK
          </Link>
        </header>

        <div>
          <Eyebrow>LOG GROCERIES</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            Scan a receipt.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Drop in a photo of a grocery receipt. We&rsquo;ll pull out the line items and add
            them to your pact&rsquo;s pantry.
          </p>
        </div>

        {!loading && !user && (
          <Card>
            <p style={{ fontSize: 13, margin: 0 }}>
              You need to{' '}
              <Link
                href={`/auth?next=${encodeURIComponent('/log/groceries')}`}
                style={{ color: 'var(--lime)' }}
              >
                sign in
              </Link>{' '}
              first.
            </p>
          </Card>
        )}

        {user && (
          <>
            <FileDrop
              onFile={handleFile}
              disabled={
                state.status === 'uploading' ||
                state.status === 'analyzing' ||
                state.status === 'saving'
              }
            />

            {state.status === 'uploading' && <Pulse label="Reading file…" />}
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
              <Result
                result={state.parsed.result}
                preview={state.parsed.preview}
                onSave={state.status === 'done' ? handleSave : undefined}
                saved={state.status === 'saved' ? { receiptId: state.receiptId, count: state.count } : undefined}
                inGroup={!!profile?.currentGroupId}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────── */

function FileDrop({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  return (
    <label
      style={{
        display: 'block',
        padding: 28,
        borderRadius: 16,
        border: '1.5px dashed rgba(255,255,255,0.18)',
        background:
          'repeating-linear-gradient(135deg, rgba(218,255,63,0.03) 0 8px, transparent 8px 16px)',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="file"
        accept={ALLOWED.join(',')}
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
        <Icon name="cart" size={26} color="var(--lime)" />
      </div>
      <div style={{ ...display, fontSize: 18, fontWeight: 700 }}>Drop a receipt photo here</div>
      <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 4 }}>
        JPEG, PNG, GIF, or WebP up to 10 MB
      </div>
    </label>
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
      <div style={{ ...display, fontSize: 16, fontWeight: 600 }}>{label}</div>
      <style>{`@keyframes pact-pulse { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

function Result({
  result,
  preview,
  onSave,
  saved,
  inGroup,
}: {
  result: ReceiptParseResult;
  preview: string;
  onSave?: () => void;
  saved?: { receiptId: string; count: number };
  inGroup: boolean;
}) {
  const subtotal = result.subtotal ?? null;
  const total = result.total ?? null;
  const itemCount = result.items.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="receipt"
          style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', background: 'var(--ink-card)' }}
        />
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <Eyebrow>{result.store ? result.store.toUpperCase() : 'RECEIPT'}</Eyebrow>
            <StatNumeral value={itemCount} unit={itemCount === 1 ? 'ITEM' : 'ITEMS'} size={48} />
          </div>
          <div style={{ ...mono, fontSize: 12, color: 'var(--text-on-dark-mute)', textAlign: 'right' }}>
            {subtotal != null && <div>Subtotal · ${subtotal.toFixed(2)}</div>}
            {total != null && <div>Total · ${total.toFixed(2)}</div>}
          </div>
        </div>
      </Card>

      <Card>
        <Eyebrow>LINE ITEMS</Eyebrow>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.items.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0 }}>
              Nothing parseable.
            </p>
          ) : (
            result.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 6,
                  borderBottom:
                    i < result.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{it.name}</div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
                    {it.quantity} {it.unit}
                  </div>
                </div>
                <div style={{ ...mono, fontSize: 13, color: 'var(--lime)' }}>
                  {it.estCost != null ? `$${it.estCost.toFixed(2)}` : '—'}
                </div>
              </div>
            ))
          )}
        </div>
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
            {saved.count} item{saved.count === 1 ? '' : 's'} added to your pantry.
          </p>
          <code style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
            receiptId: {saved.receiptId}
          </code>
        </Card>
      ) : onSave ? (
        <button
          type="button"
          onClick={onSave}
          disabled={!inGroup || itemCount === 0}
          className="btn btn-lime"
          style={{
            padding: '14px 20px',
            fontSize: 14,
            opacity: !inGroup || itemCount === 0 ? 0.5 : 1,
            cursor: !inGroup || itemCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {!inGroup
            ? 'Need a pact to add inventory'
            : itemCount === 0
              ? 'Nothing to add'
              : `Add ${itemCount} item${itemCount === 1 ? '' : 's'} to pantry`}
          <Icon name="check" size={14} color="#0a0a0a" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

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
