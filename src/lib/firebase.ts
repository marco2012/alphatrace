import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase services must not be initialised on the server (Next.js SSR/static
// generation runs client components server-side). Guard with typeof window so
// the build succeeds even without .env.local credentials.
const isClient = typeof window !== "undefined";

const app: FirebaseApp | undefined = isClient
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : undefined;

export const auth = (isClient ? getAuth(app!) : {}) as Auth;
export const db = (isClient ? getFirestore(app!) : {}) as Firestore;
