import 'server-only';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let _app: App | undefined;
let _auth: Auth | undefined;

export function getAdminAuth(): Auth {
  if (_auth) return _auth;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK not configured — set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in apps/web/.env.local',
    );
  }

  _app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

  _auth = getAuth(_app);
  return _auth;
}

export type VerifiedUser = {
  uid: string;
  email: string | null;
};

export async function verifyAuthHeader(header: string | null): Promise<VerifiedUser> {
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new Error('Missing bearer token');
  }
  const token = header.slice(7).trim();
  if (!token) throw new Error('Empty bearer token');

  const decoded = await getAdminAuth().verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email ?? null };
}
