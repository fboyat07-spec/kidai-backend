import express from "express";
import crypto from "node:crypto";
import { ok } from "../utils/respond.js";
import {
  diagnosticTest,
  diagnosticPlacement,
  evaluateDiagnosticAnswer
} from "../ai/diagnosticEngine.js";
import { db, isFirebaseReady } from "../services/firebaseAdmin.js";

const router = express.Router();
const sessions = new Map();
const MAX_QUESTIONS = 4;

function publicQuestion(question) {
  if (!question) return null;
  return {
    id: question.id,
    prompt: question.prompt,
    choices: question.choices
  };
}

function recommendedSkill(domain, placement) {
  const matrix = {
    math: {
      beginner: "math.addition.1",
      intermediate: "math.multiplication.1",
      advanced: "math.fractions.1"
    },
    reading: {
      beginner: "reading.phonics.1",
      intermediate: "reading.comprehension.1",
      advanced: "language.spelling.1"
    }
  };
  return matrix[domain]?.[placement] || "math.addition.1";
}

function sessionCollection() {
  return db.collection("diagnosticSessions");
}

async function saveSession(session) {
  if (isFirebaseReady() && db) {
    try {
      await sessionCollection().doc(session.id).set(session, { merge: true });
      return;
    } catch (err) {
      console.warn("Diagnostic session firestore fallback:", err.message);
    }
  }

  sessions.set(session.id, session);
}

async function readSession(sessionId) {
  if (isFirebaseReady() && db) {
    try {
      const snap = await sessionCollection().doc(sessionId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.warn("Diagnostic session read fallback:", err.message);
    }
  }

  return sessions.get(sessionId) || null;
}

async function deleteSession(sessionId) {
  if (isFirebaseReady() && db) {
    try {
      await sessionCollection().doc(sessionId).delete();
      return;
    } catch (err) {
      console.warn("Diagnostic session delete fallback:", err.message);
    }
  }

  sessions.delete(sessionId);
}

router.post("/start", async (req, res) => {
  const domain = ["math", "reading"].includes(req.body?.domain) ? req.body.domain : "math";
  const level = Number.isInteger(req.body?.level) ? req.body.level : 1;

  const question = diagnosticTest({ domain, level, askedIds: [] });
  if (!question) {
    return res.status(404).json({
      error: { code: "no_questions", message: "No diagnostic question available for this domain." },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    userId: req.user.id,
    domain,
    level: Math.max(1, Math.min(3, level)),
    total: 0,
    correct: 0,
    askedIds: [question.id],
    currentQuestion: question,
    startedAt: now,
    updatedAt: now
  };

  await saveSession(session);

  ok(res, {
    session: { id: sessionId, domain, startedAt: now },
    question: publicQuestion(question),
    remaining: MAX_QUESTIONS
  });
});

router.post("/answer", async (req, res) => {
  const { sessionId, answer } = req.body || {};

  if (!sessionId || typeof answer !== "string") {
    return res.status(400).json({
      error: { code: "validation_failed", message: "sessionId and answer are required." },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const session = await readSession(sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({
      error: { code: "not_found", message: "Diagnostic session not found." },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const isCorrect = evaluateDiagnosticAnswer(session.currentQuestion, answer);
  session.total += 1;
  if (isCorrect) session.correct += 1;

  if (isCorrect && session.level < 3) {
    session.level += 1;
  } else if (!isCorrect && session.level > 1) {
    session.level -= 1;
  }

  let done = session.total >= MAX_QUESTIONS;
  let nextQuestion = null;

  if (!done) {
    nextQuestion = diagnosticTest({
      domain: session.domain,
      level: session.level,
      askedIds: session.askedIds
    });

    if (nextQuestion) {
      session.currentQuestion = nextQuestion;
      session.askedIds.push(nextQuestion.id);
    } else {
      done = true;
    }
  }

  const progress = Math.round((session.total / MAX_QUESTIONS) * 100);
  session.updatedAt = new Date().toISOString();
  await saveSession(session);

  ok(res, {
    isCorrect,
    nextQuestion: publicQuestion(nextQuestion),
    done,
    progress,
    stats: { total: session.total, correct: session.correct }
  });
});

router.post("/finish", async (req, res) => {
  const { sessionId } = req.body || {};
  const session = await readSession(sessionId);

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({
      error: { code: "not_found", message: "Diagnostic session not found." },
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }

  const placement = diagnosticPlacement({ total: session.total, correct: session.correct });
  const skillId = recommendedSkill(session.domain, placement);

  await deleteSession(sessionId);

  ok(res, {
    session: {
      id: sessionId,
      total: session.total,
      correct: session.correct
    },
    placement,
    recommendedSkill: skillId
  });
});

export default router;
