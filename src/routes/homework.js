import express from "express";
import { ok } from "../utils/respond.js";
import { scanHomeworkImage } from "../services/openai.js";
import { createRateLimiter } from "../middleware/security.js";

const router = express.Router();
router.use(createRateLimiter({ windowMs: 60 * 1000, max: 20 }));

router.post("/scan", async (req, res) => {
  const { imageUrl, instruction } = req.body || {};
  if (!imageUrl || typeof imageUrl !== "string") {
    return res.status(400).json({
      error: { code: "validation_failed", message: "imageUrl is required" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const analysis = await scanHomeworkImage({ imageUrl, instruction });
  ok(res, { analysis });
});

export default router;
