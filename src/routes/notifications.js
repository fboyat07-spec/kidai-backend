import express from "express";
import { ok } from "../utils/respond.js";
import { getNotificationPrefs, updateNotificationPrefs } from "../services/notificationStore.js";
import { recordEvent, summarizeEvents } from "../services/analyticsStore.js";
import { getUserProfile } from "../services/profileStore.js";
import { buildSmartNudge } from "../services/nudgeEngine.js";
import {
  listDeviceTokens,
  registerDeviceToken,
  removeDeviceToken
} from "../services/deviceTokenStore.js";
import { isPushReady, sendPushToToken } from "../services/pushService.js";
import { createRateLimiter } from "../middleware/security.js";

const router = express.Router();
router.use(createRateLimiter({ windowMs: 60 * 1000, max: 40 }));

async function sendToAllDevices(userId, payload) {
  const devices = await listDeviceTokens(userId);
  const results = [];

  for (const device of devices) {
    const sent = await sendPushToToken({
      token: device.token,
      title: payload.title,
      body: payload.body,
      data: payload.data
    });

    results.push({ deviceId: device.id, ...sent });

    if (!sent.ok && String(sent.reason || "").includes("registration-token-not-registered")) {
      await removeDeviceToken(userId, device.token);
    }
  }

  return {
    total: devices.length,
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results
  };
}

router.get("/preferences", async (req, res) => {
  const preferences = await getNotificationPrefs(req.user.id);
  ok(res, { preferences, pushReady: isPushReady() });
});

router.patch("/preferences", async (req, res) => {
  const preferences = await updateNotificationPrefs(req.user.id, req.body || {});
  ok(res, { preferences, pushReady: isPushReady() });
});

router.get("/devices", async (req, res) => {
  const items = await listDeviceTokens(req.user.id);
  ok(res, { items, pushReady: isPushReady() });
});

router.post("/devices/register", async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({
      error: { code: "validation_failed", message: "token is required" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const device = await registerDeviceToken(req.user.id, { token, platform: platform || "unknown" });
  ok(res, { device, pushReady: isPushReady() });
});

router.post("/send-test", async (req, res) => {
  const report = await sendToAllDevices(req.user.id, {
    title: "KidAI Test",
    body: "Notification push activee avec succes.",
    data: { type: "test_push", route: "Home" }
  });

  if (report.success > 0) {
    await recordEvent(req.user.id, {
      type: "notification_sent",
      metadata: { category: "test", count: report.success }
    });
  }

  ok(res, { report, pushReady: isPushReady() });
});

router.get("/next-nudge", async (req, res) => {
  const preferences = await getNotificationPrefs(req.user.id);
  if (!preferences.enabled) {
    return ok(res, { nudge: null, preferences });
  }

  const summary = await summarizeEvents(req.user.id, Number(req.query.days || 7));
  const user = await getUserProfile(req.user.id);
  const nudge = buildSmartNudge({
    summary,
    weeklyGoal: user?.weeklyGoal || "",
    childName: req.query.childName || ""
  });

  ok(res, { nudge, preferences, summary });
});

router.post("/send-nudge", async (req, res) => {
  const preferences = await getNotificationPrefs(req.user.id);
  if (!preferences.enabled) {
    return ok(res, { sent: false, reason: "notifications_disabled" });
  }

  const summary = await summarizeEvents(req.user.id, Number(req.query.days || 7));
  const user = await getUserProfile(req.user.id);
  const nudge = buildSmartNudge({
    summary,
    weeklyGoal: user?.weeklyGoal || "",
    childName: req.body?.childName || ""
  });

  const report = await sendToAllDevices(req.user.id, {
    title: nudge.title,
    body: nudge.message,
    data: {
      type: "smart_nudge",
      route: nudge.action?.route || "Home",
      priority: nudge.priority || "low"
    }
  });

  if (report.success > 0) {
    await recordEvent(req.user.id, {
      type: "notification_sent",
      metadata: { category: "smart_nudge", count: report.success, nudgeType: nudge.type }
    });
  }

  ok(res, { nudge, report, pushReady: isPushReady() });
});

router.post("/opened", async (req, res) => {
  const { type = "unknown", route = "Home" } = req.body || {};
  await recordEvent(req.user.id, {
    type: "notification_opened",
    metadata: { type, route }
  });
  ok(res, { accepted: true });
});

export default router;
