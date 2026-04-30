'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand, Card, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { saveWeightLog } from '@/lib/weight';

type State =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; logId: string }
  | { status: 'error'; message: string };

export function BodyInner() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: 'idle' });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
    else setPhotoPreview(null);
  };

  const handleSave = async () => {
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent('/log/body')}`);
      return;
    }
    if (!profile?.currentGroupId) {
      setState({ status: 'error', message: 'Make or join a pact first.' });
      return;
    }
    const weightLb = parseFloat(weight);
    if (!Number.isFinite(weightLb) || weightLb <= 0) {
      setState({ status: 'error', message: 'Enter a valid weight.' });
      return;
    }
    const bodyFatPct = bodyFat.trim() ? parseFloat(bodyFat) : null;
    if (bodyFatPct != null && (!Number.isFinite(bodyFatPct) || bodyFatPct < 0 || bodyFatPct > 100)) {
      setState({ status: 'error', message: 'Body fat % should be between 0 and 100.' });
      return;
    }

    setState({ status: 'saving' });
    try {
      const photoPayload = photo ? { blob: photo, mediaType: photo.type } : null;
      const { logId } = await saveWeightLog({
        uid: user.uid,
        groupId: profile.currentGroupId,
        weightLb,
        bodyFatPct,
        notes: notes.trim() || null,
        photo: photoPayload,
      });
      setState({ status: 'saved', logId });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not save' });
    }
  };

  const reset = () => {
    setWeight('');
    setBodyFat('');
    setNotes('');
    setPhoto(null);
    setPhotoPreview(null);
    setState({ status: 'idle' });
  };

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/dashboard" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none' }}>
            ← BACK
          </Link>
        </header>

        <div>
          <Eyebrow>LOG WEIGHT</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            How are you tracking?
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Crew sees your weight number. Progress photos stay private to you.
          </p>
        </div>

        {!loading && !user && (
          <Card>
            <p style={{ fontSize: 13, margin: 0 }}>
              You need to{' '}
              <Link href={`/auth?next=${encodeURIComponent('/log/body')}`} style={{ color: 'var(--lime)' }}>
                sign in
              </Link>{' '}
              first.
            </p>
          </Card>
        )}

        {state.status === 'saved' ? (
          <SavedCard onAgain={reset} />
        ) : (
          <>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="WEIGHT · LB" required>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="180.4"
                    style={{ ...inputStyle, fontSize: 24, letterSpacing: '-0.02em' }}
                    autoFocus
                  />
                </Field>
                <Field label="BODY FAT % · OPTIONAL">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="18.5"
                    style={inputStyle}
                  />
                </Field>
                <Field label="NOTES · OPTIONAL">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Felt good, slept 8h"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <Eyebrow>PROGRESS PHOTO · OPTIONAL · PRIVATE</Eyebrow>
              <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 6, marginBottom: 10, lineHeight: 1.5 }}>
                Only you can see this. Crew never gets photo access.
              </p>
              {photoPreview ? (
                <div style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="progress" style={{ width: '100%', borderRadius: 14, maxHeight: 320, objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    style={removePhoto}
                  >
                    <Icon name="x" size={14} color="#0a0a0a" strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <label style={uploadDrop}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhoto}
                    style={{ display: 'none' }}
                  />
                  <Icon name="camera" size={20} color="var(--lime)" />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Add a progress photo</span>
                </label>
              )}
            </Card>

            {state.status === 'error' && (
              <Card style={{ background: 'rgba(255,107,74,0.08)', borderColor: 'rgba(255,107,74,0.3)' }}>
                <Eyebrow color="var(--coral)">ERROR</Eyebrow>
                <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{state.message}</p>
              </Card>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={state.status === 'saving' || !weight}
              className="btn btn-lime"
              style={{
                padding: '14px 20px',
                fontSize: 14,
                opacity: state.status === 'saving' || !weight ? 0.5 : 1,
              }}
            >
              {state.status === 'saving' ? 'Saving…' : 'Log weight'}
              <Icon name="check" size={14} color="#0a0a0a" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow>
        {label}
        {required && <span style={{ color: 'var(--lime)', marginLeft: 4 }}>*</span>}
      </Eyebrow>
      {children}
    </div>
  );
}

function SavedCard({ onAgain }: { onAgain: () => void }) {
  return (
    <Card style={{ background: 'rgba(218,255,63,0.1)', borderColor: 'rgba(218,255,63,0.3)' }}>
      <Eyebrow color="var(--lime)">LOGGED</Eyebrow>
      <p style={{ fontSize: 14, marginTop: 6, marginBottom: 12, lineHeight: 1.5 }}>
        Saved to your pact. Your dashboard&rsquo;s weight trend just got a new point.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/dashboard" className="btn btn-lime" style={{ padding: '10px 16px', fontSize: 13 }}>
          View dashboard
        </Link>
        <button type="button" onClick={onAgain} className="btn btn-ghost-dark" style={{ padding: '10px 16px', fontSize: 13 }}>
          Log another
        </button>
      </div>
    </Card>
  );
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

const inputStyle: CSSProperties = {
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '12px 14px',
  fontFamily: 'var(--f-ui)',
  fontSize: 16,
  outline: 'none',
  width: '100%',
};

const uploadDrop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '16px',
  borderRadius: 14,
  border: '1.5px dashed rgba(255,255,255,0.16)',
  background: 'rgba(218,255,63,0.04)',
  color: 'var(--text-on-dark)',
  cursor: 'pointer',
};

const removePhoto: CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 28,
  height: 28,
  borderRadius: 14,
  background: 'var(--lime)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
