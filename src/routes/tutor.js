import express from "express";
import { ok } from "../utils/respond.js";
import { generateTutorReply, isOpenAIReady } from "../services/openai.js";
import { createRateLimiter } from "../middleware/security.js";
import { detectFrustration } from "../ai/emotionEngagement.js";
import { interventionEngine } from "../ai/interventionTiming.js";
import { recordEvent } from "../services/analyticsStore.js";

const router = express.Router();
router.use(createRateLimiter({ windowMs: 60 * 1000, max: 40 }));

function defaultInterventionMessage(action) {
  if (action === "mini_lesson") {
    return "On fait une mini lecon en 2 etapes, puis tu reessayes.";
  }
  if (action === "hint" || action === "visual_hint") {
    return "Je te donne un indice: commence par decouper le probleme en petites etapes.";
  }
  return "Continue, tu avances bien.";
}

router.post("/chat", async (req, res) => {
  const { message } = req.body || {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: { code: "validation_failed", message: "message is required" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const result = await generateTutorReply({ message });
  ok(res, result);
});

router.post("/intervention", async (req, res) => {
  const payload = req.body || {};
  const errorStreak = Number(payload.errorStreak ?? 0);
  const secondsIdle = Number(payload.secondsIdle ?? 0);
  const responseMs = Number(payload.responseMs ?? 0);
  const quitEvents = Number(payload.quitEvents ?? 0);

  const frustration = detectFrustration({
    errorStreak,
    responseMs,
    quitEvents
  });
  const timing = interventionEngine({ errorStreak, secondsIdle });

  const nudgeType = timing.action !== "continue" ? timing.action : frustration.recommendedAction;
  const shouldNudge = nudgeType !== "continue";

  let message = "";
  if (shouldNudge) {
    if (typeof payload.message === "string" && payload.message.trim()) {
      const tutor = await generateTutorReply({
        message: `L'enfant est en difficulte. Action attendue: ${nudgeType}. Message enfant: ${payload.message}`
      });
      message = tutor.reply;
    } else {
      message = defaultInterventionMessage(nudgeType);
    }

    await recordEvent(req.user.id, {
      type: "tutor_intervention",
      metadata: {
        nudgeType,
        urgency: timing.urgency,
        frustrationScore: frustration.frustrationScore,
        engagementScore: frustration.engagementScore,
        errorStreak,
        secondsIdle
      }
    });
  }

  ok(res, {
    shouldNudge,
    nudgeType,
    message,
    frustration,
    timing
  });
});

router.get("/status", (req, res) => {
  ok(res, { llmReady: isOpenAIReady() });
});

export default router;
