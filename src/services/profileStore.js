import { db, isFirebaseReady } from "./firebaseAdmin.js";

const memoryUsers = new Map();
const memoryChildrenByUser = new Map();

function nowIso() {
  return new Date().toISOString();
}

function getMemoryUser(userId) {
  if (!memoryUsers.has(userId)) {
    memoryUsers.set(userId, {
      id: userId,
      displayName: "",
      weeklyGoal: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }
  return memoryUsers.get(userId);
}

function getMemoryChildrenMap(userId) {
  if (!memoryChildrenByUser.has(userId)) {
    memoryChildrenByUser.set(userId, new Map());
  }
  return memoryChildrenByUser.get(userId);
}

function mapChildPayload(payload, existing = null) {
  return {
    name: payload.name?.trim() || existing?.name || "",
    age: Number.isInteger(payload.age) ? payload.age : existing?.age || null,
    grade: payload.grade?.trim() || "",
    interests: Array.isArray(payload.interests)
      ? payload.interests
      : existing?.interests || [],
    updatedAt: nowIso(),
    createdAt: existing?.createdAt || nowIso()
  };
}

export async function getUserProfile(userId) {
  if (isFirebaseReady() && db) {
    try {
      const ref = db.collection("users").doc(userId);
      const snap = await ref.get();
      if (!snap.exists) {
        const user = {
          id: userId,
          displayName: "",
          weeklyGoal: "",
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        await ref.set(user, { merge: true });
        return user;
      }
      return { id: userId, ...snap.data() };
    } catch (err) {
      console.warn("Firestore user read fallback:", err.message);
    }
  }

  return getMemoryUser(userId);
}

export async function updateUserProfile(userId, updates) {
  const user = {
    ...(await getUserProfile(userId)),
    ...updates,
    id: userId,
    updatedAt: nowIso()
  };

  if (isFirebaseReady() && db) {
    try {
      await db.collection("users").doc(userId).set(user, { merge: true });
      return user;
    } catch (err) {
      console.warn("Firestore user write fallback:", err.message);
    }
  }

  memoryUsers.set(userId, user);
  return user;
}

export async function listChildren(userId) {
  if (isFirebaseReady() && db) {
    try {
      const snap = await db
        .collection("users")
        .doc(userId)
        .collection("children")
        .orderBy("createdAt", "asc")
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn("Firestore children list fallback:", err.message);
    }
  }

  return Array.from(getMemoryChildrenMap(userId).values());
}

export async function createChild(userId, payload) {
  const childData = mapChildPayload(payload);

  if (isFirebaseReady() && db) {
    try {
      const ref = db.collection("users").doc(userId).collection("children").doc();
      const child = { id: ref.id, parentId: userId, ...childData };
      await ref.set(child);
      return child;
    } catch (err) {
      console.warn("Firestore child create fallback:", err.message);
    }
  }

  const id = `child_${Math.random().toString(36).slice(2, 10)}`;
  const child = { id, parentId: userId, ...childData };
  getMemoryChildrenMap(userId).set(id, child);
  return child;
}

export async function getChild(userId, childId) {
  if (isFirebaseReady() && db) {
    try {
      const snap = await db.collection("users").doc(userId).collection("children").doc(childId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.warn("Firestore child read fallback:", err.message);
    }
  }

  return getMemoryChildrenMap(userId).get(childId) || null;
}

export async function updateChild(userId, childId, payload) {
  const existing = await getChild(userId, childId);
  if (!existing) return null;

  const child = {
    ...existing,
    ...mapChildPayload(payload, existing),
    id: childId,
    parentId: userId
  };

  if (isFirebaseReady() && db) {
    try {
      await db.collection("users").doc(userId).collection("children").doc(childId).set(child, {
        merge: true
      });
      return child;
    } catch (err) {
      console.warn("Firestore child update fallback:", err.message);
    }
  }

  getMemoryChildrenMap(userId).set(childId, child);
  return child;
}
