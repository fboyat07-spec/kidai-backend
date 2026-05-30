import express from "express";
import jwt from "jsonwebtoken";
import { ok } from "../utils/respond.js";
import { verifyIdToken } from "../services/firebaseAdmin.js";

const router = express.Router();

router.post("/dev-token", (req, res) => {
  const payload = {
    id: "dev-user",
    role: "admin"
  };

  const token = jwt.sign(payload, "dev-secret-key", {
    expiresIn: "7d"
  });

  console.log("Token g\u00e9n\u00e9r\u00e9 :", token);

  res.json({ token });
});

router.post("/session", async (req, res) => {
  const bypass = process.env.DEV_BYPASS_AUTH === "true";
  if (bypass) {
    return ok(res, { token: "dev-token", expiresIn: 3600, user: { id: "dev", role: "parent" } });
  }

  const { firebaseToken } = req.body || {};
  if (!firebaseToken) {
    return res.status(400).json({
      error: { code: "validation_failed", message: "firebaseToken required" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const decoded = await verifyIdToken(firebaseToken);
    if (!decoded) {
      return res.status(503).json({
        error: { code: "auth_unavailable", message: "Auth service unavailable" },
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }
    return ok(res, { token: firebaseToken, expiresIn: 3600, user: { id: decoded.uid, role: decoded.role || "parent" } });
  } catch (err) {
    return res.status(401).json({
      error: { code: "unauthorized", message: "Invalid token" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
