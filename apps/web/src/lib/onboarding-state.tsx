'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type OnboardingState = {
  inviteCode: string;
  selectedContactIds: string[];
  selectedGoalIds: string[];
  toggleContact: (id: string) => void;
  toggleGoal: (id: string) => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

const STORAGE_KEY = 'pact:onboarding';

const PACT_PREFIXES = ['HAYES', 'KEMP', 'NORTH', 'OAK', 'IRON', 'PINE', 'WOLF', 'ASH'];

function generateInviteCode(): string {
  const prefix = PACT_PREFIXES[Math.floor(Math.random() * PACT_PREFIXES.length)];
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${suffix}`;
}

type Persisted = {
  inviteCode: string;
  selectedContactIds: string[];
  selectedGoalIds: string[];
};

function loadPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (
      typeof parsed.inviteCode === 'string'
      && Array.isArray(parsed.selectedContactIds)
      && Array.isArray(parsed.selectedGoalIds)
    ) {
      return parsed as Persisted;
    }
  } catch {
    // ignore
  }
  return null;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Stable defaults during SSR; rehydrate from localStorage after mount to
  // avoid hydration mismatches and to survive the magic-link round-trip.
  const [inviteCode, setInviteCode] = useState('PACT-XXXX');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(['sa']);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(['lift', 'protein']);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      setInviteCode(persisted.inviteCode);
      setSelectedContactIds(persisted.selectedContactIds);
      setSelectedGoalIds(persisted.selectedGoalIds);
    } else {
      setInviteCode(generateInviteCode());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ inviteCode, selectedContactIds, selectedGoalIds }),
    );
  }, [hydrated, inviteCode, selectedContactIds, selectedGoalIds]);

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

export function clearPersistedOnboarding() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
