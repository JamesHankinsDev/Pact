'use client';

import Link from 'next/link';
import { Avatar } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/auth';

export function HomeAuthBar() {
  const { user, profile, loading, configured } = useAuth();

  if (loading) {
    return <span style={dim}>…</span>;
  }

  if (!configured) {
    return (
      <span style={dim} title="Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local">
        Firebase not configured
      </span>
    );
  }

  if (user && profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials={profile.initials} color={profile.color} size={26} />
        <span style={{ fontSize: 13, color: 'var(--text-on-dark)' }}>{profile.displayName}</span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="btn btn-ghost-dark"
          style={{ padding: '6px 12px', fontSize: 12 }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/auth"
      className="btn btn-ghost-dark"
      style={{ padding: '8px 14px', fontSize: 13 }}
    >
      Sign in
    </Link>
  );
}

const dim = {
  fontSize: 11,
  fontFamily: 'var(--f-mono)',
  color: 'var(--text-on-dark-faint)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.14em',
};
