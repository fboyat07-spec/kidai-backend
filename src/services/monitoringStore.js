const requestWindow = [];
const errorWindow = [];
const MAX_ITEMS = 1000;

function trim(window) {
  if (window.length > MAX_ITEMS) {
    window.splice(0, window.length - MAX_ITEMS);
  }
}

export function trackRequest({ method, path, statusCode, durationMs, requestId }) {
  requestWindow.push({
    method,
    path,
    statusCode,
    durationMs,
    requestId,
    at: new Date().toISOString()
  });
  trim(requestWindow);
}

export function trackError({ requestId, path, method, message, stack }) {
  errorWindow.push({
    requestId,
    path,
    method,
    message,
    stack: stack ? String(stack).slice(0, 1000) : "",
    at: new Date().toISOString()
  });
  trim(errorWindow);
}

export function getMonitoringSnapshot({ minutes = 60 } = {}) {
  const since = Date.now() - Math.max(1, Number(minutes || 60)) * 60 * 1000;
  const requests = requestWindow.filter((item) => new Date(item.at).getTime() >= since);
  const errors = errorWindow.filter((item) => new Date(item.at).getTime() >= since);

  const total = requests.length;
  const avgLatencyMs = total
    ? Number((requests.reduce((sum, item) => sum + Number(item.durationMs || 0), 0) / total).toFixed(1))
    : 0;
  const errorRate = total
    ? Number(((requests.filter((item) => Number(item.statusCode) >= 500).length / total) * 100).toFixed(1))
    : 0;

  return {
    minutes: Math.max(1, Number(minutes || 60)),
    totalRequests: total,
    avgLatencyMs,
    errorRate,
    totalErrors: errors.length,
    recentErrors: errors.slice(-10)
  };
}
