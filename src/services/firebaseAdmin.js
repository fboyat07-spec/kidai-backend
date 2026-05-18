import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

let firebaseReady = getApps().length > 0;

if (!firebaseReady) {
  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    });
    firebaseReady = true;
  }
}

export const isFirebaseReady = () => firebaseReady;
export const db        = firebaseReady ? getFirestore()  : null;
export const messaging = firebaseReady ? getMessaging()  : null;

export async function verifyIdToken(idToken) {
  if (!firebaseReady) return null;
  return getAuth().verifyIdToken(idToken);
}
