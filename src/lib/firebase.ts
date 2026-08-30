// Client-side Firebase (Spark/free plan) for live view/like counters on trip
// share pages -- see TripView.tsx and docs/firebase-setup.md. Deliberately
// additive: does not touch Supabase/auth, just a small Firestore doc per
// trip (`tripStats/{slug}`) for social-proof counters. All config values
// are NEXT_PUBLIC_* since Firebase's web config is meant to be public --
// access control comes from Firestore security rules, not from hiding this.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, doc, setDoc, updateDoc, increment, onSnapshot, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function getDb(): Firestore | null {
  if (!firebaseConfigured()) return null;
  if (!db) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

export type TripStats = { views: number; likes: number };

// Subscribes to a trip's live view/like counts. Returns an unsubscribe
// function, or null if Firebase isn't configured (caller should no-op).
export function watchTripStats(slug: string, onUpdate: (stats: TripStats) => void): (() => void) | null {
  const database = getDb();
  if (!database) return null;
  const ref = doc(database, "tripStats", slug);
  return onSnapshot(ref, (snap) => {
    const data = snap.data();
    onUpdate({ views: (data?.views as number) ?? 0, likes: (data?.likes as number) ?? 0 });
  });
}

// updateDoc throws "not-found" specifically when the target doc doesn't
// exist yet -- any other error code (network blip, permission edge case)
// must NOT fall through to the setDoc-with-merge below, since that would
// silently reset the other counter field (likes when recording a view, or
// vice versa) back to 0 instead of just failing this one write.
function isNotFoundError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "not-found";
}

export async function recordView(slug: string): Promise<void> {
  const database = getDb();
  if (!database) return;
  const ref = doc(database, "tripStats", slug);
  try {
    await updateDoc(ref, { views: increment(1) });
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
    // Doc doesn't exist yet on this trip's first-ever view.
    await setDoc(ref, { views: 1, likes: 0 }, { merge: true });
  }
}

const LIKED_KEY = "trackingphuot_liked_trips";

// One like per browser, enforced client-side via localStorage -- same trust
// model as this app's edit-token-in-localStorage ownership already uses
// elsewhere, not meant to resist a determined bad actor, just casual
// repeat-clicking.
export function hasLiked(slug: string): boolean {
  try {
    const liked: string[] = JSON.parse(localStorage.getItem(LIKED_KEY) || "[]");
    return liked.includes(slug);
  } catch {
    return false;
  }
}

export async function recordLike(slug: string): Promise<void> {
  if (hasLiked(slug)) return;
  const database = getDb();
  if (!database) return;
  const ref = doc(database, "tripStats", slug);
  try {
    await updateDoc(ref, { likes: increment(1) });
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
    await setDoc(ref, { views: 0, likes: 1 }, { merge: true });
  }
  try {
    const liked: string[] = JSON.parse(localStorage.getItem(LIKED_KEY) || "[]");
    liked.push(slug);
    localStorage.setItem(LIKED_KEY, JSON.stringify(liked));
  } catch {
    // localStorage unavailable (private mode etc.) -- like still recorded
    // server-side, just not remembered as "already liked" on this browser.
  }
}
