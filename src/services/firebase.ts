import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, initializeAuth, connectAuthEmulator } from 'firebase/auth';
// @ts-expect-error — getReactNativePersistence exists in the RN build (resolved
// via Metro's "react-native" export condition) but is missing from the public
// type declarations firebase-js-sdk ships for the plain 'firebase/auth' entry.
// See https://github.com/firebase/firebase-js-sdk/issues/9316.
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// initializeAuth + getReactNativePersistence only resolve to a real
// implementation via Metro's "react-native" package export condition (the
// actual Expo app). Under plain Node module resolution (the Jest "emulator"
// project, and Fast Refresh re-running this module) it throws, so fall back
// to getAuth — memory-only persistence there is fine since neither case
// needs auth state to survive a restart.
export const auth = (() => {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
})();

export function connectToEmulators() {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
