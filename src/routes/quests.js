import express from "express";
import { ok } from "../utils/respond.js";
import { generateQuest } from "../ai/narrativeEngine.js";
import { db, isFirebaseReady } from "../services/firebaseAdmin.js";

const router = express.Router();
const questProgress = new Map();

function progressDoc(userId) {
  return db.collection("questProgress").doc(userId);
}

async function loadProgress(userId) {
  if (isFirebaseReady() && db) {
    try {
      const snap = await progressDoc(userId).get();
      if (!snap.exists) return {};
      return snap.data()?.skills || {};
    } catch (err) {
      console.warn("Quest progress firestore fallback:", err.message);
    }
  }

  return questProgress.get(userId) || {};
}

async function saveProgress(userId, progress) {
  if (isFirebaseReady() && db) {
    try {
      await progressDoc(userId).set(
        {
          skills: progress,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      return;
    } catch (err) {
      console.warn("Quest progress firestore write fallback:", err.message);
    }
  }

  questProgress.set(userId, progress);
}

router.get("/active", async (req, res) => {
  const skillId = req.query.skillId || "math.addition.1";
  const difficulty = Number(req.query.difficulty || 1);
  const quest = generateQuest(skillId, difficulty);
  const userProgress = await loadProgress(req.user.id);

  ok(res, {
    items: [
      {
        id: `${skillId}:${difficulty}`,
        ...quest,
        completed: Boolean(userProgress[skillId])
      }
    ]
  });
});

router.post("/complete", async (req, res) => {
  const { skillId = "math.addition.1", score = 1 } = req.body || {};
  const existing = await loadProgress(req.user.id);
  existing[skillId] = {
    completedAt: new Date().toISOString(),
    score: Number(score)
  };

  await saveProgress(req.user.id, existing);
  ok(res, { completed: true, skillId });
});

export default router;
