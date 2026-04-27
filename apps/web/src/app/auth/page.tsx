import Link from 'next/link';
import { Suspense } from 'react';
import { Brand, Eyebrow } from '@/components/primitives';
import { SignInPanel } from '@/components/auth/SignInPanel';

type SearchParams = Promise<{ next?: string }>;

export default async function AuthPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  const safeNext = sanitizeNext(next);

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
          padding: '70px 28px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link
            href="/"
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--text-on-dark-mute)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              textDecoration: 'none',
            }}
          >
            ← BACK
          </Link>
        </div>

        <div>
          <Eyebrow>SIGN IN</Eyebrow>
          <h1
            className="display"
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              marginTop: 8,
              marginBottom: 6,
            }}
          >
            Welcome back.
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-on-dark-mute)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Pick a method. We&rsquo;ll keep you signed in on this device.
          </p>
        </div>

        <Suspense fallback={null}>
          <SignInPanel next={safeNext} />
        </Suspense>
      </div>
    </div>
  );
}

/** Allow only same-origin paths. Prevents open-redirect via ?next=https://evil. */
function sanitizeNext(next: string | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}
