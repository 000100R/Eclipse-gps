import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore';

let firebaseApp: FirebaseApp | null = null;
let realtimeDb: Database | null = null;
let firestoreDb: Firestore | null = null;

const getFirebaseConfig = () => {
  // Vite client-side environment variables
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL;

  if (!apiKey || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    databaseURL,
  };
};

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  const config = getFirebaseConfig();
  if (!config) {
    throw new Error('Firebase is not configured. Please provide VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID environment variables.');
  }

  if (getApps().length > 0) {
    firebaseApp = getApp();
  } else {
    firebaseApp = initializeApp(config);
  }

  return firebaseApp;
}

export function getFirebaseDatabase(): Database {
  if (realtimeDb) return realtimeDb;

  const app = getFirebaseApp();
  const config = getFirebaseConfig();
  
  realtimeDb = getDatabase(app, config?.databaseURL || undefined);
  return realtimeDb;
}

export function getFirebaseFirestore(): Firestore {
  if (firestoreDb) return firestoreDb;

  const app = getFirebaseApp();
  firestoreDb = getFirestore(app);
  return firestoreDb;
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}
