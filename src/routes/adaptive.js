import express from "express";
import { ok } from "../utils/respond.js";
import { adjustDifficulty } from "../ai/adaptiveDifficulty.js";
import { detectGap } from "../ai/gapDetector.js";
import { generateMission } from "../ai/missionGenerator.js";
import { getWeakSkills } from "../ai/userProfile.js";
import { knowledgeGraph } from "../ai/knowledgeGraph.js";

const router = express.Router();

const legacySkillToNode = {
  addition: "math.addition.1",
  multiplication: "math.multiplication.1",
  division: "math.division.1",
  fractions: "math.fractions.1"
};

function normalizeSkill(skill) {
  const raw = String(skill || "addition").trim().toLowerCase();
  return legacySkillToNode[raw] || raw;
}

function compactGraph() {
  return Object.keys(legacySkillToNode).reduce((acc, key) => {
    const nodeId = legacySkillToNode[key];
    const skill = knowledgeGraph[nodeId];
    const prereqs = (skill?.prerequisites || []).map((prereq) => {
      const mapped = Object.entries(legacySkillToNode).find(([, value]) => value === prereq);
      return mapped ? mapped[0] : prereq;
    });
    acc[key] = prereqs;
    return acc;
  }, {});
}

function parseMastery(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

router.post("/adjust", (req, res) => {
  const input = req.body || {};
  const result = adjustDifficulty({
    successRate: Number(input.successRate ?? 0.5),
    currentLevel: Number(input.currentLevel ?? 1),
    errorStreak: Number(input.errorStreak ?? 0),
    responseMs: Number(input.responseMs ?? 0),
    minLevel: Number(input.minLevel ?? 1),
    maxLevel: Number(input.maxLevel ?? 5)
  });

  ok(res, { targetDifficulty: result.nextLevel, reason: result.reason, details: result });
});

router.get("/gap", (req, res) => {
  const requestedSkill = String(req.query.skill || "division").trim().toLowerCase();
  const skillId = normalizeSkill(requestedSkill);

  const gap = detectGap(skillId, parseMastery(req.query.mastery), 0.6);
  const legacyBlockers = gap.blockers.map((node) => {
    const mapped = Object.entries(legacySkillToNode).find(([, value]) => value === node);
    return mapped ? mapped[0] : node;
  });

  ok(res, {
    skill: requestedSkill,
    lacunes: legacyBlockers,
    details: gap
  });
});

router.get("/mission", (req, res) => {
  const skill = String(req.query.skill || "multiplication").trim().toLowerCase();
  ok(res, generateMission(skill));
});

router.post("/weak-skills", (req, res) => {
  const profile = req.body?.profile || req.body || {};
  const threshold = Number(req.body?.threshold ?? 50);
  ok(res, { weakSkills: getWeakSkills(profile, threshold), threshold });
});

router.get("/learning-graph", (req, res) => {
  ok(res, { graph: compactGraph() });
});

export default router;
