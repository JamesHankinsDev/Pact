'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brand, Eyebrow } from '@/components/primitives';
import { completeMagicLink, pendingMagicLinkUrl } from '@/lib/auth';

type Status = 'pending' | 'completing' | 'done' | 'error';

export default function AuthFinishPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const link = pendingMagicLinkUrl();
    if (!link) {
      setStatus('error');
      setError('This page expects an email sign-in link. Open the link from your email on this device.');
      return;
    }
    setStatus('completing');
    completeMagicLink()
      .then(({ next }) => {
        setStatus('done');
        router.replace(next);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Could not complete sign-in');
      });
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--ink)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          padding: '90px 28px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <Brand />
        <div>
          <Eyebrow>SIGN IN · FINISHING UP</Eyebrow>
          <h1
            className="display"
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginTop: 8,
              marginBottom: 6,
            }}
          >
            {status === 'completing' && 'Signing you in…'}
            {status === 'done' && 'You’re in.'}
            {status === 'error' && 'Something went wrong.'}
            {status === 'pending' && 'Checking your link…'}
          </h1>
          {error && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-on-dark-mute)',
                lineHeight: 1.5,
                marginTop: 8,
              }}
            >
              {error}
            </p>
          )}
          {status === 'error' && (
            <Link
              href="/auth"
              className="btn btn-lime"
              style={{ marginTop: 18, padding: '12px 18px', fontSize: 13 }}
            >
              Back to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
