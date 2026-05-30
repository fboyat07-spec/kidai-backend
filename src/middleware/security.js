const buckets = new Map();

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  next();
}

function getClientKey(req) {
  return req.user?.id || req.ip || "anonymous";
}

export function createRateLimiter({ windowMs = 60000, max = 60 } = {}) {
  return (req, res, next) => {
    const key = `${req.baseUrl}:${getClientKey(req)}`;
    const now = Date.now();
    const state = buckets.get(key) || { hits: [] };
    state.hits = state.hits.filter((timestamp) => now - timestamp <= windowMs);
    state.hits.push(now);
    buckets.set(key, state);

    if (state.hits.length > max) {
      return res.status(429).json({
        error: { code: "rate_limited", message: "Too many requests, please slow down." },
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }

    return next();
  };
}
