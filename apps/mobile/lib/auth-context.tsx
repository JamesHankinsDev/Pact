import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase, isFirebaseConfigured } from './firebase';
import { ensureUserProfile, type UserProfile } from './user-profile';

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  configured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    configured: isFirebaseConfigured(),
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setState({ user: null, profile: null, loading: false, configured: false });
      return;
    }

    const { auth } = getFirebase();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, profile: null, loading: false, configured: true });
        return;
      }
      try {
        const profile = await ensureUserProfile(user);
        setState({ user, profile, loading: false, configured: true });
      } catch (err) {
        console.warn('Failed to load user profile', err);
        setState({ user, profile: null, loading: false, configured: true });
      }
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
