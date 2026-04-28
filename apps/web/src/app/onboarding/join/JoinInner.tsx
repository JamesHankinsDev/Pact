'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { joinGroupByCode, normalizeInviteCode } from '@/lib/groups';

type JoinState =
  | { status: 'idle' }
  | { status: 'joining' }
  | { status: 'joined'; alreadyMember: boolean; groupName: string }
  | { status: 'error'; message: string };

export function JoinInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, loading: authLoading, configured } = useAuth();

  const codeFromUrl = search.get('code') ?? '';
  const [input, setInput] = useState(codeFromUrl);
  const [state, setState] = useState<JoinState>({ status: 'idle' });
  const normalized = useMemo(() => normalizeInviteCode(input), [input]);

  const attemptJoin = useCallback(
    async (uid: string, code: string) => {
      setState({ status: 'joining' });
      try {
        const result = await joinGroupByCode(uid, code);
        setState({
          status: 'joined',
          alreadyMember: result.alreadyMember,
          groupName: result.groupName,
        });
        setTimeout(() => router.replace('/'), 900);
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not join the pact',
        });
      }
    },
    [router],
  );

  // Auto-join if we landed here with ?code=… and a signed-in user (e.g. after auth round-trip).
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (state.status !== 'idle') return;
    const code = normalizeInviteCode(codeFromUrl);
    if (!code) return;
    void attemptJoin(user.uid, code);
  }, [authLoading, user, codeFromUrl, state.status, attemptJoin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized) {
      setState({
        status: 'error',
        message: "That doesn't look like an invite code. Try the link or the code at the end.",
      });
      return;
    }
    if (!configured) {
      setState({
        status: 'error',
        message: 'Firebase is not configured yet — set NEXT_PUBLIC_FIREBASE_* in .env.local.',
      });
      return;
    }
    if (user) {
      void attemptJoin(user.uid, normalized);
    } else {
      router.push(
        `/auth?next=${encodeURIComponent(`/onboarding/join?code=${normalized}`)}`,
      );
    }
  };

  return (
    <>
      <div style={{ padding: '70px 28px 0', flex: 1 }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'rgba(245,243,238,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          JOIN A PACT
        </div>
        <h1
          className="display"
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginTop: 8,
            marginBottom: 6,
          }}
        >
          Got an invite code?
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(245,243,238,0.55)', margin: 0, lineHeight: 1.5 }}>
          Paste the link or just the code at the end. We&rsquo;ll add you to the pact.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (state.status === 'error') setState({ status: 'idle' });
            }}
            placeholder="HAYES-7K2"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="characters"
            style={{
              ...inputStyle,
              fontFamily: 'var(--f-mono)',
              fontSize: 18,
              letterSpacing: '0.12em',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          />

          {normalized && state.status === 'idle' && (
            <p style={hint}>
              <Icon name="check" size={12} color="#daff3f" strokeWidth={2.5} />
              Looks like a code. Tap continue to join.
            </p>
          )}

          {state.status === 'joined' && (
            <div style={successBox}>
              <div className="mono" style={successEyebrow}>
                {state.alreadyMember ? 'ALREADY IN' : 'WELCOME'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {state.alreadyMember ? `You're already in ${state.groupName}.` : `You're in. Loading ${state.groupName}…`}
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div style={errorBox}>{state.message}</div>
          )}
        </form>

        <p
          style={{
            marginTop: 22,
            fontSize: 12,
            color: 'var(--text-on-dark-faint)',
            lineHeight: 1.5,
          }}
        >
          Don&rsquo;t have one?{' '}
          <Link href="/onboarding/welcome" style={{ color: 'var(--lime)', textDecoration: 'none' }}>
            Make your own pact
          </Link>{' '}
          instead.
        </p>
      </div>

      <div style={{ padding: '0 22px 60px' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!normalized || state.status === 'joining' || authLoading}
          className="btn btn-lime"
          style={{
            width: '100%',
            padding: '16px 20px',
            fontSize: 15,
            opacity: !normalized || state.status === 'joining' || authLoading ? 0.5 : 1,
          }}
        >
          {state.status === 'joining' && 'Joining…'}
          {state.status === 'joined' && 'Joined'}
          {state.status !== 'joining' && state.status !== 'joined' && (
            <>
              {user ? 'Join the pact' : 'Sign in to join'}
              <Icon name="arrow" size={16} color="#0a0a0a" strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </>
  );
}

const inputStyle: CSSProperties = {
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: '16px 18px',
  fontFamily: 'var(--f-ui)',
  fontSize: 15,
  outline: 'none',
};

const hint: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-on-dark-mute)',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const successBox: CSSProperties = {
  background: 'rgba(218,255,63,0.08)',
  border: '1px solid rgba(218,255,63,0.3)',
  borderRadius: 12,
  padding: '12px 14px',
  color: 'var(--text-on-dark)',
};

const successEyebrow: CSSProperties = {
  fontSize: 10,
  color: 'var(--lime)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontWeight: 500,
};

const errorBox: CSSProperties = {
  background: 'rgba(255,107,74,0.1)',
  border: '1px solid rgba(255,107,74,0.3)',
  color: '#ff6b4a',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 12,
};
