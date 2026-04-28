import { AvatarStack, Brand, Card, Chip, Eyebrow, Icon, StatNumeral } from '@/components/primitives';
import { HomeAuthBar } from '@/components/HomeAuthBar';
import { HomeCtas } from '@/components/HomeCtas';

const CREW = [
  { initials: 'J', color: '#daff3f' },
  { initials: 'S', color: '#ff6b4a' },
  { initials: 'M', color: '#7cd4ff' },
  { initials: 'E', color: '#c58cff' },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--ink)',
        color: 'var(--text-on-dark)',
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Brand />
          <HomeAuthBar />
        </header>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Eyebrow>welcome</Eyebrow>
          <h1
            style={{
              fontFamily: 'var(--f-display)',
              fontWeight: 800,
              fontSize: 56,
              lineHeight: 1.0,
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            You don&rsquo;t break a pact{' '}
            <span style={{ color: 'var(--lime)' }}>with your people.</span>
          </h1>
          <p style={{ color: 'var(--text-on-dark-mute)', fontSize: 15, margin: 0, maxWidth: 520 }}>
            A shared dashboard for households and crews. The web app and mobile app are next.
            This page just verifies tokens, type, and primitives are wired correctly.
          </p>
        </section>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>this week</Eyebrow>
            <Chip color="lime">Week 17</Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <div style={{ color: 'var(--text-on-dark-mute)', fontSize: 12, marginBottom: 4 }}>
                The Hayes Pact
              </div>
              <StatNumeral value={5} unit="days in" size={64} />
            </div>
            <AvatarStack members={CREW} size={36} dark />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip color="ghost"><Icon name="dumbbell" size={12} /> 24 workouts</Chip>
            <Chip color="ghost"><Icon name="bowl" size={12} /> 92% protein</Chip>
            <Chip color="ghost"><Icon name="pill" size={12} /> 7/7 meds</Chip>
            <Chip color="ghost"><Icon name="book" size={12} /> 3 practices</Chip>
          </div>
        </Card>

        <HomeCtas />

        <footer style={{ color: 'var(--text-on-dark-faint)', fontSize: 12 }}>
          Next up: the Expo mobile app.
        </footer>
      </div>
    </main>
  );
}
