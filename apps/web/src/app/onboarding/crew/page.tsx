'use client';

import { useState } from 'react';
import { Avatar, Eyebrow, Icon } from '@/components/primitives';
import { StepFooter } from '@/components/onboarding/StepFooter';
import { useOnboarding } from '@/lib/onboarding-state';
import { SAMPLE_CONTACTS } from '@/lib/mock';

export default function CrewPage() {
  const { inviteCode, selectedContactIds, toggleContact } = useOnboarding();
  const [copied, setCopied] = useState(false);

  const inviteUrl = `pact.app/join/${inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${inviteUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // older browsers / no permission — no-op for now
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
          STEP 2 OF 4 · YOUR PEOPLE
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
          Who&rsquo;s in the pact?
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(245,243,238,0.55)', margin: 0 }}>
          2–6 people. Partners, roommates, training buddies.
        </p>

        <div
          style={{
            background: 'rgba(218,255,63,0.06)',
            border: '1px solid rgba(218,255,63,0.2)',
            borderRadius: 16,
            padding: '14px 16px',
            marginTop: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#daff3f',
              color: '#0a0a0a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={18} color="#0a0a0a" strokeWidth={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Share invite link</div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'rgba(245,243,238,0.5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {inviteUrl}
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="btn btn-lime"
            style={{ padding: '8px 14px', fontSize: 12 }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div style={{ marginTop: 22 }}>
          <Eyebrow>FROM CONTACTS</Eyebrow>
          <div style={{ marginTop: 10 }}>
            {SAMPLE_CONTACTS.map((c, i, arr) => {
              const on = selectedContactIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleContact(c.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 0',
                    background: 'transparent',
                    border: 'none',
                    borderBottom:
                      i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Avatar initials={c.name[0]!} color={c.color} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(245,243,238,0.5)' }}>{c.sub}</div>
                  </div>
                  <span className={`tick ${on ? 'on' : ''}`}>
                    {on && <Icon name="check" size={16} color="#0a0a0a" strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <StepFooter
        step={2}
        href="/onboarding/goals"
        label={`Continue · ${selectedContactIds.length} added`}
      />
    </>
  );
}
