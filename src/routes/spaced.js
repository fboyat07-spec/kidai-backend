import express from "express";
import { ok } from "../utils/respond.js";
import { spacedReview } from "../ai/spacedRepetition.js";
import { db, isFirebaseReady } from "../services/firebaseAdmin.js";

const router = express.Router();
const plans = new Map();

function reviewsCollection(userId) {
  return db.collection("users").doc(userId).collection("spacedReviews");
}

async function listPlan(userId) {
  if (isFirebaseReady() && db) {
    try {
      const snap = await reviewsCollection(userId)
        .orderBy("nextReviewAt", "asc")
        .limit(30)
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn("Spaced review firestore fallback:", err.message);
    }
  }

  const userPlan = plans.get(userId) || [];
  return [...userPlan].sort((a, b) => String(a.nextReviewAt).localeCompare(String(b.nextReviewAt)));
}

async function savePlanItem(userId, item) {
  if (isFirebaseReady() && db) {
    try {
      await reviewsCollection(userId).doc(item.id).set(item, { merge: true });
      return;
    } catch (err) {
      console.warn("Spaced review firestore write fallback:", err.message);
    }
  }

  const existing = plans.get(userId) || [];
  plans.set(userId, [item, ...existing].slice(0, 30));
}

router.get("/next", async (req, res) => {
  const userPlan = await listPlan(req.user.id);
  ok(res, { items: userPlan.slice(0, 5) });
});

router.post("/schedule", async (req, res) => {
  const payload = req.body || {};
  const review = spacedReview({
    stabilityLevel: Number(payload.stabilityLevel ?? 0),
    lastReviewAt: payload.lastReviewAt || Date.now(),
    isCorrect: Boolean(payload.isCorrect)
  });

  const item = {
    id: `review_${Date.now()}`,
    userId: req.user.id,
    skillId: payload.skillId || "math.addition.1",
    ...review,
    updatedAt: new Date().toISOString()
  };

  await savePlanItem(req.user.id, item);

  ok(res, { review: item });
});

export default router;
