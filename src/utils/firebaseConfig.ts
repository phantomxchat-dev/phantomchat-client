import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

/**
 * Firebase web configuration is public client configuration, not a secret.
 * Keep the real project values in the deployment provider's VITE_* variables
 * and protect all data with Firebase Security Rules and API-side authorization.
 */
const env = import.meta.env;
const missingConfig = "not-configured.invalid";

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "NOT_CONFIGURED",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || missingConfig,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || `https://${missingConfig}`,
  projectId: env.VITE_FIREBASE_PROJECT_ID || missingConfig,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || missingConfig,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "0",
  appId: env.VITE_FIREBASE_APP_ID || "1:0:web:not-configured",
};

export const firebaseIsConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_DATABASE_URL &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID
);

if (!firebaseIsConfigured && typeof console !== "undefined") {
  console.warn(
    "PhantomChat Firebase is not configured. Add the required VITE_FIREBASE_* variables before enabling realtime features."
  );
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app, firebaseConfig.databaseURL);
export const storage = getStorage(app);
