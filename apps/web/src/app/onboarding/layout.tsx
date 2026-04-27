import type { ReactNode } from 'react';
import { OnboardingProvider } from '@/lib/onboarding-state';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingProvider>
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
            minHeight: '100dvh',
            background: 'var(--ink)',
            color: 'var(--text-on-dark)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {children}
        </div>
      </div>
    </OnboardingProvider>
  );
}
