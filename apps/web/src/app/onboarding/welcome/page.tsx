import Link from 'next/link';
import { AvatarStack, Icon } from '@/components/primitives';
import { PACT_MEMBERS } from '@/lib/mock';

export default function WelcomePage() {
  return (
    <>
      <div
        style={{
          flex: 1,
          padding: '90px 28px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: '#daff3f',
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
          }}
        >
          ◆ PACT · v0.1
        </div>

        <h1
          className="display"
          style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            marginTop: 24,
            marginBottom: 0,
          }}
        >
          You don&rsquo;t<br />break a pact<br />with{' '}
          <span style={{ color: '#daff3f' }}>your people</span>.
        </h1>

        <p
          style={{
            fontSize: 15,
            color: 'rgba(245,243,238,0.65)',
            marginTop: 22,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          A shared dashboard for households and crews. Train, eat, sleep, journal — together.
        </p>

        <div
          style={{
            marginTop: 'auto',
            marginBottom: 32,
            background: '#1a1916',
            borderRadius: 22,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <AvatarStack
            members={PACT_MEMBERS.slice(0, 4).map((m) => ({ initials: m.initials, color: m.color }))}
            size={32}
            dark
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>4,210 crews</div>
            <div style={{ fontSize: 11, color: 'rgba(245,243,238,0.5)' }}>
              training together this week
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px 60px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/onboarding/crew" className="btn btn-lime" style={{ padding: '16px 20px', fontSize: 15 }}>
          Make a pact
          <Icon name="arrow" size={16} color="#0a0a0a" strokeWidth={2.5} />
        </Link>
        <Link href="/onboarding/join" className="btn btn-ghost-dark" style={{ padding: '14px 20px', fontSize: 14 }}>
          I have an invite code
        </Link>
      </div>
    </>
  );
}
