import crypto from "node:crypto";
import { db, isFirebaseReady } from "./firebaseAdmin.js";

const memoryTokensByUser = new Map();

function tokenId(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getMemoryBucket(userId) {
  if (!memoryTokensByUser.has(userId)) {
    memoryTokensByUser.set(userId, new Map());
  }
  return memoryTokensByUser.get(userId);
}

export async function registerDeviceToken(userId, { token, platform = "unknown" }) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return null;

  const device = {
    id: tokenId(normalizedToken),
    token: normalizedToken,
    platform,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  if (isFirebaseReady() && db) {
    try {
      const ref = db.collection("users").doc(userId).collection("deviceTokens").doc(device.id);
      const existing = await ref.get();
      if (existing.exists) {
        device.createdAt = existing.data()?.createdAt || device.createdAt;
      }
      await ref.set(device, { merge: true });
      return device;
    } catch (err) {
      console.warn("Device token firestore fallback:", err.message);
    }
  }

  const bucket = getMemoryBucket(userId);
  const existing = bucket.get(device.id);
  if (existing) {
    device.createdAt = existing.createdAt;
  }
  bucket.set(device.id, device);
  return device;
}

export async function listDeviceTokens(userId) {
  if (isFirebaseReady() && db) {
    try {
      const snap = await db.collection("users").doc(userId).collection("deviceTokens").get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn("Device token list firestore fallback:", err.message);
    }
  }

  return Array.from(getMemoryBucket(userId).values());
}

export async function removeDeviceToken(userId, token) {
  const id = tokenId(token);

  if (isFirebaseReady() && db) {
    try {
      await db.collection("users").doc(userId).collection("deviceTokens").doc(id).delete();
      return true;
    } catch (err) {
      console.warn("Device token delete firestore fallback:", err.message);
    }
  }

  const bucket = getMemoryBucket(userId);
  return bucket.delete(id);
}
