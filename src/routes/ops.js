import express from "express";
import { ok } from "../utils/respond.js";
import { isOpenAIReady } from "../services/openai.js";
import { isFirebaseReady } from "../services/firebaseAdmin.js";
import { getMonitoringSnapshot, trackError } from "../services/monitoringStore.js";

const router = express.Router();
const bootTime = Date.now();

router.get("/status", (req, res) => {
  ok(res, {
    status: "ok",
    uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
    services: {
      openai: isOpenAIReady(),
      firebase: isFirebaseReady()
    },
    version: process.env.RELEASE_VERSION || "dev"
  });
});

router.get("/metrics", (req, res) => {
  const snapshot = getMonitoringSnapshot({ minutes: Number(req.query.minutes || 60) });
  ok(res, { snapshot });
});

router.post("/client-error", (req, res) => {
  const { message, stack = "", context = {} } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: { code: "validation_failed", message: "message is required" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  trackError({
    requestId: req.id,
    path: context?.path || "frontend",
    method: "CLIENT",
    message,
    stack
  });

  ok(res, { accepted: true });
});

export default router;
