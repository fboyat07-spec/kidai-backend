import express from "express";
import { ok } from "../utils/respond.js";
import { createChild, getChild, listChildren, updateChild } from "../services/profileStore.js";

const router = express.Router();

function normalizeInterests(input) {
  if (Array.isArray(input)) {
    return input
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
}

function validatePayload(body, { allowPartial = false } = {}) {
  const payload = {};

  if (!allowPartial || body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length < 2) {
      return { error: "name must be at least 2 characters" };
    }
    payload.name = body.name.trim();
  }

  if (!allowPartial || body.age !== undefined) {
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 6 || age > 14) {
      return { error: "age must be an integer between 6 and 14" };
    }
    payload.age = age;
  }

  if (body.grade !== undefined) {
    if (typeof body.grade !== "string" || body.grade.trim().length < 1) {
      return { error: "grade is required" };
    }
    payload.grade = body.grade.trim().slice(0, 32);
  }

  if (body.interests !== undefined) {
    payload.interests = normalizeInterests(body.interests);
  }

  return { payload };
}

router.get("/", async (req, res) => {
  const items = await listChildren(req.user.id);
  ok(res, { items });
});

router.post("/", async (req, res) => {
  const { error, payload } = validatePayload(req.body || {});
  if (error) {
    return res.status(400).json({
      error: { code: "validation_failed", message: error },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const child = await createChild(req.user.id, payload);
  ok(res, { child });
});

router.get("/:id", async (req, res) => {
  const child = await getChild(req.user.id, req.params.id);
  if (!child) {
    return res.status(404).json({
      error: { code: "not_found", message: "Child profile not found" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
  ok(res, { child });
});

router.patch("/:id", async (req, res) => {
  const { error, payload } = validatePayload(req.body || {}, { allowPartial: true });
  if (error) {
    return res.status(400).json({
      error: { code: "validation_failed", message: error },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const child = await updateChild(req.user.id, req.params.id, payload);
  if (!child) {
    return res.status(404).json({
      error: { code: "not_found", message: "Child profile not found" },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  ok(res, { child });
});

export default router;
