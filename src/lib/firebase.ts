import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const normalizeEnvValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || undefined;
  }

  return trimmed;
};

const env = {
  VITE_FIREBASE_API_KEY: normalizeEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  VITE_FIREBASE_AUTH_DOMAIN: normalizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  VITE_FIREBASE_PROJECT_ID: normalizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  VITE_FIREBASE_STORAGE_BUCKET: normalizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  VITE_FIREBASE_MESSAGING_SENDER_ID: normalizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  VITE_FIREBASE_APP_ID: normalizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
  VITE_FIREBASE_MEASUREMENT_ID: normalizeEnvValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

export const missingRequiredFirebaseEnv = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !env[key]);

// We don't throw here anymore to allow the app to initialize and show a meaningful error UI
const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  ...(env.VITE_FIREBASE_MEASUREMENT_ID ? { measurementId: env.VITE_FIREBASE_MEASUREMENT_ID } : {}),
};

// Only initialize if we have the minimum requirements
const isConfigValid = missingRequiredFirebaseEnv.length === 0;
const app = isConfigValid ? initializeApp(firebaseConfig) : undefined;

export const auth = (() => {
  if (!app) return undefined as any;
  try {
    return getAuth(app);
  } catch (error) {
    const firebaseAuthError = error as { code?: string; message?: string };
    if (firebaseAuthError?.code === 'auth/invalid-api-key') {
      console.error(
        '[Firebase] auth/invalid-api-key: VITE_FIREBASE_API_KEY is invalid for this Firebase project or origin.',
      );
    }
    throw error;
  }
})();

export const db = app ? getFirestore(app) : undefined as any;
export const storage = app ? getStorage(app) : undefined as any;
export const fbFunctions = app ? getFunctions(app) : undefined as any;

// Enable offline persistence (IndexedDB) - non-fatal if already enabled or in a second tab
if (db) {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open - persistence only works in one tab at a time
      console.warn('[Firebase] Offline persistence unavailable: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // Browser doesn't support IndexedDB
      console.warn('[Firebase] Offline persistence not supported in this browser');
    } else {
      console.error('[Firebase] Unexpected error enabling offline persistence:', err);
    }
  });
}
