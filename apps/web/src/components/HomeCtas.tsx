'use client';

import Link from 'next/link';
import { Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';

export function HomeCtas() {
  const { user, profile, loading } = useAuth();

  if (loading) return null;

  const inAGroup = Boolean(user && profile?.currentGroupId);

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {inAGroup ? (
        <>
          <Link href="/dashboard" className="btn btn-lime" style={{ padding: '14px 20px', fontSize: 14 }}>
            View your dashboard
            <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
          </Link>
          <Link href="/log/meal" className="btn btn-ghost-dark" style={{ padding: '14px 20px', fontSize: 14 }}>
            <Icon name="bowl" size={14} color="var(--text-on-dark)" />
            Log a meal
          </Link>
          <Link href="/workout" className="btn btn-ghost-dark" style={{ padding: '14px 20px', fontSize: 14 }}>
            <Icon name="dumbbell" size={14} color="var(--text-on-dark)" />
            Log a workout
          </Link>
          <Link href="/log/groceries" className="btn btn-ghost-dark" style={{ padding: '14px 20px', fontSize: 14 }}>
            <Icon name="cart" size={14} color="var(--text-on-dark)" />
            Scan groceries
          </Link>
          <Link href="/log/body" className="btn btn-ghost-dark" style={{ padding: '14px 20px', fontSize: 14 }}>
            <Icon name="weight" size={14} color="var(--text-on-dark)" />
            Log weight
          </Link>
        </>
      ) : (
        <>
          <Link href="/onboarding" className="btn btn-lime" style={{ padding: '14px 20px', fontSize: 14 }}>
            Make a pact
            <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
          </Link>
          <Link href="/onboarding/join" className="btn btn-ghost-dark" style={{ padding: '14px 20px', fontSize: 14 }}>
            I have an invite code
          </Link>
        </>
      )}
    </div>
  );
}
