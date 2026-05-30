import { messaging } from "./firebaseAdmin.js";

export function isPushReady() {
  return Boolean(messaging);
}

export async function sendPushToToken({ token, title, body, data = {} }) {
  if (!isPushReady()) {
    return { ok: false, reason: "push_unavailable" };
  }

  try {
    const messageId = await messaging.send({
      token,
      notification: {
        title: String(title || "KidAI"),
        body: String(body || "")
      },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([key, value]) => [String(key), String(value)])
      )
    });

    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, reason: err?.code || "push_failed", message: err?.message || "push_failed" };
  }
}
