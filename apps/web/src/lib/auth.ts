'use client';

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as fbSignOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { getFirebase } from './firebase';

const EMAIL_KEY = 'pact:emailForSignIn';
const NEXT_KEY = 'pact:signInNextUrl';

/* ── Google ───────────────────────────────────────────────────────────── */

export async function signInWithGoogle() {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

/* ── Email link (magic link) ──────────────────────────────────────────── */

export async function sendMagicLink(email: string, nextUrl: string) {
  const { auth } = getFirebase();
  const url = `${window.location.origin}/auth/finish`;
  await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
  window.localStorage.setItem(EMAIL_KEY, email);
  window.localStorage.setItem(NEXT_KEY, nextUrl);
}

export function pendingMagicLinkUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const { auth } = getFirebase();
  return isSignInWithEmailLink(auth, window.location.href) ? window.location.href : null;
}

export async function completeMagicLink(): Promise<{ next: string }> {
  const { auth } = getFirebase();
  const href = window.location.href;

  if (!isSignInWithEmailLink(auth, href)) {
    throw new Error('Not a valid sign-in link');
  }

  let email = window.localStorage.getItem(EMAIL_KEY);
  if (!email) {
    // User opened the link on a different device — ask them to confirm.
    email = window.prompt('Confirm the email you signed in with') ?? '';
  }
  if (!email) throw new Error('Email required to finish sign-in');

  await signInWithEmailLink(auth, email, href);
  const next = window.localStorage.getItem(NEXT_KEY) ?? '/';
  window.localStorage.removeItem(EMAIL_KEY);
  window.localStorage.removeItem(NEXT_KEY);
  return { next };
}

/* ── Phone ────────────────────────────────────────────────────────────── */

let _verifier: RecaptchaVerifier | null = null;

export function getRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  const { auth } = getFirebase();
  if (_verifier) return _verifier;
  _verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return _verifier;
}

export function clearRecaptchaVerifier() {
  _verifier?.clear();
  _verifier = null;
}

export async function sendPhoneCode(
  phoneNumber: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const { auth } = getFirebase();
  const verifier = getRecaptchaVerifier(containerId);
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyPhoneCode(confirmation: ConfirmationResult, code: string) {
  const result = await confirmation.confirm(code);
  clearRecaptchaVerifier();
  return result;
}

/* ── Sign out ─────────────────────────────────────────────────────────── */

export async function signOut() {
  const { auth } = getFirebase();
  await fbSignOut(auth);
}
