import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as fbSignOut,
} from 'firebase/auth';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebase } from './firebase';

const EMAIL_KEY = 'pact:emailForSignIn';

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

/**
 * Send a sign-in link to `email`. The link's actionUrl points at the web
 * /auth/finish page with a `mobile=<deep-link>` query param. When the user
 * taps the email link, Firebase validates the token, bounces to the web
 * page, and the web page redirects into the mobile deep-link scheme. The
 * mobile app catches that URL via `Linking.addEventListener('url', ...)`
 * and finishes sign-in by calling `tryCompleteMagicLink(url)`.
 *
 * The bounce through web is required because Firebase only accepts HTTPS
 * (or localhost) hosts in its Authorized domains list, and our deep link
 * scheme (`exp://` in dev, `pact://` in EAS builds) isn't HTTPS.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const { auth } = getFirebase();
  const mobileReturnUrl = Linking.createURL('/auth/finish');
  const actionUrl = `${API_BASE}/auth/finish?mobile=${encodeURIComponent(mobileReturnUrl)}`;
  await sendSignInLinkToEmail(auth, email, { url: actionUrl, handleCodeInApp: true });
  await AsyncStorage.setItem(EMAIL_KEY, email);
}

/**
 * If `url` is a Firebase email-link sign-in URL, complete sign-in.
 * Returns `{ ok: true }` on success, `{ ok: false }` if the URL isn't a
 * sign-in link, or `{ ok: false, error }` on failure.
 *
 * On success, AsyncStorage's email key is cleared and Firebase's
 * onAuthStateChanged fires — the AuthProvider picks that up and the
 * sign-in screen redirects via its existing <Redirect> guard.
 */
export async function tryCompleteMagicLink(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const { auth } = getFirebase();
  if (!isSignInWithEmailLink(auth, url)) return { ok: false };

  const email = await AsyncStorage.getItem(EMAIL_KEY);
  if (!email) {
    return {
      ok: false,
      error: 'No saved email. Request a fresh link from this device.',
    };
  }

  try {
    await signInWithEmailLink(auth, email, url);
    await AsyncStorage.removeItem(EMAIL_KEY);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed' };
  }
}

export async function clearPendingEmail(): Promise<void> {
  await AsyncStorage.removeItem(EMAIL_KEY);
}

export async function signOut() {
  const { auth } = getFirebase();
  await fbSignOut(auth);
}
