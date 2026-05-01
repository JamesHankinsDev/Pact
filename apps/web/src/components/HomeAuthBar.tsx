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
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 10px 4px 4px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            textDecoration: 'none',
            color: 'var(--text-on-dark)',
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
          className="auth-bar-avatar"
        >
          <Avatar initials={profile.initials} color={profile.color} size={26} />
          <span style={{ fontSize: 13 }}>{profile.displayName}</span>
        </Link>
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
