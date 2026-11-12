import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/** Shared default app: SRS-007 must use this same app for Firebase Auth. */
export function getFirebaseServices() {
  if (!getApps().some((app) => app.name === '[DEFAULT]')) {
    const options = {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    };
    if (!options.apiKey || !options.authDomain || !options.projectId || !options.appId) {
      throw new Error('firebase/not-configured');
    }
    initializeApp(options);
  }
  const app = getApp();
  return { app, db: getFirestore(app) };
}
