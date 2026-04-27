'use client';

import { Icon } from '@/components/primitives';
import { StepFooter } from '@/components/onboarding/StepFooter';
import { useOnboarding } from '@/lib/onboarding-state';
import { GOAL_OPTIONS } from '@/lib/mock';

export default function GoalsPage() {
  const { selectedGoalIds, toggleGoal } = useOnboarding();

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
          STEP 3 OF 4 · YOUR PACT
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
          What are you<br />working toward?
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(245,243,238,0.55)', margin: 0 }}>
          Pick 2–4. Your crew sees the same.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 22,
          }}
        >
          {GOAL_OPTIONS.map((goal) => {
            const on = selectedGoalIds.includes(goal.id);
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => toggleGoal(goal.id)}
                style={{
                  background: on ? '#1a1916' : 'transparent',
                  border: `1.5px solid ${on ? goal.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16,
                  padding: '14px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  textAlign: 'left',
                  color: 'inherit',
                  font: 'inherit',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: on ? goal.color : 'rgba(255,255,255,0.06)',
                    color: on ? '#0a0a0a' : 'rgba(245,243,238,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Icon name={goal.icon} size={18} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{goal.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(245,243,238,0.5)', marginTop: 2 }}>
                  {goal.sub}
                </div>
                {on && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      background: goal.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="check" size={11} color="#0a0a0a" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <StepFooter
        step={3}
        href="/onboarding/pact"
        label={`Continue · ${selectedGoalIds.length} picked`}
      />
    </>
  );
}
