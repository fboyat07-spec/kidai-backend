import express from "express";
import { ok } from "../utils/respond.js";
import { recordEvent, summarizeEvents } from "../services/analyticsStore.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { type, childId, metadata } = req.body || {};
  if (!type || typeof type !== "string") {
    return res.status(400).json({
      error: { code: "validation_failed", message: "type is required" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const item = await recordEvent(req.user.id, { type, childId, metadata });
  ok(res, { event: item });
});

router.get("/summary", async (req, res) => {
  const days = Number(req.query.days || 7);
  const summary = await summarizeEvents(req.user.id, days);
  ok(res, { summary });
});

router.get("/drop-signals", async (req, res) => {
  const summary = await summarizeEvents(req.user.id, Number(req.query.days || 7));
  ok(res, {
    dropRisk: summary.dropRisk,
    hoursSinceLastEvent: summary.hoursSinceLastEvent,
    interventionNeeded: summary.dropRisk !== "low"
  });
});

export default router;
