import crypto from "crypto";
import { trackRequest } from "../services/monitoringStore.js";

export function attachRequestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    trackRequest({
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId: req.id
    });
  });
  next();
}
