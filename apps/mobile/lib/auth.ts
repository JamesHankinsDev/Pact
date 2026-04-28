import { useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import { getFirebase } from './firebase';

// Required so the web-browser-based OAuth flow finishes when the redirect lands.
WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/**
 * Hook-based Google sign-in. Returns `{ signIn, isReady }`. Call signIn()
 * from a press handler — opens the system browser/in-app browser to Google,
 * then exchanges the id_token for a Firebase credential.
 */
export function useGoogleSignIn(): {
  signIn: () => Promise<{ ok: boolean; error?: string }>;
  isReady: boolean;
} {
  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: WEB_CLIENT_ID,
    iosClientId: WEB_CLIENT_ID,
    androidClientId: WEB_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  });

  const signIn = useCallback(async () => {
    if (!WEB_CLIENT_ID) {
      return { ok: false, error: 'Google OAuth not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.' };
    }
    try {
      const result = await promptAsync();
      if (result.type !== 'success') {
        return { ok: false, error: result.type === 'cancel' ? 'Cancelled' : 'Sign-in failed' };
      }
      const idToken = result.params.id_token ?? result.authentication?.idToken;
      if (!idToken) return { ok: false, error: 'No id_token returned from Google' };

      const { auth } = getFirebase();
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed' };
    }
  }, [promptAsync]);

  return { signIn, isReady: !!request };
}

export async function signOut() {
  const { auth } = getFirebase();
  await fbSignOut(auth);
}
