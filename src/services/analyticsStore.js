import { db, isFirebaseReady } from "./firebaseAdmin.js";

const eventsByUser = new Map();
const MAX_EVENTS_PER_USER = 5000;

function ensureUserBucket(userId) {
  if (!eventsByUser.has(userId)) {
    eventsByUser.set(userId, []);
  }
  return eventsByUser.get(userId);
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === "object" ? metadata : {};
}

function normalizeEvent(event = {}) {
  const createdAtMs = Number(event.createdAtMs || Date.now());
  const createdAt =
    typeof event.createdAt === "string" && event.createdAt
      ? event.createdAt
      : new Date(createdAtMs).toISOString();

  return {
    id: String(event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    type: String(event.type || "unknown"),
    childId: event.childId || null,
    metadata: normalizeMetadata(event.metadata),
    createdAt,
    createdAtMs
  };
}

function trimBucket(bucket) {
  if (bucket.length > MAX_EVENTS_PER_USER) {
    bucket.splice(0, bucket.length - MAX_EVENTS_PER_USER);
  }
}

function userEventsCollection(userId) {
  return db.collection("users").doc(userId).collection("events");
}

async function writeFirestoreEvent(userId, item) {
  if (!isFirebaseReady() || !db) return false;

  try {
    await userEventsCollection(userId).doc(item.id).set(item, { merge: true });
    return true;
  } catch (err) {
    console.warn("Firestore event write fallback:", err.message);
    return false;
  }
}

async function readFirestoreEvents(userId, days) {
  if (!isFirebaseReady() || !db) return null;

  try {
    const fromMs = Date.now() - Math.max(1, Number(days || 7)) * 24 * 60 * 60 * 1000;
    const snap = await userEventsCollection(userId)
      .where("createdAtMs", ">=", fromMs)
      .orderBy("createdAtMs", "asc")
      .limit(MAX_EVENTS_PER_USER)
      .get();

    return snap.docs.map((doc) => normalizeEvent({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("Firestore event read fallback:", err.message);
    return null;
  }
}

export async function recordEvent(userId, event = {}) {
  const item = normalizeEvent(event);
  const stored = await writeFirestoreEvent(userId, item);
  if (stored) {
    return item;
  }

  const bucket = ensureUserBucket(userId);
  bucket.push(item);
  trimBucket(bucket);
  return item;
}

export async function ingestEvents(userId, events = []) {
  if (!Array.isArray(events)) return [];

  const accepted = [];
  for (const event of events.slice(0, MAX_EVENTS_PER_USER)) {
    accepted.push(await recordEvent(userId, event));
  }

  return accepted;
}

export async function listEvents(userId, days = 7) {
  const firestoreEvents = await readFirestoreEvents(userId, days);
  if (firestoreEvents) {
    return firestoreEvents;
  }

  const bucket = ensureUserBucket(userId);
  const fromMs = Date.now() - Math.max(1, Number(days || 7)) * 24 * 60 * 60 * 1000;
  return bucket
    .map((event) => normalizeEvent(event))
    .filter((event) => event.createdAtMs >= fromMs)
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
}

function computeStreakDays(events) {
  const dayKeys = new Set(
    events.map((event) => {
      const date = new Date(event.createdAtMs);
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
        .toISOString()
        .slice(0, 10);
    })
  );

  let streak = 0;
  for (let i = 0; i < 60; i += 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    if (dayKeys.has(key)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export async function summarizeEvents(userId, days = 7) {
  const events = await listEvents(userId, days);
  const countByType = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});

  const lessonCompletions = countByType.lesson_completed || 0;
  const quizzes = countByType.exercise_submitted || 0;
  const quizCorrect = events.filter((event) => event.type === "exercise_submitted" && event.metadata?.isCorrect)
    .length;
  const quizSuccessRate = quizzes ? Math.round((quizCorrect / quizzes) * 100) : 0;
  const mistakeReviews = countByType.mistake_reviewed || 0;
  const sessions = countByType.session_start || 0;
  const avgSessionMinutes = Number(
    (
      events
        .filter((event) => event.type === "session_end")
        .map((event) => Number(event.metadata?.durationMin || 0))
        .reduce((sum, value) => sum + value, 0) /
      Math.max(countByType.session_end || 1, 1)
    ).toFixed(1)
  );

  const notificationsSent = countByType.notification_sent || 0;
  const notificationsOpened = countByType.notification_opened || 0;
  const notificationResponseRate = notificationsSent
    ? Math.round((notificationsOpened / notificationsSent) * 100)
    : 0;

  const lastEventMs = events.length ? events[events.length - 1].createdAtMs : 0;
  const hoursSinceLastEvent = lastEventMs
    ? Math.round((Date.now() - lastEventMs) / (1000 * 60 * 60))
    : 999;

  const dropRisk = hoursSinceLastEvent > 48 ? "high" : hoursSinceLastEvent > 24 ? "medium" : "low";

  return {
    days: Math.max(1, Number(days || 7)),
    totalEvents: events.length,
    sessions,
    lessonCompletions,
    quizSuccessRate,
    mistakeReviews,
    avgSessionMinutes,
    streakDays: computeStreakDays(events),
    notificationResponseRate,
    dropRisk,
    hoursSinceLastEvent,
    countByType
  };
}
