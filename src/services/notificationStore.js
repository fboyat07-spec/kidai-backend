import { db, isFirebaseReady } from "./firebaseAdmin.js";

const prefsByUser = new Map();
const PREF_DOC_ID = "notificationPreferences";

function defaultPrefs() {
  return {
    enabled: true,
    quietHours: { start: "20:00", end: "07:00" },
    channels: { push: true, email: false, inApp: true },
    maxPerDay: 2,
    updatedAt: new Date().toISOString()
  };
}

function normalizePrefs(raw = {}) {
  const fallback = defaultPrefs();
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : fallback.enabled,
    quietHours: {
      start: String(raw.quietHours?.start || fallback.quietHours.start),
      end: String(raw.quietHours?.end || fallback.quietHours.end)
    },
    channels: {
      push: raw.channels?.push !== undefined ? Boolean(raw.channels.push) : fallback.channels.push,
      email: raw.channels?.email !== undefined ? Boolean(raw.channels.email) : fallback.channels.email,
      inApp: raw.channels?.inApp !== undefined ? Boolean(raw.channels.inApp) : fallback.channels.inApp
    },
    maxPerDay: Number.isFinite(Number(raw.maxPerDay)) ? Number(raw.maxPerDay) : fallback.maxPerDay,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : fallback.updatedAt
  };
}

function prefsDoc(userId) {
  return db.collection("users").doc(userId).collection("settings").doc(PREF_DOC_ID);
}

async function readFirestorePrefs(userId) {
  if (!isFirebaseReady() || !db) return null;

  try {
    const snap = await prefsDoc(userId).get();
    if (!snap.exists) return null;
    return normalizePrefs(snap.data() || {});
  } catch (err) {
    console.warn("Notification prefs firestore fallback:", err.message);
    return null;
  }
}

async function writeFirestorePrefs(userId, prefs) {
  if (!isFirebaseReady() || !db) return false;

  try {
    await prefsDoc(userId).set(prefs, { merge: true });
    return true;
  } catch (err) {
    console.warn("Notification prefs firestore write fallback:", err.message);
    return false;
  }
}

export async function getNotificationPrefs(userId) {
  const remote = await readFirestorePrefs(userId);
  if (remote) {
    prefsByUser.set(userId, remote);
    return remote;
  }

  if (!prefsByUser.has(userId)) {
    prefsByUser.set(userId, defaultPrefs());
  }

  return prefsByUser.get(userId);
}

export async function updateNotificationPrefs(userId, updates = {}) {
  const current = await getNotificationPrefs(userId);
  const next = normalizePrefs({
    ...current,
    ...updates,
    channels: {
      ...current.channels,
      ...(updates.channels && typeof updates.channels === "object" ? updates.channels : {})
    },
    quietHours: {
      ...current.quietHours,
      ...(updates.quietHours && typeof updates.quietHours === "object" ? updates.quietHours : {})
    },
    updatedAt: new Date().toISOString()
  });

  const stored = await writeFirestorePrefs(userId, next);
  if (!stored) {
    prefsByUser.set(userId, next);
  } else {
    prefsByUser.set(userId, next);
  }

  return next;
}
