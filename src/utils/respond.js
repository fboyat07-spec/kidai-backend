export function ok(res, data = {}) {
  res.json({ ok: true, ...data });
}
