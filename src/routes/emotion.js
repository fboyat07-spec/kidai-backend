import express from "express";
import { ok } from "../utils/respond.js";
import { detectFrustration } from "../ai/emotionEngagement.js";
import { interventionEngine } from "../ai/interventionTiming.js";

const router = express.Router();

router.post("/detect", (req, res) => {
  const payload = req.body || {};
  const signal = detectFrustration({
    errorStreak: Number(payload.errorStreak ?? 0),
    responseMs: Number(payload.responseMs ?? 0),
    quitEvents: Number(payload.quitEvents ?? 0)
  });

  const intervention = interventionEngine({
    errorStreak: Number(payload.errorStreak ?? 0),
    secondsIdle: Number(payload.secondsIdle ?? 0)
  });

  ok(res, { ...signal, intervention });
});

export default router;
