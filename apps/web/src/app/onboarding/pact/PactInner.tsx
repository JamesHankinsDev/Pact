'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Avatar, Icon } from '@/components/primitives';
import { useOnboarding, clearPersistedOnboarding } from '@/lib/onboarding-state';
import { useAuth } from '@/lib/auth-context';
import { createGroupAndPact } from '@/lib/groups';
import { PACT_MEMBERS } from '@/lib/mock';

const COMMITMENTS = [
  { value: '5',    unit: 'workouts',    cadence: 'each',   key: 'workoutsPerWeek',  num: 5   },
  { value: '180g', unit: 'protein',     cadence: 'daily',  key: 'proteinGramsDaily', num: 180 },
  { value: '7',    unit: 'meds taken',  cadence: 'each',   key: 'medsPerDay',       num: 7   },
  { value: '3',    unit: 'practices',   cadence: 'weekly', key: 'practicesPerWeek', num: 3   },
] as const;

function buildCommitments() {
  return Object.fromEntries(COMMITMENTS.map((c) => [c.key, c.num])) as Record<string, number>;
}

const COMMIT_RETURN = '/onboarding/pact?commit=1';

type CommitState = 'idle' | 'committing' | 'done' | 'error';

export function PactInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { selectedContactIds } = useOnboarding();
  const { user, loading: authLoading, configured } = useAuth();
  const [commitState, setCommitState] = useState<CommitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const crew = PACT_MEMBERS.filter(
    (m) => m.id === 'jm' || selectedContactIds.includes(m.id),
  ).slice(0, 4);

  const commit = useCallback(async () => {
    if (!user) return;
    setCommitState('committing');
    setError(null);
    try {
      await createGroupAndPact({
        uid: user.uid,
        groupName: 'My Pact',
        commitments: buildCommitments(),
      });
      clearPersistedOnboarding();
      setCommitState('done');
      router.replace('/');
    } catch (err) {
      setCommitState('error');
      setError(err instanceof Error ? err.message : 'Could not save your pact');
    }
  }, [user, router]);

  // Auto-commit if returning from sign-in with ?commit=1.
  const wantsCommit = search.get('commit') === '1';
  useEffect(() => {
    if (!wantsCommit || authLoading) return;
    if (user && commitState === 'idle') void commit();
  }, [wantsCommit, authLoading, user, commitState, commit]);

  const handleSign = () => {
    if (!configured) {
      setError('Firebase is not configured yet — set NEXT_PUBLIC_FIREBASE_* in .env.local.');
      return;
    }
    if (user) {
      void commit();
    } else {
      router.push(`/auth?next=${encodeURIComponent(COMMIT_RETURN)}`);
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
          STEP 4 OF 4 · MAKE THE PACT
        </div>
        <h1
          className="display"
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Your first<br />weekly pact.
        </h1>

        <div
          style={{
            background: '#daff3f',
            color: '#0a0a0a',
            borderRadius: 22,
            padding: '22px 22px',
            marginTop: 24,
            position: 'relative',
            boxShadow: '6px 6px 0 #1a1916',
            border: '2px solid #0a0a0a',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              opacity: 0.6,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
            }}
          >
            THE HAYES PACT · WEEK 17
          </div>
          <div
            className="display"
            style={{ fontSize: 24, fontWeight: 700, marginTop: 8, lineHeight: 1.15 }}
          >
            We pact to —
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {COMMITMENTS.map((c, i) => (
              <div
                key={c.key}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  paddingBottom: 8,
                  borderBottom:
                    i < COMMITMENTS.length - 1 ? '1px solid rgba(10,10,10,0.15)' : 'none',
                }}
              >
                <span className="numeral" style={{ fontSize: 30 }}>{c.value}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{c.unit}</span>
                <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 'auto' }}>{c.cadence}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: 'flex' }}>
            {crew.map((m, i) => (
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                <Avatar initials={m.initials} color={m.color} size={28} ring />
              </div>
            ))}
          </div>
        </div>

        <p
          style={{
            marginTop: 18,
            marginBottom: 0,
            fontSize: 12,
            color: 'rgba(245,243,238,0.55)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Resets every Monday. Adjust anytime.
        </p>

        {error && (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(255,107,74,0.1)',
              border: '1px solid rgba(255,107,74,0.3)',
              color: '#ff6b4a',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div style={{ padding: '0 22px 60px' }}>
        <div className="dot-row" style={{ justifyContent: 'center', marginBottom: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="dot on" />
          ))}
        </div>
        <button
          type="button"
          onClick={handleSign}
          disabled={commitState === 'committing' || authLoading}
          className="btn btn-lime"
          style={{
            width: '100%',
            padding: '16px 20px',
            fontSize: 15,
            opacity: commitState === 'committing' || authLoading ? 0.6 : 1,
          }}
        >
          {commitState === 'committing' && 'Signing…'}
          {commitState === 'done' && 'Signed!'}
          {commitState !== 'committing' && commitState !== 'done' && (
            <>
              Sign the pact
              <Icon name="check" size={16} color="#0a0a0a" strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </>
  );
}
