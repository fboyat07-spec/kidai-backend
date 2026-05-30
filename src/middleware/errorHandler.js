import { trackError } from "../services/monitoringStore.js";

export function notFound(req, res, next) {
  res.status(404).json({
    error: { code: "not_found", message: "Route not found" },
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
}

export function errorHandler(err, req, res, next) {
  let status = 500;
  let message = "Unexpected error";

  if (err?.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON body";
  } else if (err?.message === "cors_not_allowed") {
    status = 403;
    message = "CORS origin not allowed";
  }

  if (status >= 500) {
    console.error(err);
  }

  trackError({
    requestId: req.id,
    path: req.originalUrl,
    method: req.method,
    message: err?.message || message,
    stack: err?.stack
  });
  res.status(status).json({
    error: { code: status >= 500 ? "server_error" : "request_failed", message },
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
}
