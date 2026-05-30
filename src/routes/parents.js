import express from "express";
import { ok } from "../utils/respond.js";
import { knowledgeGraph } from "../ai/knowledgeGraph.js";
import { detectGap } from "../ai/gapDetector.js";
import { summarizeEvents } from "../services/analyticsStore.js";

const router = express.Router();

const defaultMastery = {
  "math.addition.1": 0.82,
  "math.subtraction.1": 0.74,
  "math.multiplication.1": 0.56,
  "math.division.1": 0.42,
  "math.fractions.1": 0.34,
  "reading.phonics.1": 0.78,
  "reading.comprehension.1": 0.61,
  "language.spelling.1": 0.58,
  "logic.patterns.1": 0.69
};

function masteryFromRequest(req) {
  const raw = req.query.mastery;
  if (!raw) return defaultMastery;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    // Fall back to defaults when payload is not valid JSON.
  }
  return defaultMastery;
}

function domainAverage(mastery, domain) {
  const values = Object.entries(knowledgeGraph)
    .filter(([, skill]) => skill.domain === domain)
    .map(([id]) => Number(mastery[id] ?? 0));

  if (!values.length) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 100);
}

router.get("/summary", async (req, res) => {
  const mastery = masteryFromRequest(req);
  const analytics = await summarizeEvents(req.user.id, Number(req.query.days || 7));
  const weakSkills = Object.entries(mastery)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, 3)
    .map(([skillId, score]) => ({ skillId, score: Math.round(Number(score) * 100) }));

  ok(res, {
    report: {
      childId: req.query.childId || "demo-child",
      generatedAt: new Date().toISOString(),
      mathProgress: domainAverage(mastery, "math"),
      readingProgress: domainAverage(mastery, "reading"),
      weakSkills,
      weeklyMinutes: analytics.avgSessionMinutes * Math.max(analytics.sessions, 1),
      sessions: analytics.sessions,
      streakDays: analytics.streakDays,
      quizSuccessRate: analytics.quizSuccessRate,
      dropRisk: analytics.dropRisk
    }
  });
});

router.get("/recommendations", (req, res) => {
  const mastery = masteryFromRequest(req);
  const [lowestSkillId] =
    Object.entries(mastery).sort((a, b) => Number(a[1]) - Number(b[1]))[0] || [];

  const targetSkill = lowestSkillId || "math.fractions.1";
  const gap = detectGap(targetSkill, mastery, 0.6);

  const items = [
    {
      type: "focus_skill",
      skillId: targetSkill,
      priority: "high",
      label: `Focus this week: ${targetSkill}`
    },
    ...gap.blockers.map((skillId) => ({
      type: "prerequisite",
      skillId,
      priority: "medium",
      label: `Review prerequisite: ${skillId}`
    }))
  ];

  ok(res, { items, gap });
});

export default router;
