import express from "express";
import { ok } from "../utils/respond.js";
import { getUserProfile, updateUserProfile } from "../services/profileStore.js";

const router = express.Router();

router.get("/me", async (req, res) => {
  const user = await getUserProfile(req.user.id);
  ok(res, { user });
});

router.patch("/me", async (req, res) => {
  const { displayName, weeklyGoal } = req.body || {};
  const updates = {};

  if (displayName !== undefined) {
    if (typeof displayName !== "string" || displayName.trim().length < 2) {
      return res.status(400).json({
        error: { code: "validation_failed", message: "displayName must be at least 2 characters" },
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }
    updates.displayName = displayName.trim();
  }

  if (weeklyGoal !== undefined) {
    if (typeof weeklyGoal !== "string" || !weeklyGoal.trim()) {
      return res.status(400).json({
        error: { code: "validation_failed", message: "weeklyGoal must be a non-empty string" },
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }
    updates.weeklyGoal = weeklyGoal.trim();
  }

  const user = await updateUserProfile(req.user.id, updates);
  ok(res, { user });
});

export default router;
