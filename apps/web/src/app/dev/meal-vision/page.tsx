'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Brand, Card, Eyebrow, Icon, StatNumeral } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { getFirebase } from '@/lib/firebase';
import { logMeal } from '@/lib/meal-log';
import type { MealParseResult } from '@pact/types';

type ParsedSlot = {
  result: MealParseResult;
  preview: string;
  blob: Blob;
  mediaType: string;
};

type State =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'analyzing' }
  | { status: 'done'; parsed: ParsedSlot }
  | { status: 'logging'; parsed: ParsedSlot }
  | { status: 'logged'; parsed: ParsedSlot; mealId: string }
  | { status: 'error'; message: string };

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function MealVisionDevPage() {
  const { user, profile, loading } = useAuth();
  const [state, setState] = useState<State>({ status: 'idle' });

  const handleFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      setState({ status: 'error', message: `Unsupported file type: ${file.type}` });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({ status: 'error', message: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 10 MB.` });
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

      const res = await fetch('/api/vision/meal', {
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

      const result = (await res.json()) as MealParseResult;
      setState({
        status: 'done',
        parsed: { result, preview, blob: file, mediaType: file.type },
      });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Request failed' });
    }
  };

  const handleLog = async () => {
    if (state.status !== 'done') return;
    if (!user || !profile?.currentGroupId) {
      setState({
        status: 'error',
        message: 'You need to be in a pact to log a meal — make or join one first.',
      });
      return;
    }

    setState({ status: 'logging', parsed: state.parsed });
    try {
      const { mealId } = await logMeal({
        uid: user.uid,
        groupId: profile.currentGroupId,
        parsed: state.parsed.result,
        photo: { blob: state.parsed.blob, mediaType: state.parsed.mediaType },
      });
      setState({ status: 'logged', parsed: state.parsed, mealId });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not save meal' });
    }
  };

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text-on-dark)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none' }}>
            ← BACK
          </Link>
        </header>

        <div>
          <Eyebrow>DEV · MEAL VISION</Eyebrow>
          <h1 style={{ ...display, fontSize: 32, fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            Try the meal-photo parser.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Drop in a meal photo. We send it to <code>POST /api/vision/meal</code>, which calls Claude
            Opus 4.7 with adaptive thinking and forces a structured tool call.
          </p>
        </div>

        {!loading && !user && (
          <Card>
            <p style={{ fontSize: 13, margin: 0 }}>
              You need to <Link href={`/auth?next=${encodeURIComponent('/dev/meal-vision')}`} style={{ color: 'var(--lime)' }}>sign in</Link> first — the API verifies your Firebase ID token before calling Anthropic.
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
                state.status === 'logging'
              }
            />

            {state.status === 'uploading' && <Pulse label="Reading file…" />}
            {state.status === 'analyzing' && <Pulse label="Asking Claude…" />}
            {state.status === 'logging' && <Pulse label="Saving to your pact…" />}
            {state.status === 'error' && (
              <Card style={{ borderColor: 'rgba(255,107,74,0.3)', background: 'rgba(255,107,74,0.08)' }}>
                <Eyebrow color="var(--coral)">ERROR</Eyebrow>
                <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{state.message}</p>
              </Card>
            )}
            {(state.status === 'done' || state.status === 'logging' || state.status === 'logged') && (
              <Result
                result={state.parsed.result}
                preview={state.parsed.preview}
                onLog={state.status === 'done' ? handleLog : undefined}
                logged={state.status === 'logged' ? state.mealId : undefined}
                inGroup={!!profile?.currentGroupId}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

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
        <Icon name="camera" size={26} color="var(--lime)" />
      </div>
      <div style={{ ...display, fontSize: 18, fontWeight: 700 }}>Drop a meal photo here</div>
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
  onLog,
  logged,
  inGroup,
}: {
  result: MealParseResult;
  preview: string;
  onLog?: () => void;
  logged?: string;
  inGroup: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="meal" style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'cover' }} />
      </div>

      <Card>
        <Eyebrow>TOTAL</Eyebrow>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
          <StatNumeral value={Math.round(result.totals.calories)} unit="KCAL" size={48} />
          <div style={{ ...mono, fontSize: 12, color: 'var(--text-on-dark-mute)' }}>
            {Math.round(result.totals.proteinG)}P · {Math.round(result.totals.carbsG)}C · {Math.round(result.totals.fatG)}F
          </div>
        </div>
      </Card>

      <Card>
        <Eyebrow>DETECTED ITEMS · {result.items.length}</Eyebrow>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</div>
                <div style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
                  {it.portion ?? `${it.grams ?? '?'} g`}
                </div>
              </div>
              <div style={{ ...mono, fontSize: 12, textAlign: 'right' }}>
                <div style={{ color: 'var(--lime)' }}>{Math.round(it.calories)} kcal</div>
                <div style={{ color: 'var(--text-on-dark-mute)' }}>
                  {Math.round(it.proteinG)}P · {Math.round(it.carbsG)}C · {Math.round(it.fatG)}F
                </div>
              </div>
            </div>
          ))}
          {result.items.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: 0 }}>
              Nothing recognized.
            </p>
          )}
        </div>
      </Card>

      {result.notes && (
        <Card style={{ background: 'rgba(218,255,63,0.06)', borderColor: 'rgba(218,255,63,0.2)' }}>
          <Eyebrow color="var(--lime)">NOTES</Eyebrow>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{result.notes}</p>
        </Card>
      )}

      {logged ? (
        <Card style={{ background: 'rgba(218,255,63,0.1)', borderColor: 'rgba(218,255,63,0.3)' }}>
          <Eyebrow color="var(--lime)">LOGGED</Eyebrow>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 4, lineHeight: 1.5 }}>
            Saved to your pact. Meal ID:
          </p>
          <code style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>{logged}</code>
        </Card>
      ) : onLog ? (
        <button
          type="button"
          onClick={onLog}
          disabled={!inGroup}
          className="btn btn-lime"
          style={{
            padding: '14px 20px',
            fontSize: 14,
            opacity: inGroup ? 1 : 0.5,
            cursor: inGroup ? 'pointer' : 'not-allowed',
          }}
          title={inGroup ? '' : 'Make or join a pact first'}
        >
          {inGroup ? 'Log this meal' : 'Need a pact to log meals'}
          <Icon name="check" size={14} color="#0a0a0a" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}

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

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};
