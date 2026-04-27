'use client';

import { Avatar } from '@/components/primitives';
import { StepFooter } from '@/components/onboarding/StepFooter';
import { useOnboarding } from '@/lib/onboarding-state';
import { PACT_MEMBERS } from '@/lib/mock';

const COMMITMENTS: Array<{ value: string; unit: string; cadence: string }> = [
  { value: '5',    unit: 'workouts',    cadence: 'each' },
  { value: '180g', unit: 'protein',     cadence: 'daily' },
  { value: '7',    unit: 'meds taken',  cadence: 'each' },
  { value: '3',    unit: 'practices',   cadence: 'weekly' },
];

export default function PactPage() {
  const { selectedContactIds } = useOnboarding();

  // Whoever the user picked, plus the user themselves (James), capped at 4 visible.
  const crew = PACT_MEMBERS.filter(
    (m) => m.id === 'jm' || selectedContactIds.includes(m.id),
  ).slice(0, 4);

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
                key={i}
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
      </div>

      <StepFooter step={4} href="/" label="Sign the pact" icon="check" />
    </>
  );
}
