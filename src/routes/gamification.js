import express from "express";
import { ok } from "../utils/respond.js";
import { db, isFirebaseReady } from "../services/firebaseAdmin.js";

const router = express.Router();
const profiles = new Map();

function levelFromXp(xp) {
  return Math.floor(Number(xp || 0) / 250) + 1;
}

function defaultProfile() {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    badges: [],
    updatedAt: new Date().toISOString()
  };
}

function profileDoc(userId) {
  return db.collection("gamificationProfiles").doc(userId);
}

async function getProfile(userId) {
  if (isFirebaseReady() && db) {
    try {
      const snap = await profileDoc(userId).get();
      if (snap.exists) {
        return { ...defaultProfile(), ...snap.data() };
      }
      const profile = defaultProfile();
      await profileDoc(userId).set(profile, { merge: true });
      return profile;
    } catch (err) {
      console.warn("Gamification firestore fallback:", err.message);
    }
  }

  if (!profiles.has(userId)) {
    profiles.set(userId, defaultProfile());
  }
  return profiles.get(userId);
}

async function saveProfile(userId, profile) {
  profile.updatedAt = new Date().toISOString();

  if (isFirebaseReady() && db) {
    try {
      await profileDoc(userId).set(profile, { merge: true });
      return profile;
    } catch (err) {
      console.warn("Gamification firestore write fallback:", err.message);
    }
  }

  profiles.set(userId, profile);
  return profile;
}

router.get("/status", async (req, res) => {
  const profile = await getProfile(req.user.id);
  ok(res, { profile, recentRewards: [] });
});

router.post("/reward", async (req, res) => {
  const { xp = 10, reason = "exercise" } = req.body || {};
  const profile = await getProfile(req.user.id);
  profile.xp += Number(xp);
  profile.level = levelFromXp(profile.xp);
  profile.streak = Math.max(profile.streak, 1);

  if (profile.level >= 5 && !profile.badges.includes("Adventurer")) {
    profile.badges.push("Adventurer");
  }
  if (profile.level >= 10 && !profile.badges.includes("Scholar")) {
    profile.badges.push("Scholar");
  }

  await saveProfile(req.user.id, profile);

  ok(res, {
    profile,
    reward: {
      xp: Number(xp),
      reason,
      grantedAt: new Date().toISOString()
    }
  });
});

export default router;
