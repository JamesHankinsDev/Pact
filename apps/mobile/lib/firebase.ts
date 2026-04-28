import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
// `firebase/auth` re-exports `initializeAuth`, `getAuth`, `getReactNativePersistence`.
// In Expo SDK 54 / Firebase 11, the RN persistence helper is bundled with `firebase/auth`.
import {
  initializeAuth,
  getAuth,
  // @ts-expect-error — not in published types yet for v11, but exists at runtime.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey);
}

export function getFirebase(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
} {
  if (!config.apiKey) {
    throw new Error(
      'Firebase config missing — set EXPO_PUBLIC_FIREBASE_* env vars in apps/mobile/.env',
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    // initializeAuth must run only once per app; if already created (e.g. fast refresh)
    // fall back to getAuth.
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      auth = getAuth(app);
    }
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { app, auth: auth!, db: db!, storage: storage! };
}
