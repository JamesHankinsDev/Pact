'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from './firebase';

type AuthState = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const { auth } = getFirebase();
      unsub = onAuthStateChanged(auth, (user) => {
        setState({ user, loading: false });
      });
    } catch {
      // Firebase not configured yet — leave loading=false so the UI can render.
      setState({ user: null, loading: false });
    }
    return () => unsub?.();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
