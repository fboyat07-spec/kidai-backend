import jwt from "jsonwebtoken";
import { verifyIdToken } from "../services/firebaseAdmin.js";

const DEV_JWT_SECRET = "dev-secret-key";

export async function requireAuth(req, res, next) {
  const bypass = process.env.DEV_BYPASS_AUTH === "true";
  if (bypass) {
    console.warn(`[auth] DEV_BYPASS_AUTH enabled, request authorized without token (requestId=${req.id || "n/a"})`);
    req.user = { id: "dev", role: "parent" };
    return next();
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    console.warn(`[auth] Missing Bearer token (requestId=${req.id || "n/a"})`);
    return res.status(401).json({
      error: { code: "unauthorized", message: "Missing token" },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  try {
    const decoded = jwt.verify(token, DEV_JWT_SECRET);
    req.user = decoded;
    console.log("JWT DEV accept\u00e9 :", decoded);
    return next();
  } catch (err) {
    console.log("JWT dev \u00e9chou\u00e9, fallback Firebase...");
  }

  try {
    console.debug(`[auth] Falling back to Firebase token verification (requestId=${req.id || "n/a"})`);
    const decoded = await verifyIdToken(token);
    if (!decoded) {
      console.error(`[auth] Firebase auth service unavailable (requestId=${req.id || "n/a"})`);
      return res.status(503).json({
        error: { code: "auth_unavailable", message: "Auth service unavailable" },
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }
    console.info(`[auth] Firebase token accepted (requestId=${req.id || "n/a"}, userId=${decoded.uid})`);
    req.user = { id: decoded.uid, role: decoded.role || "parent" };
    return next();
  } catch (err) {
    console.warn(`[auth] Invalid token rejected (requestId=${req.id || "n/a"})`);
    return res.status(401).json({
      error: { code: "unauthorized", message: "Invalid token" },
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }
}
