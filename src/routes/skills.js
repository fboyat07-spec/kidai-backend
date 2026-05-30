import express from "express";
import { ok } from "../utils/respond.js";
import { db, isFirebaseReady } from "../services/firebaseAdmin.js";
import { knowledgeGraph, getSkill } from "../ai/knowledgeGraph.js";

const router = express.Router();

const localSkills = Object.entries(knowledgeGraph).map(([id, value]) => ({
  id,
  ...value,
  level: Number(id.split(".")[2] || 1)
}));

router.get("/", async (req, res) => {
  if (isFirebaseReady() && db) {
    try {
      const snapshot = await db.collection("skills").limit(50).get();
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items });
    } catch (err) {
      console.warn("Skills Firestore fallback:", err.message);
    }
  }
  return ok(res, { items: localSkills });
});

router.get("/:id", async (req, res) => {
  if (isFirebaseReady() && db) {
    try {
      const doc = await db.collection("skills").doc(req.params.id).get();
      const item = doc.exists ? { id: doc.id, ...doc.data() } : null;
      return ok(res, { skill: item });
    } catch (err) {
      console.warn("Skill Firestore fallback:", err.message);
    }
  }
  const raw = getSkill(req.params.id);
  const item = raw ? { id: req.params.id, ...raw } : null;
  return ok(res, { skill: item });
});

export default router;
