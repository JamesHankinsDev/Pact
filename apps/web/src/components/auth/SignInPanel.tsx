'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { ConfirmationResult } from 'firebase/auth';
import { Icon } from '@/components/primitives';
import {
  sendMagicLink,
  sendPhoneCode,
  signInWithGoogle,
  verifyPhoneCode,
} from '@/lib/auth';

type Method = 'google' | 'email' | 'phone';

type SignInPanelProps = {
  next: string;
};

export function SignInPanel({ next }: SignInPanelProps) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('google');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <MethodTabs method={method} onChange={setMethod} />
      {method === 'google' && <GoogleForm next={next} onSignedIn={() => router.replace(next)} />}
      {method === 'email' && <EmailForm next={next} />}
      {method === 'phone' && <PhoneForm next={next} onSignedIn={() => router.replace(next)} />}
    </div>
  );
}

/* ── tabs ──────────────────────────────────────────────────────────────── */

function MethodTabs({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  const tabs: Array<{ id: Method; label: string }> = [
    { id: 'google', label: 'Google' },
    { id: 'email', label: 'Email link' },
    { id: 'phone', label: 'Phone' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: 4,
        borderRadius: 999,
      }}
    >
      {tabs.map((t) => {
        const on = t.id === method;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: on ? 'var(--lime)' : 'transparent',
              color: on ? 'var(--ink)' : 'var(--text-on-dark-mute)',
              fontFamily: 'var(--f-ui)',
              fontWeight: 600,
              fontSize: 13,
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Google ────────────────────────────────────────────────────────────── */

function GoogleForm({ next, onSignedIn }: { next: string; onSignedIn: () => void }) {
  const [status, setStatus] = useState<'idle' | 'signing-in'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setStatus('signing-in');
    setError(null);
    try {
      await signInWithGoogle();
      onSignedIn();
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={muted}>One-tap sign-in with your Google account.</p>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'signing-in'}
        className="btn btn-lime"
        style={{ padding: '14px 20px', fontSize: 14 }}
      >
        {status === 'signing-in' ? 'Opening Google…' : 'Continue with Google'}
        <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
      </button>
      <Hint nextNote next={next} />
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

/* ── Email link ────────────────────────────────────────────────────────── */

function EmailForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setError(null);
    try {
      await sendMagicLink(email, next);
      setStatus('sent');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not send link');
    }
  };

  if (status === 'sent') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ ...muted, color: 'var(--lime)' }}>Check your email.</p>
        <p style={muted}>
          We sent a sign-in link to <strong style={{ color: 'var(--text-on-dark)' }}>{email}</strong>.
          Open it on this device and you&rsquo;ll land back here.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="btn btn-ghost-dark"
          style={{ padding: '12px 18px', fontSize: 13 }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={muted}>We&rsquo;ll email you a one-tap sign-in link. No password.</p>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={input}
      />
      <button
        type="submit"
        disabled={status === 'sending' || !email}
        className="btn btn-lime"
        style={{ padding: '14px 20px', fontSize: 14, opacity: !email ? 0.5 : 1 }}
      >
        {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
        <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
      </button>
      <Hint nextNote next={next} />
      {error && <ErrorLine>{error}</ErrorLine>}
    </form>
  );
}

/* ── Phone ─────────────────────────────────────────────────────────────── */

function PhoneForm({ next, onSignedIn }: { next: string; onSignedIn: () => void }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'awaiting-code' | 'verifying'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setStatus('sending');
    setError(null);
    try {
      const c = await sendPhoneCode(phoneNumber, 'recaptcha-container');
      setConfirmation(c);
      setStatus('awaiting-code');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not send code');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation || !code) return;
    setStatus('verifying');
    setError(null);
    try {
      await verifyPhoneCode(confirmation, code);
      onSignedIn();
    } catch (err) {
      setStatus('awaiting-code');
      setError(err instanceof Error ? err.message : 'Invalid code');
    }
  };

  if (status === 'awaiting-code' || status === 'verifying') {
    return (
      <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={muted}>
          Enter the 6-digit code we texted to{' '}
          <strong style={{ color: 'var(--text-on-dark)' }}>{phoneNumber}</strong>.
        </p>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ ...input, fontFamily: 'var(--f-mono)', letterSpacing: '0.3em', textAlign: 'center' }}
        />
        <button
          type="submit"
          disabled={status === 'verifying' || code.length < 6}
          className="btn btn-lime"
          style={{ padding: '14px 20px', fontSize: 14, opacity: code.length < 6 ? 0.5 : 1 }}
        >
          {status === 'verifying' ? 'Verifying…' : 'Verify code'}
          <Icon name="check" size={14} color="#0a0a0a" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus('idle');
            setConfirmation(null);
            setCode('');
          }}
          className="btn btn-ghost-dark"
          style={{ padding: '12px 18px', fontSize: 13 }}
        >
          Use a different number
        </button>
        {error && <ErrorLine>{error}</ErrorLine>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={muted}>Include the country code, e.g. +1 555 555 1234.</p>
      <input
        type="tel"
        required
        autoComplete="tel"
        placeholder="+1 555 555 1234"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        style={input}
      />
      <button
        type="submit"
        disabled={status === 'sending' || !phoneNumber}
        className="btn btn-lime"
        style={{ padding: '14px 20px', fontSize: 14, opacity: !phoneNumber ? 0.5 : 1 }}
      >
        {status === 'sending' ? 'Sending code…' : 'Text me a code'}
        <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
      </button>
      <Hint nextNote next={next} />
      {error && <ErrorLine>{error}</ErrorLine>}
      <div id="recaptcha-container" />
    </form>
  );
}

/* ── shared bits ───────────────────────────────────────────────────────── */

const muted: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-on-dark-mute)',
  margin: 0,
  lineHeight: 1.5,
};

const input: CSSProperties = {
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: '14px 16px',
  fontFamily: 'var(--f-ui)',
  fontSize: 15,
  outline: 'none',
};

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'rgba(255,107,74,0.1)',
        border: '1px solid rgba(255,107,74,0.3)',
        color: '#ff6b4a',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}

function Hint({ nextNote, next }: { nextNote: boolean; next: string }) {
  if (!nextNote) return null;
  const note = next === '/' ? null : `Returning to ${next} after sign-in.`;
  if (!note) return null;
  return (
    <p
      className="mono"
      style={{
        fontSize: 10,
        color: 'var(--text-on-dark-faint)',
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        margin: 0,
      }}
    >
      {note}
    </p>
  );
}
