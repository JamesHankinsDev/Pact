'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type OnboardingState = {
  inviteCode: string;
  selectedContactIds: string[];
  selectedGoalIds: string[];
  toggleContact: (id: string) => void;
  toggleGoal: (id: string) => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

const PACT_PREFIXES = ['HAYES', 'KEMP', 'NORTH', 'OAK', 'IRON', 'PINE', 'WOLF', 'ASH'];

function generateInviteCode(): string {
  const prefix = PACT_PREFIXES[Math.floor(Math.random() * PACT_PREFIXES.length)];
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Use a stable placeholder during SSR; randomize after mount to avoid hydration mismatch.
  const [inviteCode, setInviteCode] = useState('PACT-XXXX');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(['sa']);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(['lift', 'protein']);

  useEffect(() => {
    setInviteCode(generateInviteCode());
  }, []);

  const value = useMemo<OnboardingState>(
    () => ({
      inviteCode,
      selectedContactIds,
      selectedGoalIds,
      toggleContact: (id) =>
        setSelectedContactIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
      toggleGoal: (id) =>
        setSelectedGoalIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    }),
    [inviteCode, selectedContactIds, selectedGoalIds],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
