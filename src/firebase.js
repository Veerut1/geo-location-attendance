import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const runtimeEnv =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : typeof process !== "undefined" && process.env
      ? process.env
      : {};

function getLocalEnvValues() {
  if (typeof window !== "undefined") {
    return {};
  }

  try {
    const values = {};

    if (typeof process !== "undefined" && process.env) {
      for (const [key, value] of Object.entries(process.env)) {
        if (typeof value === "string") {
          values[key] = value;
        }
      }
    }

    return values;
  } catch {
    return {};
  }
}

const fileEnv = getLocalEnvValues();
const resolvedEnv = { ...fileEnv, ...runtimeEnv };

function isPlaceholderValue(value) {
  if (typeof value !== "string") {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return !normalized || normalized.includes("your-") || normalized === "geo-location-" || normalized === "al92ji";
}

function getFirebaseEnvValue(key) {
  const variants = [key];
  if (key.startsWith("VITE_")) {
    variants.push(key.replace(/^VITE_/, ""));
  }

  for (const variant of variants) {
    const value = resolvedEnv[variant];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

const firebaseConfig = {
  apiKey: getFirebaseEnvValue("VITE_FIREBASE_API_KEY"),
  authDomain: getFirebaseEnvValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getFirebaseEnvValue("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getFirebaseEnvValue("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getFirebaseEnvValue("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getFirebaseEnvValue("VITE_FIREBASE_APP_ID")
};

export const hasFirebaseConfig = !isPlaceholderValue(firebaseConfig.apiKey)
  && !isPlaceholderValue(firebaseConfig.authDomain)
  && !isPlaceholderValue(firebaseConfig.projectId)
  && !isPlaceholderValue(firebaseConfig.storageBucket)
  && !isPlaceholderValue(firebaseConfig.messagingSenderId)
  && !isPlaceholderValue(firebaseConfig.appId);

export function getFirebaseConfigError() {
  const missing = [
    ["VITE_FIREBASE_API_KEY", firebaseConfig.apiKey],
    ["VITE_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
    ["VITE_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
    ["VITE_FIREBASE_STORAGE_BUCKET", firebaseConfig.storageBucket],
    ["VITE_FIREBASE_MESSAGING_SENDER_ID", firebaseConfig.messagingSenderId],
    ["VITE_FIREBASE_APP_ID", firebaseConfig.appId]
  ].filter(([, value]) => isPlaceholderValue(value)).map(([key]) => key);

  if (!missing.length) {
    return "";
  }

  return `Firestore is not configured. Set the missing VITE_FIREBASE_* values in your .env file for your Firebase project and make sure Firestore is enabled. Missing: ${missing.join(", ")}.`;
}

let firebaseApp = null;
let firestoreDb = null;

if (hasFirebaseConfig) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
}

export { firebaseApp, firestoreDb };
